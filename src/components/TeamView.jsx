import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import TeamDetail from './TeamDetail.jsx';
import { TeamStore } from '../matrix/team-store.js';
import { CONSENT_MODES } from '../engine/operators.js';

/**
 * TeamView — list of teams + create team.
 */
export default function TeamView() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', consentMode: 'lead_decides', color: 'purple' });
  const [creating, setCreating] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const result = await TeamStore.loadTeams();
      setTeams(result);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      await TeamStore.createTeam(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', consentMode: 'lead_decides', color: 'purple' });
      await loadTeams();
    } catch (err) {
      console.error('Failed to create team:', err);
    }
    setCreating(false);
  };

  if (selectedTeam) {
    return (
      <TeamDetail
        roomId={selectedTeam}
        onBack={() => { setSelectedTeam(null); loadTeams(); }}
      />
    );
  }

  const TEAM_COLORS = ['purple', 'blue', 'teal', 'green', 'gold', 'orange', 'red', 'pink'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>
          {teams.length} team{teams.length !== 1 ? 's' : ''}
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={12} /> New Team
        </button>
      </div>

      {loading ? (
        <div className="empty-state" style={{ minHeight: 200 }}>
          <div className="empty-state-desc">Loading teams...</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 300 }}>
          <Icon name="users" size={40} color="var(--tx-3)" className="empty-state-icon" />
          <div className="empty-state-title">No Teams</div>
          <div className="empty-state-desc">
            Create a team to collaborate with others. Teams have shared schemas, resources, and governance.
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 16 }}>
            <Icon name="plus" size={14} /> Create First Team
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {teams.map(team => (
            <button
              key={team.roomId}
              className="card"
              onClick={() => setSelectedTeam(team.roomId)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', border: 'none', textAlign: 'left', width: '100%' }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `var(--${team.meta.color || 'purple'}-dim, var(--purple-dim))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="users" size={18} color={`var(--${team.meta.color || 'purple'}, var(--purple))`} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-0)' }}>
                  {team.meta.name || team.roomName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                  {team.members.length} member{team.members.length !== 1 ? 's' : ''} · {team.meta.consent_mode || 'lead_decides'}
                </div>
              </div>
              <Icon name="chevron-right" size={16} color="var(--tx-3)" />
            </button>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreate && (
        <Modal title="Create Team" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="field-group">
              <label>Team Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Outreach Team"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label>Description</label>
              <textarea
                value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this team do?"
                rows={3}
              />
            </div>
            <div className="field-group">
              <label>Consent Mode</label>
              <select
                value={createForm.consentMode}
                onChange={e => setCreateForm(f => ({ ...f, consentMode: e.target.value }))}
              >
                {CONSENT_MODES.map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TEAM_COLORS.map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCreateForm(f => ({ ...f, color: c }))}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: createForm.color === c ? '2px solid var(--tx-0)' : '2px solid transparent',
                      background: `var(--${c}-dim, var(--purple-dim))`, cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={creating || !createForm.name.trim()}>
                {creating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
