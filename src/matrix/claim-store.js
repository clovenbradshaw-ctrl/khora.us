/**
 * ClaimStore — persistence layer for claim events on Matrix.
 *
 * Timeline events (io.khora.claim.event) are the authoritative event stream.
 * State events (io.khora.claim.stack) are cache-only snapshots.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const ClaimStore = {
  /**
   * Emit a claim event to a room's timeline.
   * This is the primary write operation — appends to the event stream.
   */
  async emitEvent(roomId, claimEvent) {
    return await MatrixService.sendTimelineEvent(roomId, EVT.CLAIM_EVENT, claimEvent);
  },

  /**
   * Load all claim events from a room's timeline.
   * Returns sorted array of claim event payloads.
   */
  async loadEvents(roomId, opts = {}) {
    const { limit = 1000 } = opts;

    const rawEvents = await MatrixService.getRoomTimeline(roomId, {
      limit,
      filter: (type) => type === EVT.CLAIM_EVENT,
    });

    // Map to claim event payloads, sorted chronologically
    return rawEvents
      .map(ev => ({
        ...ev.content,
        _matrixEventId: ev.id,
        _sender: ev.sender,
        _timestamp: ev.timestamp,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  /**
   * Write a snapshot of a field's claim stack as a state event.
   * This is cache only — the event stream is authoritative.
   */
  async snapshotStack(roomId, fieldKey, stack) {
    return await MatrixService.setState(roomId, EVT.CLAIM_STACK, fieldKey, {
      fieldKey,
      claims: stack.claims,
      isHeld: stack.isHeld,
      isContested: stack.isContested,
      conLinks: stack.conLinks,
      snapshotAt: new Date().toISOString(),
    });
  },

  /**
   * Load a cached stack snapshot for a field.
   * Returns the stack object or null.
   */
  async loadSnapshot(roomId, fieldKey) {
    const data = await MatrixService.getState(roomId, EVT.CLAIM_STACK, fieldKey);
    return data || null;
  },

  /**
   * Load all cached stack snapshots for a room.
   * Returns Map<fieldKey, stack>.
   */
  async loadAllSnapshots(roomId) {
    const stacks = new Map();

    if (!MatrixService.client) return stacks;

    const room = MatrixService.client.getRoom(roomId);
    if (!room) return stacks;

    // Read all io.khora.claim.stack state events
    const stateEvents = room.currentState.getStateEvents(EVT.CLAIM_STACK);
    if (stateEvents) {
      const events = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
      for (const ev of events) {
        const content = ev.getContent();
        if (content?.fieldKey) {
          stacks.set(content.fieldKey, content);
        }
      }
    }

    return stacks;
  },
};
