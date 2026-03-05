import { useState, useMemo } from 'react';
import Icon from './common/Icon.jsx';
import { OperatorBadge } from './common/Badge.jsx';
import { OP_META, OPERATOR_TRIADS, getTriad } from '../engine/operators.js';
import { replayTo, getSupersessionChain, getActiveClaims } from '../engine/claims.js';
import { getField } from '../schema/fields.js';

/**
 * AuditPanel — EO Transparency / Audit Mode.
 *
 * The key transparency feature. When active:
 * - Every FieldCard shows operator tags on claims
 * - ObservationPanel shows what operator will fire before save
 * - This panel shows:
 *   - Raw io.khora.claim.event JSON payloads
 *   - Operator classification (triad, Greek letter, verb)
 *   - Supersession chain graph
 *   - Replay verification indicator
 *
 * Toggle persisted in localStorage.
 *
 * @param {object[]} events - full event stream
 * @param {Map} currentStacks - current replayed stacks
 */
export default function AuditPanel({ events = [], currentStacks }) {
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  // Replay verification — replay from scratch and check it matches
  const replayVerified = useMemo(() => {
    if (!events.length || !currentStacks) return null;
    try {
      const replayed = replayTo(events);
      // Compare field count and top claim values
      if (replayed.size !== currentStacks.size) return false;
      for (const [key, stack] of replayed) {
        const current = currentStacks.get(key);
        if (!current) return false;
        if (stack.claims[0]?.value !== current.claims[0]?.value) return false;
      }
      return true;
    } catch {
      return false;
    }
  }, [events, currentStacks]);

  // Compute operator frequency
  const opStats = useMemo(() => {
    const counts = {};
    for (const event of events) {
      for (const op of (event.ops || [])) {
        counts[op.op] = (counts[op.op] || 0) + 1;
      }
    }
    return counts;
  }, [events]);

  // Compute all supersession chains
  const chains = useMemo(() => {
    if (!currentStacks) return [];
    const result = [];
    for (const [fieldKey, stack] of currentStacks) {
      const active = getActiveClaims(stack);
      for (const claim of active) {
        const chain = getSupersessionChain(stack, claim.id);
        if (chain.length > 1) {
          result.push({ fieldKey, chain, topClaim: claim });
        }
      }
    }
    return result;
  }, [currentStacks]);

  return (
    <div className="audit-panel">
      {/* Header */}
      <div className="audit-panel-header">
        <Icon name="code" size={14} color="var(--teal)" />
        <span>EO Audit Log</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--tx-3)' }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Replay verification */}
      <div style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--border-0)',
        fontSize: 12,
      }}>
        {replayVerified === true && (
          <>
            <Icon name="check-circle" size={14} color="var(--green)" />
            <span style={{ color: 'var(--green)' }}>Replay matches current state</span>
          </>
        )}
        {replayVerified === false && (
          <>
            <Icon name="alert-circle" size={14} color="var(--red)" />
            <span style={{ color: 'var(--red)' }}>Replay mismatch — state may be stale</span>
          </>
        )}
        {replayVerified === null && (
          <span style={{ color: 'var(--tx-3)' }}>No events to verify.</span>
        )}
      </div>

      {/* Operator stats */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-0)' }}>
        <button
          onClick={() => setShowLegend(!showLegend)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tx-2)', fontWeight: 600 }}
        >
          <Icon name={showLegend ? 'chevron-up' : 'chevron-down'} size={12} />
          Operator Legend & Stats
        </button>

        {showLegend && (
          <div style={{ marginTop: 8 }}>
            {Object.entries(OPERATOR_TRIADS).map(([key, triad]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: `var(--${triad.color})`, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {triad.label} — {triad.desc}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {triad.ops.map(opName => {
                    const meta = OP_META[opName];
                    return (
                      <div key={opName} style={{
                        padding: '4px 8px',
                        background: 'var(--bg-3)',
                        borderRadius: 'var(--r-sm)',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <OperatorBadge operator={opName} showGreek />
                        <span style={{ color: 'var(--tx-2)' }}>{meta.verb}</span>
                        <span style={{ color: 'var(--tx-3)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                          ×{opStats[opName] || 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supersession chains */}
      {chains.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-0)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-2)', marginBottom: 8 }}>
            Supersession Chains
          </div>
          {chains.map((c, i) => {
            const fieldDef = getField(c.fieldKey);
            return (
              <div key={i} style={{
                padding: '4px 8px',
                background: 'var(--bg-3)',
                borderRadius: 'var(--r-sm)',
                marginBottom: 4,
                fontSize: 11,
                fontFamily: 'var(--mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ color: 'var(--tx-2)', fontFamily: 'var(--font)', fontWeight: 600 }}>
                  {fieldDef?.label || c.fieldKey}:
                </span>
                {c.chain.map((id, j) => (
                  <span key={id}>
                    {j > 0 && <span style={{ color: 'var(--tx-3)', margin: '0 2px' }}>→</span>}
                    <span style={{ color: j === 0 ? 'var(--tx-0)' : 'var(--tx-3)' }}>{id}</span>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Event stream */}
      <div className="scroll-y" style={{ maxHeight: 400 }}>
        {[...events].reverse().map((event, i) => (
          <div key={event.id || i} className="audit-event">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--tx-1)', flex: 1 }}>{event.label}</span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>
                {formatTime(event.date)}
              </span>
              <button
                className="btn-icon"
                onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                title="Show raw event"
              >
                <Icon name="code" size={12} color="var(--tx-3)" />
              </button>
            </div>

            {/* Operator tags for ops */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {(event.ops || []).map((op, j) => (
                <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <OperatorBadge operator={op.op} showGreek />
                  {op.field && (
                    <span style={{ fontSize: 9.5, color: 'var(--tx-3)' }}>
                      {getField(op.field)?.label || op.field}
                    </span>
                  )}
                </span>
              ))}
            </div>

            {/* Expanded: raw JSON */}
            {expandedEvent === event.id && (
              <pre>{JSON.stringify(event, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
