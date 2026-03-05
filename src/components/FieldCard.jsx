import { useState } from 'react';
import Icon from './common/Icon.jsx';
import { PhaseBadge, OperatorBadge } from './common/Badge.jsx';
import ClaimStack from './ClaimStack.jsx';
import { resolvePhase, getActiveClaims } from '../engine/claims.js';
import { getField } from '../schema/fields.js';

/**
 * FieldCard — displays a single field with its claim stack.
 *
 * Header: section icon, field label, phase badge.
 * Body: active claim value, agent, timestamp, mode.
 * Expand: full claim stack history.
 * +: opens observation panel.
 *
 * @param {string} fieldKey
 * @param {object} stack - { claims, isHeld, isContested, conLinks }
 * @param {boolean} transparencyMode - show operator tags
 * @param {function} onObserve - callback to open observation panel
 */
export default function FieldCard({ fieldKey, stack, transparencyMode = false, onObserve }) {
  const [expanded, setExpanded] = useState(false);

  const fieldDef = getField(fieldKey);
  const phase = resolvePhase(stack);
  const activeClaims = getActiveClaims(stack);
  const topClaim = activeClaims[0];

  return (
    <div className="field-card">
      {/* Header */}
      <div className="field-card-header">
        {fieldDef?.sectionIcon && (
          <Icon name={fieldDef.sectionIcon} size={14} color="var(--tx-2)" />
        )}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx-0)' }}>
          {fieldDef?.label || fieldKey}
        </span>
        {phase && <PhaseBadge phase={phase} />}
        {transparencyMode && topClaim?.operator && (
          <OperatorBadge operator={topClaim.operator} />
        )}

        <div className="field-card-actions">
          {stack?.claims?.length > 1 && (
            <button
              className="btn-icon"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse history' : 'Expand history'}
            >
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="var(--tx-2)" />
            </button>
          )}
          {onObserve && (
            <button
              className="btn-icon"
              onClick={() => onObserve(fieldKey, stack)}
              title="Add observation"
            >
              <Icon name="plus" size={14} color="var(--blue)" />
            </button>
          )}
        </div>
      </div>

      {/* Body — top claim */}
      <div className="field-card-body">
        {topClaim ? (
          <div>
            <div style={{ fontSize: 14, color: 'var(--tx-0)', fontWeight: 500, marginBottom: 4 }}>
              {topClaim.value || '—'}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--tx-3)' }}>
              <span>{formatAgent(topClaim.agent)}</span>
              <span>·</span>
              <span>{formatTime(topClaim.timestamp)}</span>
            </div>
            {topClaim.note && (
              <div style={{ fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic', marginTop: 4 }}>
                {topClaim.note}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic' }}>
            No data recorded.
          </div>
        )}

        {/* Expanded: full stack */}
        {expanded && stack?.claims && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-0)', paddingTop: 8 }}>
            <ClaimStack
              claims={stack.claims}
              conLinks={stack.conLinks || {}}
              transparencyMode={transparencyMode}
              expanded={true}
            />
          </div>
        )}
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
