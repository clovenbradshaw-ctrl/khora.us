import { useCallback } from 'react';
import { inferOperator, buildClaimEvent } from '../engine/claims.js';
import { ClaimStore } from '../matrix/claim-store.js';

/**
 * useObservation — handles observation panel save flow.
 *
 * Infers operator, builds claim event, emits to room, triggers refresh.
 *
 * @param {string} roomId
 * @param {string} agent - current user's Matrix ID
 * @param {string} agentRole
 * @param {function} onRefresh - called after save to refresh stacks
 */
export default function useObservation(roomId, agent, agentRole, onRefresh) {
  const save = useCallback(async (fieldKey, newClaim, ops) => {
    if (!roomId) throw new Error('No room ID');
    if (!ops?.length) throw new Error('No operations to emit');

    // Build the event
    const label = `${agentRole} updated ${fieldKey}`;
    const claimEvent = buildClaimEvent(agent, agentRole, ops, label);

    // Emit to room timeline
    await ClaimStore.emitEvent(roomId, claimEvent);

    // Refresh stacks
    onRefresh?.();
  }, [roomId, agent, agentRole, onRefresh]);

  return { save };
}
