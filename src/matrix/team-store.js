/**
 * TeamStore — CRUD for team data via Matrix rooms.
 *
 * Teams are Matrix rooms with TEAM_META state.
 * Members tracked via TEAM_MEMBERS state + room membership.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const TeamStore = {
  /**
   * Create a new team. Returns { room_id }.
   */
  async createTeam({ name, description = '', color = 'purple', consentMode = 'lead_decides' }) {
    const result = await MatrixService.createRoom({
      name: `Team: ${name}`,
      initialState: [
        {
          type: EVT.TEAM_META,
          state_key: '',
          content: {
            name,
            description,
            color,
            consent_mode: consentMode,
            created: new Date().toISOString(),
            created_by: MatrixService.userId,
          },
        },
        {
          type: EVT.IDENTITY,
          state_key: '',
          content: { account_type: 'team' },
        },
      ],
    });

    // Initialize members list
    await MatrixService.setState(result.room_id, EVT.TEAM_MEMBERS, '', {
      members: [{
        userId: MatrixService.userId,
        role: 'lead',
        joined: new Date().toISOString(),
      }],
    });

    return result;
  },

  /**
   * Load all teams the user belongs to.
   */
  async loadTeams() {
    try {
      const scanned = await MatrixService.scanRooms([EVT.TEAM_META, EVT.TEAM_MEMBERS, EVT.IDENTITY]);
      return scanned
        .filter(r => r.state[EVT.IDENTITY]?.account_type === 'team' || r.state[EVT.TEAM_META])
        .map(r => ({
          roomId: r.roomId,
          roomName: r.roomName,
          meta: r.state[EVT.TEAM_META] || {},
          members: r.state[EVT.TEAM_MEMBERS]?.members || [],
        }));
    } catch (err) {
      console.warn('loadTeams: scan failed, returning empty list:', err.message);
      return [];
    }
  },

  /**
   * Get team detail (meta + members + schema).
   */
  async getTeamDetail(roomId) {
    const [meta, members, schema] = await Promise.allSettled([
      MatrixService.getState(roomId, EVT.TEAM_META),
      MatrixService.getState(roomId, EVT.TEAM_MEMBERS),
      MatrixService.getAllState(roomId, EVT.TEAM_SCHEMA),
    ]);

    let roomMembers = [];
    try {
      roomMembers = await MatrixService.getRoomMembers(roomId);
    } catch {
      // Room may not be accessible
    }

    return {
      roomId,
      meta: meta.status === 'fulfilled' ? (meta.value || {}) : {},
      members: members.status === 'fulfilled' ? (members.value?.members || []) : [],
      roomMembers,
      schema: schema.status === 'fulfilled' ? (schema.value || []).map(s => s.content) : [],
    };
  },

  /**
   * Update team metadata.
   */
  async updateTeamMeta(roomId, updates) {
    const current = await MatrixService.getState(roomId, EVT.TEAM_META) || {};
    return await MatrixService.setState(roomId, EVT.TEAM_META, '', {
      ...current,
      ...updates,
      updated: new Date().toISOString(),
    });
  },

  /**
   * Invite a member to the team.
   */
  async inviteMember(roomId, userId, role = 'member') {
    // Invite to Matrix room
    await MatrixService.invite(roomId, userId);

    // Update members list
    const current = await MatrixService.getState(roomId, EVT.TEAM_MEMBERS) || { members: [] };
    const members = [...(current.members || [])];
    if (!members.find(m => m.userId === userId)) {
      members.push({ userId, role, joined: new Date().toISOString() });
    }
    await MatrixService.setState(roomId, EVT.TEAM_MEMBERS, '', { members });
  },

  /**
   * Remove a member from the team.
   */
  async removeMember(roomId, userId, reason = '') {
    await MatrixService.kick(roomId, userId, reason);

    const current = await MatrixService.getState(roomId, EVT.TEAM_MEMBERS) || { members: [] };
    const members = (current.members || []).filter(m => m.userId !== userId);
    await MatrixService.setState(roomId, EVT.TEAM_MEMBERS, '', { members });
  },

  /**
   * Add a field to the team schema.
   */
  async addSchemaField(roomId, fieldDef) {
    const key = fieldDef.key || `field_${Date.now()}`;
    await MatrixService.setState(roomId, EVT.TEAM_SCHEMA, key, {
      ...fieldDef,
      key,
      added_by: MatrixService.userId,
      added: new Date().toISOString(),
    });
  },

  /**
   * Remove a field from the team schema.
   */
  async removeSchemaField(roomId, fieldKey) {
    await MatrixService.setState(roomId, EVT.TEAM_SCHEMA, fieldKey, {
      key: fieldKey,
      removed: true,
      removed_by: MatrixService.userId,
      removed_at: new Date().toISOString(),
    });
  },

  /**
   * Get team activity from timeline.
   */
  async getActivity(roomId) {
    return await MatrixService.getRoomTimeline(roomId, {
      limit: 100,
      filter: (type) => type.startsWith('io.khora.team.'),
    });
  },
};
