import { useState, useMemo } from 'react';
import Icon from './common/Icon.jsx';
import { OperatorBadge, PhaseBadge } from './common/Badge.jsx';
import { replayTo } from '../engine/claims.js';
import { getField } from '../schema/fields.js';

/**
 * TimelineView — full-screen modal for stepping through the event stream.
 *
 * Range slider over events (steps by event, not arbitrary date).
 * Left panel: what changed at this event (diff view).
 * Right panel: full case state snapshot at this point.
 * Prev/Next buttons. Changed fields highlighted.
 *
 * In transparency mode: raw ops array with operator tags.
 *
 * @param {object[]} events - full event stream
 * @param {boolean} transparencyMode
 */
export default function TimelineView({ events = [], transparencyMode = false }) {
  const sorted = useMemo(() =>
    [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  );

  const [currentIdx, setCurrentIdx] = useState(sorted.length - 1);
  const currentEvent = sorted[currentIdx];

  // Replay up to current event
  const snapshot = useMemo(() => {
    if (!currentEvent) return new Map();
    return replayTo(sorted.slice(0, currentIdx + 1));
  }, [sorted, currentIdx, currentEvent]);

  // Previous snapshot for diff
  const prevSnapshot = useMemo(() => {
    if (currentIdx <= 0) return new Map();
    return replayTo(sorted.slice(0, currentIdx));
  }, [sorted, currentIdx]);

  // Compute diff: which fields changed
  const changedFields = useMemo(() => {
    const changes = [];
    if (!currentEvent) return changes;

    for (const op of (currentEvent.ops || [])) {
      if (op.field && op.value !== undefined) {
        const prevStack = prevSnapshot.get(op.field);
        const prevValue = prevStack?.claims?.[0]?.value;
        changes.push({
          field: op.field,
          op: op.op,
          oldValue: prevValue || null,
          newValue: op.value,
          claimId: op.claimId,
        });
      }
    }
    return changes;
  }, [currentEvent, prevSnapshot]);

  if (!sorted.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-3)' }}>
        No events to display.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrubber */}
      <div className="timeline-scrubber">
        <button
          className="btn-icon"
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx <= 0}
        >
          <Icon name="skip-back" size={16} color="var(--tx-2)" />
        </button>

        <input
          type="range"
          min={0}
          max={sorted.length - 1}
          value={currentIdx}
          onChange={(e) => setCurrentIdx(Number(e.target.value))}
        />

        <button
          className="btn-icon"
          onClick={() => setCurrentIdx(Math.min(sorted.length - 1, currentIdx + 1))}
          disabled={currentIdx >= sorted.length - 1}
        >
          <Icon name="skip-forward" size={16} color="var(--tx-2)" />
        </button>

        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setCurrentIdx(sorted.length - 1)}
        >
          Jump to today
        </button>

        <span style={{ fontSize: 11, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>
          {currentIdx + 1} / {sorted.length}
        </span>
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
        {/* Left: Diff view */}
        <div className="scroll-y" style={{ borderRight: '1px solid var(--border-0)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Changes at this event
          </div>

          {currentEvent && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--tx-0)', fontWeight: 600, marginBottom: 4 }}>
                {currentEvent.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                {formatAgent(currentEvent.agent)} · {formatTime(currentEvent.date)}
              </div>
            </div>
          )}

          {changedFields.length > 0 ? (
            <div className="stack">
              {changedFields.map((change, i) => {
                const fieldDef = getField(change.field);
                return (
                  <div key={i} className="timeline-diff">
                    <div style={{ fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>
                      {fieldDef?.label || change.field}
                    </div>
                    {change.oldValue && (
                      <div className="removed">{change.oldValue}</div>
                    )}
                    <div className="added">{change.newValue}</div>
                    {transparencyMode && (
                      <div style={{ marginTop: 4 }}>
                        <OperatorBadge operator={change.op} showDesc />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic' }}>
              No field value changes at this event.
            </div>
          )}

          {/* Raw ops in transparency mode */}
          {transparencyMode && currentEvent?.ops && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Raw Operations
              </div>
              <pre style={{
                background: 'var(--bg-3)',
                padding: '8px 12px',
                borderRadius: 'var(--r-sm)',
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                overflow: 'auto',
                color: 'var(--tx-2)',
              }}>
                {JSON.stringify(currentEvent.ops, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Snapshot view */}
        <div className="scroll-y" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Case state at this point
          </div>

          {snapshot.size > 0 ? (
            <div className="stack">
              {[...snapshot.entries()].map(([fieldKey, stack]) => {
                const fieldDef = getField(fieldKey);
                const topClaim = stack.claims?.[0];
                const isChanged = changedFields.some(c => c.field === fieldKey);

                return (
                  <div
                    key={fieldKey}
                    style={{
                      padding: '8px 12px',
                      background: isChanged ? 'var(--blue-dim)' : 'var(--bg-3)',
                      borderRadius: 'var(--r-sm)',
                      border: isChanged ? '1px solid var(--blue-dim)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx-1)' }}>
                        {fieldDef?.label || fieldKey}
                      </span>
                      <PhaseBadge phase={topClaim?.phase} />
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx-0)', marginTop: 2 }}>
                      {topClaim?.value || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic' }}>
              No case state yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAgent(agent) {
  if (!agent) return 'Unknown';
  if (agent.startsWith('@')) return agent.split(':')[0].slice(1);
  return agent;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
