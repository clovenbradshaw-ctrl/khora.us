/**
 * MatrixService — abstraction layer over matrix-js-sdk.
 *
 * Handles login, connection, room creation, state events, timeline events,
 * room scanning, and retry logic. All Khora-specific event types flow through this.
 *
 * Patterns from original Khora:
 * - SDK path first, API fallback
 * - 600ms throttle between room creations
 * - Encrypted-only timeline event sending
 * - Exponential backoff on 429s
 * - Session stored in sessionStorage, deviceId in localStorage
 */

import * as sdk from 'matrix-js-sdk';

// ── State ───────────────────────────────────────────────────────────

let _client = null;
let _baseUrl = '';
let _token = '';
let _userId = '';
let _deviceId = '';
const _stateCache = new Map();
const STATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SESSION_KEY = 'khora:session';
const DEVICE_KEY = 'khora:deviceId';

// ── Connection ──────────────────────────────────────────────────────

export const MatrixService = {
  get client() { return _client; },
  get userId() { return _userId; },
  get baseUrl() { return _baseUrl; },
  get isConnected() { return !!_client; },

  // ── Authentication ──────────────────────────────────────────────

  /**
   * Login with username/password credentials.
   * Stores session in sessionStorage, deviceId in localStorage.
   */
  async login(baseUrl, user, password) {
    // Normalize homeserver URL
    const hs = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;

    // Reuse deviceId for crypto store continuity
    const storedDeviceId = localStorage.getItem(DEVICE_KEY) || undefined;

    const tempClient = sdk.createClient({ baseUrl: hs });
    const loginResponse = await tempClient.login('m.login.password', {
      user,
      password,
      device_id: storedDeviceId,
      initial_device_display_name: 'Khora Web',
    });

    const { access_token, user_id, device_id } = loginResponse;

    // Persist deviceId for crypto continuity
    localStorage.setItem(DEVICE_KEY, device_id);

    // Store session (sessionStorage = cleared on tab close)
    const session = { baseUrl: hs, accessToken: access_token, userId: user_id, deviceId: device_id };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Connect with the new credentials
    await this.connect(hs, access_token, user_id, device_id);

    return { userId: user_id, deviceId: device_id };
  },

  /**
   * Try to restore a session from sessionStorage.
   * Returns { userId } on success, null if no valid session.
   */
  async restoreSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const { baseUrl, accessToken, userId, deviceId } = session;
    if (!baseUrl || !accessToken || !userId) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Validate token with whoami
    try {
      const res = await fetch(`${baseUrl}/_matrix/client/v3/account/whoami`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
    } catch {
      // Network error — try anyway, sync will fail gracefully
    }

    await this.connect(baseUrl, accessToken, userId, deviceId);
    return { userId };
  },

  /**
   * Logout — stop client, clear all stored session data.
   */
  async logout() {
    if (_client) {
      try { _client.stopClient(); } catch { /* best effort */ }
      try { await _client.logout(); } catch { /* best effort */ }
      _client = null;
    }
    _stateCache.clear();
    _baseUrl = '';
    _token = '';
    _userId = '';
    _deviceId = '';
    sessionStorage.removeItem(SESSION_KEY);
  },

  /**
   * Connect to Matrix homeserver with access token.
   */
  async connect(baseUrl, accessToken, userId, deviceId) {
    _baseUrl = baseUrl;
    _token = accessToken;
    _userId = userId;
    _deviceId = deviceId || '';

    _client = sdk.createClient({
      baseUrl,
      accessToken,
      userId,
      deviceId: deviceId || undefined,
      useAuthorizationHeader: true,
    });

    // Start sync
    await _client.startClient({ initialSyncLimit: 20 });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 15000); // 15s max wait
      _client.once('sync', (state) => {
        clearTimeout(timeout);
        if (state === 'PREPARED') resolve();
        else resolve(); // resolve even on ERROR so we don't hang
      });
    });
  },

  /**
   * Disconnect and clean up.
   */
  async disconnect() {
    if (_client) {
      _client.stopClient();
      _client = null;
    }
    _stateCache.clear();
    _baseUrl = '';
    _token = '';
    _userId = '';
    _deviceId = '';
  },

  // ── Room Scanning ────────────────────────────────────────────────

  /**
   * Scan all joined rooms and read specified state event types.
   * Returns array of { roomId, roomName, state: { [eventType]: content } }.
   */
  async scanRooms(stateTypes = []) {
    if (!_client) return [];

    const rooms = _client.getRooms() || [];
    const results = [];

    for (const room of rooms) {
      const entry = {
        roomId: room.roomId,
        roomName: room.name,
        state: {},
      };

      for (const type of stateTypes) {
        const ev = room.currentState.getStateEvents(type, '');
        if (ev) {
          entry.state[type] = ev.getContent();
        }
      }

      results.push(entry);
    }

    return results;
  },

  /**
   * Detect available contexts (client/provider) from joined rooms.
   */
  async detectContexts(evtIdentity) {
    const scanned = await this.scanRooms([evtIdentity]);
    const contexts = new Set();

    for (const room of scanned) {
      const identity = room.state[evtIdentity];
      if (!identity?.account_type) continue;

      const t = identity.account_type;
      if (t === 'client' || t === 'client_record') {
        contexts.add('client');
      } else if (['provider', 'organization', 'schema', 'metrics', 'network', 'team'].includes(t)) {
        contexts.add('provider');
      }
    }

    return [...contexts];
  },

  // ── Room Creation ───────────────────────────────────────────────

  /**
   * Create an encrypted room with optional initial state.
   */
  async createRoom(opts = {}) {
    const {
      name,
      invite = [],
      initialState = [],
      powerLevels,
      isDirect = false,
    } = opts;

    const createOpts = {
      name,
      invite,
      visibility: 'private',
      preset: 'private_chat',
      is_direct: isDirect,
      initial_state: [
        {
          type: 'm.room.encryption',
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
        },
        ...initialState,
      ],
    };

    if (powerLevels) {
      createOpts.power_level_content_override = powerLevels;
    }

    return await _withRetry(async () => {
      const result = await _client.createRoom(createOpts);
      await _sleep(600);
      return result;
    });
  },

  /**
   * Create a client-sovereign room (vault or bridge).
   * Client = PL 100, Provider = PL 50.
   */
  async createClientRoom(clientUserId, providerUserId, opts = {}) {
    const powerLevels = {
      users: {
        [clientUserId]: 100,
        ...(providerUserId ? { [providerUserId]: 50 } : {}),
      },
      users_default: 0,
      events_default: 50,
      state_default: 100,
    };

    return this.createRoom({ ...opts, powerLevels });
  },

  // ── State Events ────────────────────────────────────────────────

  /**
   * Read a state event. SDK first, then cache, then API fallback.
   */
  async getState(roomId, eventType, stateKey = '') {
    if (_client) {
      const room = _client.getRoom(roomId);
      if (room) {
        const ev = room.currentState.getStateEvents(eventType, stateKey);
        if (ev) return ev.getContent();
      }
    }

    const cacheKey = `${roomId}:${eventType}:${stateKey}`;
    const cached = _stateCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < STATE_CACHE_TTL) {
      return cached.data;
    }

    try {
      const url = `${_baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${_token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      _stateCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    } catch {
      return cached?.data || null;
    }
  },

  /**
   * Read all state events of a given type from a room (all state keys).
   */
  async getAllState(roomId, eventType) {
    if (!_client) return [];
    const room = _client.getRoom(roomId);
    if (!room) return [];

    const events = room.currentState.getStateEvents(eventType);
    if (!events) return [];
    const arr = Array.isArray(events) ? events : [events];
    return arr.map(ev => ({
      stateKey: ev.getStateKey(),
      content: ev.getContent(),
    }));
  },

  /**
   * Write a state event.
   */
  async setState(roomId, eventType, stateKey = '', content) {
    const cacheKey = `${roomId}:${eventType}:${stateKey}`;
    _stateCache.set(cacheKey, { data: content, ts: Date.now() });

    return await _withRetry(async () => {
      if (_client) {
        return await _client.sendStateEvent(roomId, eventType, content, stateKey);
      }
      const url = `${_baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      });
      if (!res.ok) throw new Error(`setState failed: ${res.status}`);
      return await res.json();
    });
  },

  // ── Timeline Events ─────────────────────────────────────────────

  /**
   * Send a timeline event to a room.
   */
  async sendTimelineEvent(roomId, eventType, content) {
    if (!_client) throw new Error('Not connected');

    return await _withRetry(async () => {
      try {
        return await _client.sendEvent(roomId, eventType, content);
      } catch (err) {
        if (err.name === 'UnknownDeviceError' || err.message?.includes('olm')) {
          await _refreshRoomDeviceKeys(roomId);
          await _sleep(1500);
          return await _client.sendEvent(roomId, eventType, content);
        }
        throw err;
      }
    });
  },

  /**
   * Get timeline events from a room, paginating backwards.
   */
  async getRoomTimeline(roomId, opts = {}) {
    const { limit = 500, filter } = opts;
    const events = [];

    if (!_client) return events;

    const room = _client.getRoom(roomId);
    if (!room) return events;

    for (let i = 0; i < 5; i++) {
      const canPaginate = room.getLiveTimeline().getPaginationToken('b');
      if (!canPaginate) break;
      try {
        await _client.scrollback(room, 100);
      } catch {
        break;
      }
    }

    const timelineEvents = room.getLiveTimeline().getEvents();
    for (const ev of timelineEvents) {
      const type = ev.getType();
      if (filter && !filter(type, ev)) continue;
      events.push({
        id: ev.getId(),
        type,
        content: ev.getContent(),
        sender: ev.getSender(),
        timestamp: ev.getTs(),
        stateKey: ev.getStateKey?.(),
      });
    }

    return events.slice(-limit);
  },

  // ── Room Listing ────────────────────────────────────────────────

  /**
   * Get all joined rooms.
   */
  getJoinedRooms() {
    if (!_client) return [];
    return _client.getRooms() || [];
  },

  /**
   * Get room members.
   */
  async getRoomMembers(roomId) {
    if (!_client) return [];
    const room = _client.getRoom(roomId);
    if (!room) return [];
    return room.getJoinedMembers().map(m => ({
      userId: m.userId,
      name: m.name,
      membership: m.membership,
    }));
  },

  /**
   * Invite a user to a room.
   */
  async invite(roomId, userId) {
    if (!_client) throw new Error('Not connected');
    return await _withRetry(() => _client.invite(roomId, userId));
  },

  /**
   * Kick a user from a room.
   */
  async kick(roomId, userId, reason = '') {
    if (!_client) throw new Error('Not connected');
    return await _withRetry(() => _client.kick(roomId, userId, reason));
  },

  /**
   * Update power levels for specific users in a room.
   * @param {Object} userLevels - { userId: powerLevel } map
   */
  async setPowerLevels(roomId, userLevels) {
    if (!_client) throw new Error('Not connected');
    const room = _client.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
    const currentPl = plEvent ? plEvent.getContent() : { users: {} };
    const users = { ...(currentPl.users || {}), ...userLevels };

    return await _withRetry(() =>
      _client.sendStateEvent(roomId, 'm.room.power_levels', { ...currentPl, users }, '')
    );
  },
};

// ── Internal helpers ────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function _refreshRoomDeviceKeys(roomId) {
  if (!_client) return;
  const room = _client.getRoom(roomId);
  if (!room) return;
  const members = room.getJoinedMembers();
  const userIds = members.map(m => m.userId);
  try {
    await _client.downloadKeys(userIds, true);
  } catch { /* best effort */ }
}

async function _withRetry(fn, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.httpStatus === 429 || err.errcode === 'M_LIMIT_EXCEEDED';
      const isNetwork = err.name === 'TypeError' && err.message?.includes('fetch');

      if ((is429 || isNetwork) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        await _sleep(delay);
        continue;
      }
      throw err;
    }
  }
}
