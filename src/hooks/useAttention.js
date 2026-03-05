import { useMemo } from 'react';
import { resolvePhase, getActiveClaims } from '../engine/claims.js';
import { PHASES } from '../engine/operators.js';

/**
 * useAttention — computes attention items from claim stacks.
 *
 * An item enters the attention strip when:
 * 1. Phase is contested — at least two claims from different agents
 * 2. Phase is held — worker explicitly held open; due within 7 days or past
 * 3. dueDate on settled claim — follow-up within 7 days
 *
 * Returns sorted array of { fieldKey, type, message, dueDate }.
 */
export default function useAttention(stacks) {
  return useMemo(() => {
    if (!stacks || stacks.size === 0) return [];

    const items = [];
    const now = new Date();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    for (const [fieldKey, stack] of stacks) {
      const phase = resolvePhase(stack);

      // Contested — multiple incompatible claims
      if (phase === PHASES.CONTESTED || stack.isContested) {
        const active = getActiveClaims(stack);
        items.push({
          fieldKey,
          type: 'contested',
          message: null, // Use default in AttentionStrip
          priority: 0,   // Highest
        });
      }

      // Held — intentional uncertainty
      if (phase === PHASES.HELD || stack.isHeld) {
        const topClaim = stack.claims?.[0];
        // Check if there's a dueDate-like field (from next_contact_date or note context)
        items.push({
          fieldKey,
          type: 'held',
          message: null,
          dueDate: topClaim?.dueDate || null,
          priority: 1,
        });
      }

      // Settled with upcoming follow-up
      if (phase === PHASES.SETTLED && fieldKey === 'next_contact_date') {
        const topClaim = stack.claims?.[0];
        if (topClaim?.value) {
          const dueDate = new Date(topClaim.value);
          const diff = dueDate.getTime() - now.getTime();
          if (diff < sevenDays) {
            items.push({
              fieldKey,
              type: 'due',
              message: null,
              dueDate: topClaim.value,
              priority: diff < 0 ? 0 : 2,
            });
          }
        }
      }
    }

    // Sort by priority (contested first, then held, then due)
    items.sort((a, b) => a.priority - b.priority);

    return items;
  }, [stacks]);
}
