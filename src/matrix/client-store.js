/**
 * ClientStore — persistence layer for client records on Matrix.
 *
 * Creates client_record rooms and loads them from joined rooms.
 * Follows the same pattern as TeamStore.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';
import { ClaimStore } from './claim-store.js';
import { buildClaimEvent } from '../engine/claims.js';

export const ClientStore = {
  /**
   * Create a new client record room with initial claim events.
   * Returns { roomId }.
   */
  async createClient({ preferredName, legalName, status = 'Intake' }) {
    if (!preferredName?.trim()) throw new Error('Preferred name is required');

    const agent = MatrixService.userId;
    const now = new Date().toISOString();

    // Create encrypted room with identity + bridge meta state
    const result = await MatrixService.createRoom({
      name: preferredName.trim(),
      initialState: [
        {
          type: EVT.IDENTITY,
          state_key: '',
          content: { account_type: 'client_record' },
        },
        {
          type: EVT.BRIDGE_META,
          state_key: '',
          content: {
            preferred_name: preferredName.trim(),
            legal_name: legalName?.trim() || '',
            status,
            created: now,
            created_by: agent,
          },
        },
      ],
    });

    const roomId = result.room_id;

    // Build initial claim event with NUL + DES/INS ops (matching seed-events pattern)
    const ops = [
      { op: 'NUL', field: null, note: 'Case brought out of void.' },

      { op: 'DES', field: 'preferred_name', claimId: `pn_${Date.now().toString(36)}`, value: preferredName.trim(), agent, role: 'Provider', mode: 'declared', note: 'Intake — client name.' },
      { op: 'INS', field: 'preferred_name', claimId: `pn_${Date.now().toString(36)}` },

      { op: 'DES', field: 'case_status', claimId: `cs_${Date.now().toString(36)}`, value: status, agent, role: 'Provider', mode: 'declared' },
      { op: 'INS', field: 'case_status', claimId: `cs_${Date.now().toString(36)}` },
    ];

    // Add legal name if provided
    if (legalName?.trim()) {
      const lnId = `ln_${Date.now().toString(36)}`;
      ops.splice(3, 0,
        { op: 'DES', field: 'legal_name', claimId: lnId, value: legalName.trim(), agent, role: 'Provider', mode: 'declared' },
        { op: 'INS', field: 'legal_name', claimId: lnId },
      );
    }

    const claimEvent = buildClaimEvent(agent, 'Provider', ops, 'Intake opened');

    try {
      await ClaimStore.emitEvent(roomId, claimEvent);
    } catch (err) {
      console.warn('Initial claim event failed (room may need sync):', err);
    }

    return {
      roomId,
      roomName: preferredName.trim(),
      meta: {
        preferred_name: preferredName.trim(),
        legal_name: legalName?.trim() || '',
        status,
        created: now,
        created_by: agent,
      },
    };
  },

  /**
   * Load all client_record rooms the current user has joined.
   * Returns [{ roomId, roomName, meta }].
   */
  async loadClients() {
    try {
      const scanned = await MatrixService.scanRooms([EVT.IDENTITY, EVT.BRIDGE_META]);
      return scanned
        .filter(r => r.state[EVT.IDENTITY]?.account_type === 'client_record')
        .map(r => ({
          roomId: r.roomId,
          roomName: r.roomName,
          meta: r.state[EVT.BRIDGE_META] || {},
        }));
    } catch (err) {
      console.error('Failed to load clients:', err);
      return [];
    }
  },
};
