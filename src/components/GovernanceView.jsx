import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import ProposalDetail from './ProposalDetail.jsx';
import { GovernanceStore } from '../matrix/governance-store.js';
import { MatrixService } from '../matrix/service.js';
import { EVT, PROPOSAL_STATUSES } from '../engine/operators.js';

const STATUS_COLORS = {
  submitted: 'blue',
  discussion: 'gold',
  consent_round: 'purple',
  resolved: 'green',
  adopted: 'green',
  blocked: 'red',
};

/**
 * GovernanceView — proposals list + create + governance rhythms.
 */
export default function GovernanceView() {
  const [govRooms, setGovRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [rhythms, setRhythms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposalId, setSelectedProposalId] = useState(null);
  const [tab, setTab] = useState('active'); // active | archived | rhythms

  // Create proposal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', type: 'general' });

  const loadGovRooms = useCallback(async () => {
    setLoading(true);
    try {
      const scanned = await MatrixService.scanRooms([EVT.IDENTITY, EVT.TEAM_META]);
      const rooms = scanned.filter(r => {
        const t = r.state[EVT.IDENTITY]?.account_type;
        return t === 'team' || t === 'network' || t === 'organization';
      });
      setGovRooms(rooms);
      if (rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(rooms[0].roomId);
      }
    } catch (err) {
      console.error('Failed to load governance rooms:', err);
    }
    setLoading(false);
  }, [activeRoomId]);

  const loadProposals = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const [props, rhyth] = await Promise.all([
        GovernanceStore.loadProposals(activeRoomId),
        GovernanceStore.loadRhythms(activeRoomId),
      ]);
      setProposals(props);
      setRhythms(rhyth);
    } catch (err) {
      console.error('Failed to load proposals:', err);
    }
  }, [activeRoomId]);

  useEffect(() => { loadGovRooms(); }, [loadGovRooms]);
  useEffect(() => { loadProposals(); }, [loadProposals]);

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !activeRoomId) return;
    try {
      await GovernanceStore.createProposal(activeRoomId, createForm);
      setShowCreate(false);
      setCreateForm({ title: '', description: '', type: 'general' });
      await loadProposals();
    } catch (err) {
      console.error('Failed to create proposal:', err);
    }
  };

  if (selectedProposalId && activeRoomId) {
    return (
      <ProposalDetail
        roomId={activeRoomId}
        proposalId={selectedProposalId}
        onBack={() => { setSelectedProposalId(null); loadProposals(); }}
      />
    );
  }

  const activeProposals = proposals.filter(p =>
    ['submitted', 'discussion', 'consent_round'].includes(p.status)
  );
  const archivedProposals = proposals.filter(p =>
    ['resolved', 'adopted', 'blocked'].includes(p.status)
  );

  if (loading) {
    return <div className="empty-state"><div className="empty-state-desc">Loading governance...</div></div>;
  }

  return (
    <div>
      {/* Room selector */}
      {govRooms.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {govRooms.map(r => (
            <button
              key={r.roomId}
              className={`btn-ghost btn-sm`}
              onClick={() => { setActiveRoomId(r.roomId); setSelectedProposalId(null); }}
              style={activeRoomId === r.roomId ? { background: 'var(--gold-dim)', color: 'var(--gold)' } : {}}
            >
              {r.state[EVT.TEAM_META]?.name || r.roomName}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--bd)' }}>
        {[
          { key: 'active', label: `Active (${activeProposals.length})`, icon: 'message-circle' },
          { key: 'archived', label: `Archived (${archivedProposals.length})`, icon: 'archive' },
          { key: 'rhythms', label: `Rhythms (${rhythms.length})`, icon: 'calendar' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--tx-0)' : 'var(--tx-3)',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)} style={{ alignSelf: 'center' }}>
          <Icon name="plus" size={12} /> New Proposal
        </button>
      </div>

      {/* Active proposals */}
      {tab === 'active' && (
        activeProposals.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 300 }}>
            <Icon name="vote" size={40} color="var(--tx-3)" className="empty-state-icon" />
            <div className="empty-state-title">No Active Proposals</div>
            <div className="empty-state-desc">
              Proposals enable consent-based governance. Create one to propose a schema change, policy update, or team decision.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {activeProposals.map(p => (
              <ProposalCard key={p.proposalId} proposal={p} onClick={() => setSelectedProposalId(p.proposalId)} />
            ))}
          </div>
        )
      )}

      {/* Archived proposals */}
      {tab === 'archived' && (
        archivedProposals.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 200 }}>
            <div className="empty-state-desc">No archived proposals.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {archivedProposals.map(p => (
              <ProposalCard key={p.proposalId} proposal={p} onClick={() => setSelectedProposalId(p.proposalId)} />
            ))}
          </div>
        )
      )}

      {/* Rhythms */}
      {tab === 'rhythms' && (
        <div>
          {rhythms.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 200 }}>
              <Icon name="calendar" size={32} color="var(--tx-3)" />
              <div className="empty-state-title">No Governance Rhythms</div>
              <div className="empty-state-desc">
                Rhythms are recurring reviews: Monthly Schema Review, Quarterly Alignment, Annual Constitutional.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {rhythms.map(r => (
                <div key={r.rhythmId} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx-0)' }}>{r.name}</div>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{r.frequency}</span>
                  </div>
                  {r.description && <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 4 }}>{r.description}</div>}
                  {r.nextDue && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>Next: {r.nextDue}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Proposal Modal */}
      {showCreate && (
        <Modal title="New Proposal" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateProposal}>
            <div className="field-group">
              <label>Title</label>
              <input type="text" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Add housing intake form" autoFocus />
            </div>
            <div className="field-group">
              <label>Type</label>
              <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}>
                <option value="general">General</option>
                <option value="schema_change">Schema Change</option>
                <option value="policy_update">Policy Update</option>
                <option value="resource_allocation">Resource Allocation</option>
                <option value="membership">Membership</option>
              </select>
            </div>
            <div className="field-group">
              <label>Description</label>
              <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the proposal..." />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!createForm.title.trim()}>Submit Proposal</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProposalCard({ proposal, onClick }) {
  const positionCount = Object.keys(proposal.positions || {}).length;
  const statusColor = STATUS_COLORS[proposal.status] || 'orange';

  return (
    <button
      className="card"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx-0)' }}>{proposal.title}</span>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            background: `var(--${statusColor}-dim, var(--orange-dim))`,
            color: `var(--${statusColor}, var(--orange))`,
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            {proposal.status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>
          {proposal.type} · {positionCount} position{positionCount !== 1 ? 's' : ''} ·
          {proposal.created ? ` ${new Date(proposal.created).toLocaleDateString()}` : ''}
        </div>
      </div>
      <Icon name="chevron-right" size={16} color="var(--tx-3)" />
    </button>
  );
}
