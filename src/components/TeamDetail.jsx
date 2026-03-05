import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import { TeamStore } from '../matrix/team-store.js';
import { CONSENT_MODES } from '../engine/operators.js';
import { FIELD_TYPES } from '../schema/fields.js';

/**
 * TeamDetail — 3-tab team detail view (Overview, Schema, Activity).
 */
export default function TeamDetail({ roomId, onBack }) {
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);

  // Invite state
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviting, setInviting] = useState(false);

  // Schema add field state
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', layer: 'given' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await TeamStore.getTeamDetail(roomId);
      setDetail(d);
      if (tab === 'activity') {
        const act = await TeamStore.getActivity(roomId);
        setActivity(act);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    }
    setLoading(false);
  }, [roomId, tab]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!inviteUserId.trim()) return;
    setInviting(true);
    try {
      await TeamStore.inviteMember(roomId, inviteUserId.trim());
      setInviteUserId('');
      await load();
    } catch (err) {
      console.error('Invite failed:', err);
    }
    setInviting(false);
  };

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newField.key.trim() || !newField.label.trim()) return;
    try {
      await TeamStore.addSchemaField(roomId, newField);
      setShowAddField(false);
      setNewField({ key: '', label: '', type: 'text', layer: 'given' });
      await load();
    } catch (err) {
      console.error('Add field failed:', err);
    }
  };

  const handleRemoveField = async (fieldKey) => {
    try {
      await TeamStore.removeSchemaField(roomId, fieldKey);
      await load();
    } catch (err) {
      console.error('Remove field failed:', err);
    }
  };

  const handleUpdateMeta = async (updates) => {
    try {
      await TeamStore.updateTeamMeta(roomId, updates);
      await load();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  if (loading && !detail) {
    return <div className="empty-state"><div className="empty-state-desc">Loading...</div></div>;
  }

  if (!detail) {
    return <div className="empty-state"><div className="empty-state-desc">Team not found</div></div>;
  }

  const { meta, members, schema } = detail;
  const activeSchema = schema.filter(f => !f.removed);

  const TABS = [
    { key: 'overview', label: 'Overview', icon: 'info' },
    { key: 'schema', label: 'Schema', icon: 'database' },
    { key: 'activity', label: 'Activity', icon: 'clock' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-icon" onClick={onBack} title="Back to teams">
          <Icon name="arrow-left" size={16} />
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `var(--${meta.color || 'purple'}-dim)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="users" size={16} color={`var(--${meta.color || 'purple'})`} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-0)' }}>{meta.name}</div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{meta.description}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--bd)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--tx-0)' : 'var(--tx-3)',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Team Info */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 8 }}>Team Settings</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--tx-3)' }}>Consent Mode</span>
                <select
                  value={meta.consent_mode || 'lead_decides'}
                  onChange={e => handleUpdateMeta({ consent_mode: e.target.value })}
                  style={{ fontSize: 12 }}
                >
                  {CONSENT_MODES.map(m => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--tx-3)' }}>Created</span>
                <span>{meta.created ? new Date(meta.created).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)' }}>
                Members ({members.length})
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {members.map(m => (
                <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div className="avatar avatar-sm" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', width: 24, height: 24, fontSize: 10 }}>
                    {(m.userId || '?').charAt(1)?.toUpperCase() || '?'}
                  </div>
                  <span style={{ flex: 1, color: 'var(--tx-0)' }}>{m.userId}</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase' }}>{m.role}</span>
                </div>
              ))}
            </div>
            {/* Invite */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                type="text"
                placeholder="@user:server"
                value={inviteUserId}
                onChange={e => setInviteUserId(e.target.value)}
                style={{ flex: 1, fontSize: 12 }}
              />
              <button className="btn-primary btn-sm" onClick={handleInvite} disabled={inviting || !inviteUserId.trim()}>
                {inviting ? '...' : 'Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Tab */}
      {tab === 'schema' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{activeSchema.length} field{activeSchema.length !== 1 ? 's' : ''}</div>
            <button className="btn-primary btn-sm" onClick={() => setShowAddField(true)}>
              <Icon name="plus" size={12} /> Add Field
            </button>
          </div>

          {activeSchema.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 200 }}>
              <Icon name="database" size={32} color="var(--tx-3)" />
              <div className="empty-state-title">No Schema Fields</div>
              <div className="empty-state-desc">Add fields to define what data this team tracks.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {activeSchema.map(field => (
                <div key={field.key} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-0)' }}>{field.label || field.key}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                      {field.type} · {field.layer} · <code style={{ fontSize: 10 }}>{field.key}</code>
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => handleRemoveField(field.key)} title="Remove field">
                    <Icon name="x" size={14} color="var(--red)" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Field Form */}
          {showAddField && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <form onSubmit={handleAddField}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="field-group">
                    <label>Field Key</label>
                    <input type="text" value={newField.key} onChange={e => setNewField(f => ({ ...f, key: e.target.value }))} placeholder="e.g. housing_status" />
                  </div>
                  <div className="field-group">
                    <label>Label</label>
                    <input type="text" value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Housing Status" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Type</label>
                      <select value={newField.type} onChange={e => setNewField(f => ({ ...f, type: e.target.value }))}>
                        {Object.values(FIELD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Layer</label>
                      <select value={newField.layer} onChange={e => setNewField(f => ({ ...f, layer: e.target.value }))}>
                        <option value="given">given</option>
                        <option value="framework">framework</option>
                        <option value="meant">meant</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowAddField(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Field</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div>
          {activity.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 200 }}>
              <Icon name="clock" size={32} color="var(--tx-3)" />
              <div className="empty-state-title">No Activity</div>
              <div className="empty-state-desc">Team events will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {activity.map(ev => (
                <div key={ev.id} className="card" style={{ padding: '8px 14px', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--tx-0)' }}>{ev.type.replace('io.khora.team.', '')}</span>
                    <span style={{ color: 'var(--tx-3)' }}>{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--tx-3)', marginTop: 2 }}>by {ev.sender}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
