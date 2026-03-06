import { useState } from 'react';
import Icon from './common/Icon.jsx';
import { PhaseBadge, ModeBadge, OperatorBadge } from './common/Badge.jsx';
import ClaimStack from './ClaimStack.jsx';
import { resolvePhase, getActiveClaims } from '../engine/claims.js';
import { getField } from '../schema/fields.js';

/**
 * FieldCard — compact field row that expands into a basin for observations.
 *
 * Collapsed: single dense row with label, value, and actions.
 * Expanded: full claim stack history.
 * +: opens observation panel.
 * Click row: opens observation panel for editing.
 */
export default function FieldCard({ fieldKey, stack, transparencyMode = false, onObserve }) {
  const [expanded, setExpanded] = useState(false);

  const fieldDef = getField(fieldKey);
  const phase = resolvePhase(stack);
  const activeClaims = getActiveClaims(stack);
  const topClaim = activeClaims[0];
  const hasData = !!topClaim;
  const hasHistory = stack?.claims?.length > 1;

  const handleRowClick = () => {
    if (onObserve) {
      onObserve(fieldKey, stack);
    } else if (hasHistory) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`field-card${expanded ? ' field-card--expanded' : ''}${hasData ? '' : ' field-card--empty'}`}>
      {/* Single compact row: label + value + actions */}
      <div
        className="field-card-row"
        onClick={handleRowClick}
        style={{ cursor: onObserve ? 'pointer' : (hasHistory ? 'pointer' : undefined) }}
        title={onObserve ? (hasData ? 'Click to edit' : 'Click to add data') : undefined}
      >
        <span className="field-card-label">
          {fieldDef?.label || fieldKey}
        </span>

        {phase && <PhaseBadge phase={phase} />}
        {transparencyMode && topClaim?.operator && (
          <OperatorBadge operator={topClaim.operator} />
        )}

        <span className="field-card-value">
          {hasData ? (topClaim.value || '—') : (
            <span className="field-card-empty">—</span>
          )}
        </span>

        {hasData && (
          <span className="field-card-meta">
            <span>{formatAgent(topClaim.agent)}</span>
            <span className="field-card-meta-sep">·</span>
            <span>{formatTime(topClaim.timestamp)}</span>
            <ModeBadge mode={topClaim.mode} />
          </span>
        )}

        <span className="field-card-actions">
          {hasHistory && (
            <button
              type="button"
              className="btn-icon"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              title={expanded ? 'Collapse history' : 'Expand history'}
            >
              <Icon
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color="var(--tx-3)"
              />
            </button>
          )}
          {onObserve && (
            <button
              type="button"
              className="btn-icon"
              onClick={(e) => { e.stopPropagation(); onObserve(fieldKey, stack); }}
              title="Add observation"
            >
              <Icon name="plus" size={12} color="var(--blue)" />
            </button>
          )}
        </span>
      </div>

      {/* Note line */}
      {hasData && topClaim.note && !expanded && (
        <div className="field-card-note">{topClaim.note}</div>
      )}

      {/* Expanded: full claim stack */}
      {expanded && stack?.claims && (
        <div className="field-card-detail">
          {topClaim?.note && (
            <div className="field-card-note" style={{ marginBottom: 6 }}>{topClaim.note}</div>
          )}
          <ClaimStack
            claims={stack.claims}
            conLinks={stack.conLinks || {}}
            transparencyMode={transparencyMode}
            expanded={true}
          />
        </div>
      )}
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
