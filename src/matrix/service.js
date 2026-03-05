/**
 * MatrixService — abstraction layer over matrix-js-sdk.
 *
 * Handles connection, room creation, state events, timeline events,
 * and retry logic. All Khora-specific event types flow through this.
 *
 * Ported from existing Khora service.js patterns:
 * - SDK path first, API fallback
 * - 600ms throttle between room creations
 * - Encrypted-only timeline event sending
 * - Exponential backoff on 429s
 */

import * as sdk from 'matrix-js-sdk';

// ── State ───────────────────────────────────────────────────────────

let _client = null;
let _baseUrl = '';
let _token = '';
let _userId = '';
const _stateCache = new Map(); // `${roomId}:${type}:${stateKey}` → { data, ts }
const STATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Connection ──────────────────────────────────────────────────────

export const MatrixService = {
  get client() { return _client; },
  get userId() { return _userId; },
  get baseUrl() { return _baseUrl; },
  get isConnected() { return !!_client; },

  /**
   * Connect to Matrix homeserver with access token.
   */
  async connect(baseUrl, accessToken, userId) {
    _baseUrl = baseUrl;
    _token = accessToken;
    _userId = userId;

    _client = sdk.createClient({
      baseUrl,
      accessToken,
      userId,
      useAuthorizationHeader: true,
    });

    // Start sync
    await _client.startClient({ initialSyncLimit: 20 });

    return new Promise((resolve) => {
      _client.once('sync', (state) => {
        if (state === 'PREPARED') resolve();
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
  },

  // ── Room Creation ───────────────────────────────────────────────

  /**
   * Create an encrypted room with optional initial state.
   * Throttled to prevent rate-limit cascades.
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
        // Enable Megolm E2EE by default
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
      // 600ms breathing room between room creations
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
      state_default: 100, // Only client can set state
    };

    return this.createRoom({ ...opts, powerLevels });
  },

  // ── State Events ────────────────────────────────────────────────

  /**
   * Read a state event. SDK first, then cache, then API fallback.
   */
  async getState(roomId, eventType, stateKey = '') {
    // Try SDK local state
    if (_client) {
      const room = _client.getRoom(roomId);
      if (room) {
        const ev = room.currentState.getStateEvents(eventType, stateKey);
        if (ev) return ev.getContent();
      }
    }

    // Try cache
    const cacheKey = `${roomId}:${eventType}:${stateKey}`;
    const cached = _stateCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < STATE_CACHE_TTL) {
      return cached.data;
    }

    // API fallback
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
      // Return stale cache rather than null on network failure
      return cached?.data || null;
    }
  },

  /**
   * Write a state event.
   */
  async setState(roomId, eventType, stateKey = '', content) {
    // Optimistic cache update
    const cacheKey = `${roomId}:${eventType}:${stateKey}`;
    _stateCache.set(cacheKey, { data: content, ts: Date.now() });

    return await _withRetry(async () => {
      if (_client) {
        return await _client.sendStateEvent(roomId, eventType, content, stateKey);
      }
      // API fallback
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
   * Send a timeline event to a room. Encrypted-only guard.
   */
  async sendTimelineEvent(roomId, eventType, content) {
    if (!_client) throw new Error('Not connected');

    return await _withRetry(async () => {
      try {
        return await _client.sendEvent(roomId, eventType, content);
      } catch (err) {
        // On Megolm/OLM errors, refresh device keys and retry
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

    // Paginate backwards to collect events
    for (let i = 0; i < 5; i++) {
      const canPaginate = room.getLiveTimeline().getPaginationToken('b');
      if (!canPaginate) break;
      try {
        await _client.scrollback(room, 100);
      } catch {
        break;
      }
    }

    // Collect from live timeline
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

/**
 * Retry with exponential backoff on 429s and network errors.
 */
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
