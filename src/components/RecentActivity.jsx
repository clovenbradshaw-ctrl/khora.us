import { OperatorBadge } from './common/Badge.jsx';
import { getField } from '../schema/fields.js';

/**
 * RecentActivity — last 5 events, reverse chronological.
 * Event label, date, agent, first 2 field changes.
 *
 * @param {object[]} events
 * @param {boolean} transparencyMode
 */
export default function RecentActivity({ events = [], transparencyMode = false }) {
  const recent = [...events]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (!recent.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic' }}>
        No recent activity.
      </div>
    );
  }

  return (
    <div className="stack">
      {recent.map((event, i) => {
        const fieldChanges = (event.ops || [])
          .filter(op => op.field && op.value !== undefined)
          .slice(0, 2);

        return (
          <div key={event.id || i} style={{
            padding: '10px 12px',
            background: 'var(--bg-3)',
            borderRadius: 'var(--r-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', flex: 1 }}>
                {event.label}
              </span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>
                {formatTime(event.date)}
              </span>
            </div>

            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: fieldChanges.length ? 6 : 0 }}>
              {formatAgent(event.agent)}
              {event.agentRole && ` · ${event.agentRole}`}
            </div>

            {fieldChanges.map((op, j) => {
              const fieldDef = getField(op.field);
              return (
                <div key={j} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--tx-2)',
                  marginTop: 2,
                }}>
                  {transparencyMode && <OperatorBadge operator={op.op} />}
                  <span style={{ fontWeight: 500 }}>{fieldDef?.label || op.field}:</span>
                  <span>{op.value}</span>
                </div>
              );
            })}

            {(event.ops || []).filter(op => op.field && op.value !== undefined).length > 2 && (
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4 }}>
                +{(event.ops || []).filter(op => op.field && op.value !== undefined).length - 2} more changes
              </div>
            )}
          </div>
        );
      })}
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
