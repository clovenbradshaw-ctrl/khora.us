import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import { GovernanceStore } from '../matrix/governance-store.js';
import { MatrixService } from '../matrix/service.js';
import { CONSENT_POSITIONS, PROPOSAL_STATUSES } from '../engine/operators.js';

const POSITION_LABELS = {
  adopt_as_is: 'Adopt as-is',
  adopt_with_extension: 'Adopt with extension',
  needs_modification: 'Needs modification',
  cannot_adopt: 'Cannot adopt (block)',
};

const POSITION_COLORS = {
  adopt_as_is: 'green',
  adopt_with_extension: 'blue',
  needs_modification: 'gold',
  cannot_adopt: 'red',
};

/**
 * ProposalDetail — single proposal view with consent round.
 */
export default function ProposalDetail({ roomId, proposalId, onBack }) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [positionNotes, setPositionNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const proposals = await GovernanceStore.loadProposals(roomId);
      const p = proposals.find(p => p.proposalId === proposalId);
      setProposal(p || null);
    } catch (err) {
      console.error('Failed to load proposal:', err);
    }
    setLoading(false);
  }, [roomId, proposalId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitPosition = async (position) => {
    setSubmitting(true);
    try {
      const result = await GovernanceStore.submitPosition(roomId, proposalId, position, positionNotes);
      if (result.resolved) {
        await GovernanceStore.updateProposalStatus(roomId, proposalId, result.outcome);
      }
      setPositionNotes('');
      await load();
    } catch (err) {
      console.error('Failed to submit position:', err);
    }
    setSubmitting(false);
  };

  const handleAdvanceStatus = async (newStatus) => {
    try {
      await GovernanceStore.updateProposalStatus(roomId, proposalId, newStatus);
      await load();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return <div className="empty-state"><div className="empty-state-desc">Loading...</div></div>;
  }

  if (!proposal) {
    return <div className="empty-state"><div className="empty-state-desc">Proposal not found</div></div>;
  }

  const positions = proposal.positions || {};
  const myPosition = positions[MatrixService.userId];
  const isActive = ['submitted', 'discussion', 'consent_round'].includes(proposal.status);
  const isCreator = proposal.created_by === MatrixService.userId;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-icon" onClick={onBack}>
          <Icon name="arrow-left" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-0)' }}>{proposal.title}</div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
            {proposal.type} · by {proposal.created_by} · {proposal.created ? new Date(proposal.created).toLocaleDateString() : ''}
          </div>
        </div>
        <span style={{
          fontSize: 11, padding: '4px 8px', borderRadius: 4,
          background: `var(--${proposal.status === 'adopted' ? 'green' : proposal.status === 'blocked' ? 'red' : 'gold'}-dim)`,
          color: `var(--${proposal.status === 'adopted' ? 'green' : proposal.status === 'blocked' ? 'red' : 'gold'})`,
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          {proposal.status}
        </span>
      </div>

      {/* Description */}
      {proposal.description && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--tx-1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {proposal.description}
          </div>
        </div>
      )}

      {/* Status controls (creator only) */}
      {isCreator && isActive && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 8 }}>Advance Status</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {proposal.status === 'submitted' && (
              <button className="btn-ghost btn-sm" onClick={() => handleAdvanceStatus('discussion')}>
                <Icon name="message-circle" size={12} /> Open Discussion
              </button>
            )}
            {proposal.status === 'discussion' && (
              <button className="btn-ghost btn-sm" onClick={() => handleAdvanceStatus('consent_round')}>
                <Icon name="vote" size={12} /> Start Consent Round
              </button>
            )}
            {proposal.status === 'consent_round' && (
              <button className="btn-ghost btn-sm" onClick={() => handleAdvanceStatus('adopted')} style={{ color: 'var(--green)' }}>
                <Icon name="check" size={12} /> Mark Adopted
              </button>
            )}
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 12 }}>
          Positions ({Object.keys(positions).length})
        </div>

        {Object.keys(positions).length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>No positions submitted yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(positions).map(([userId, pos]) => {
              const posColor = POSITION_COLORS[pos.position] || 'orange';
              return (
                <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div className="avatar avatar-sm" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', width: 24, height: 24, fontSize: 10 }}>
                    {userId.charAt(1)?.toUpperCase() || '?'}
                  </div>
                  <span style={{ flex: 1, color: 'var(--tx-0)' }}>{userId}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: `var(--${posColor}-dim)`, color: `var(--${posColor})`,
                    fontWeight: 600,
                  }}>
                    {POSITION_LABELS[pos.position] || pos.position}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit position (if consent round and no position yet or active) */}
      {isActive && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 8 }}>
            {myPosition ? 'Update Your Position' : 'Submit Your Position'}
          </div>
          <div className="field-group" style={{ marginBottom: 12 }}>
            <label>Notes (optional)</label>
            <textarea
              value={positionNotes}
              onChange={e => setPositionNotes(e.target.value)}
              rows={2}
              placeholder="Explain your position..."
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CONSENT_POSITIONS.map(pos => {
              const posColor = POSITION_COLORS[pos] || 'orange';
              const isSelected = myPosition?.position === pos;
              return (
                <button
                  key={pos}
                  className="btn-ghost btn-sm"
                  onClick={() => handleSubmitPosition(pos)}
                  disabled={submitting}
                  style={{
                    background: isSelected ? `var(--${posColor}-dim)` : undefined,
                    color: `var(--${posColor})`,
                    borderColor: isSelected ? `var(--${posColor})` : undefined,
                  }}
                >
                  {POSITION_LABELS[pos]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
