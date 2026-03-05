import { useState, useEffect, useCallback } from 'react';
import { replayTo } from '../engine/claims.js';
import { ClaimStore } from '../matrix/claim-store.js';

/**
 * useClaimStacks — loads events from a room and replays to build claim stacks.
 *
 * Returns { stacks, events, loading, error, refresh }.
 * stacks: Map<fieldKey, { claims, isHeld, isContested, conLinks }>
 * events: raw event array (for timeline view / audit panel)
 */
export default function useClaimStacks(roomId) {
  const [events, setEvents] = useState([]);
  const [stacks, setStacks] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAndReplay = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(null);

    try {
      const loadedEvents = await ClaimStore.loadEvents(roomId);
      setEvents(loadedEvents);

      const computed = replayTo(loadedEvents);
      setStacks(computed);

      // Write snapshots for fast future reads
      for (const [fieldKey, stack] of computed) {
        try {
          await ClaimStore.snapshotStack(roomId, fieldKey, stack);
        } catch {
          // Non-critical — snapshot is cache only
        }
      }
    } catch (e) {
      setError(e.message);

      // Fallback: try loading from snapshots
      try {
        const snapshots = await ClaimStore.loadAllSnapshots(roomId);
        if (snapshots.size > 0) {
          setStacks(snapshots);
        }
      } catch {
        // Could not load snapshots either
      }
    }

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    loadAndReplay();
  }, [loadAndReplay]);

  return {
    stacks,
    events,
    loading,
    error,
    refresh: loadAndReplay,
  };
}
