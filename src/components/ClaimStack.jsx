import { useState } from 'react';
import { PhaseBadge, ModeBadge, OperatorBadge } from './common/Badge.jsx';
import Icon from './common/Icon.jsx';
import { PHASES } from '../engine/operators.js';

/**
 * ClaimStack — renders the full ordered claim stack for a field.
 *
 * Each claim: value, agent, timestamp, mode badge, phase badge.
 * In transparency mode: operator tag with triad color.
 * Superseded claims are dimmed with supersession chain links.
 *
 * @param {object[]} claims - ordered claim array (newest first)
 * @param {object} conLinks - { claimId: supersedes }
 * @param {boolean} transparencyMode - show EO operator tags
 * @param {boolean} expanded - show superseded claims
 */
export default function ClaimStack({ claims = [], conLinks = {}, transparencyMode = false, expanded: initialExpanded = false }) {
  const [expanded, setExpanded] = useState(initialExpanded);

  if (!claims.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--tx-3)', fontStyle: 'italic', padding: '4px 0' }}>
        No claims recorded.
      </div>
    );
  }

  const activeClaims = claims.filter(c => c.phase !== PHASES.SUPERSEDED);
  const supersededClaims = claims.filter(c => c.phase === PHASES.SUPERSEDED);

  return (
    <div>
      {/* Active claims */}
      {activeClaims.map(claim => (
        <ClaimRow key={claim.id} claim={claim} transparencyMode={transparencyMode} conLinks={conLinks} />
      ))}

      {/* Superseded toggle */}
      {supersededClaims.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--tx-3)',
            padding: '6px 0',
            marginTop: 4,
          }}
        >
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color="var(--tx-3)" />
          {expanded ? 'Hide' : 'Show'} {supersededClaims.length} prior record{supersededClaims.length !== 1 ? 's' : ''}
        </button>
      )}

      {/* Superseded claims */}
      {expanded && supersededClaims.map(claim => (
        <ClaimRow
          key={claim.id}
          claim={claim}
          transparencyMode={transparencyMode}
          conLinks={conLinks}
          dimmed
        />
      ))}
    </div>
  );
}

function ClaimRow({ claim, transparencyMode, conLinks, dimmed = false }) {
  const agentName = formatAgent(claim.agent);
  const time = formatTime(claim.timestamp);
  const supersededBy = Object.entries(conLinks).find(([, v]) => v === claim.id)?.[0];

  return (
    <div className={`claim-row ${dimmed ? 'claim-superseded' : ''}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="claim-value">{claim.value || '—'}</div>
        <div className="claim-meta">
          <span>{agentName}</span>
          <span>·</span>
          <span>{time}</span>
          <ModeBadge mode={claim.mode} />
          <PhaseBadge phase={claim.phase} />
          {transparencyMode && <OperatorBadge operator={claim.operator} />}
          {supersededBy && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5 }}>
              ← {supersededBy}
            </span>
          )}
        </div>
        {claim.note && (
          <div style={{ fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic', marginTop: 4 }}>
            {claim.note}
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
