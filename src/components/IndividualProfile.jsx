import { useState, useMemo, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import { PhaseBadge, ModeBadge, OperatorBadge } from './common/Badge.jsx';
import FieldCard from './FieldCard.jsx';
import ClaimStack from './ClaimStack.jsx';
import AttentionStrip from './AttentionStrip.jsx';
import ObservationPanel from './ObservationPanel.jsx';
import TimelineView from './TimelineView.jsx';
import AuditPanel from './AuditPanel.jsx';
import RecentActivity from './RecentActivity.jsx';
import Modal from './common/Modal.jsx';
import useAttention from '../hooks/useAttention.js';
import { SECTIONS } from '../schema/fields.js';
import { replayTo, buildClaimEvent } from '../engine/claims.js';

/**
 * IndividualProfile — 5-tab profile view for a single individual.
 *
 * Tabs: Fields, Notes, Activity, Provenance, Access
 */
export default function IndividualProfile({
  events,
  onAddEvent,
  transparencyMode,
  onBack,
  agent = '@demo:khora.us',
  agentRole = 'Caseworker',
}) {
  const [activeTab, setActiveTab] = useState('fields');
  const [obsField, setObsField] = useState(null);
  const [obsStack, setObsStack] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const stacks = useMemo(() => replayTo(events), [events]);
  const attentionItems = useAttention(stacks);

  const stats = useMemo(() => {
    let fieldsWithData = 0;
    let totalClaims = 0;
    for (const [, stack] of stacks) {
      if (stack.claims.length > 0) {
        fieldsWithData++;
        totalClaims += stack.claims.length;
      }
    }
    return { fieldsWithData, totalClaims, totalEvents: events.length };
  }, [stacks, events]);

  const handleObserve = useCallback((fieldKey, stack) => {
    setObsField(fieldKey);
    setObsStack(stack || stacks.get(fieldKey) || { claims: [], conLinks: {} });
  }, [stacks]);

  const handleSave = useCallback(async (fieldKey, newClaim, ops) => {
    const claimEvent = buildClaimEvent(agent, agentRole, ops, `${agentRole} updated ${fieldKey}`);
    try {
      await onAddEvent(claimEvent);
    } catch (err) {
      console.error('Failed to save observation:', err);
    }
    setObsField(null);
    setObsStack(null);
  }, [agent, agentRole, onAddEvent]);

  const name = stacks.get('preferred_name')?.claims?.[0]?.value || 'Unknown';
  const legalName = stacks.get('legal_name')?.claims?.[0]?.value;
  const status = stacks.get('case_status')?.claims?.[0]?.value;

  const tabs = [
    { key: 'fields', label: 'Fields', icon: 'clipboard-list' },
    { key: 'notes', label: 'Notes', icon: 'file-text' },
    { key: 'activity', label: 'Activity', icon: 'activity' },
    { key: 'provenance', label: 'Provenance', icon: 'eye' },
    { key: 'access', label: 'Access', icon: 'lock' },
  ];

  return (
    <div>
      {/* ── Profile header ── */}
      <div className="case-header" style={{ marginBottom: 0, borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}>
        <button className="btn-icon" onClick={onBack} style={{ marginRight: 4 }}>
          <Icon name="chevron-left" size={18} color="var(--tx-2)" />
        </button>
        <div className="avatar avatar-lg" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
          {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <div className="case-header-name">
            {name}
            {legalName && name !== legalName && (
              <span style={{ fontSize: 13, color: 'var(--tx-3)', fontWeight: 400, fontFamily: 'var(--sans)', marginLeft: 8 }}>
                ({legalName})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--tx-3)' }}>
            <span>{stats.fieldsWithData} fields</span>
            <span>{stats.totalClaims} claims</span>
            <span>{stats.totalEvents} events</span>
            {status && <span className={`tag tag-${status === 'Active' ? 'green' : status === 'Intake' ? 'blue' : 'gray'}`}>{status}</span>}
          </div>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setTimelineOpen(true)}>
          <Icon name="history" size={12} /> Timeline
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <Icon name={t.icon} size={13} color={activeTab === t.key ? 'var(--tx-0)' : 'var(--tx-2)'} style={{ marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Attention strip ── */}
      {attentionItems.length > 0 && activeTab === 'fields' && (
        <div style={{ marginBottom: 16 }}>
          <AttentionStrip items={attentionItems} onUpdate={(fieldKey) => handleObserve(fieldKey)} />
        </div>
      )}

      {/* ── Tab content ── */}
      {activeTab === 'fields' && (
        <FieldsTab
          stacks={stacks}
          transparencyMode={transparencyMode}
          onObserve={handleObserve}
        />
      )}

      {activeTab === 'notes' && <NotesTab stacks={stacks} events={events} />}
      {activeTab === 'activity' && <ActivityTab events={events} transparencyMode={transparencyMode} />}
      {activeTab === 'provenance' && <ProvenanceTab events={events} stacks={stacks} />}
      {activeTab === 'access' && <AccessTab />}

      {/* ── Observation Panel Modal ── */}
      <Modal
        open={!!obsField}
        onClose={() => { setObsField(null); setObsStack(null); }}
        title={`Record Observation — ${obsField || ''}`}
      >
        {obsField && (
          <ObservationPanel
            fieldKey={obsField}
            currentStack={obsStack}
            agent={agent}
            agentRole={agentRole}
            transparencyMode={transparencyMode}
            onSave={handleSave}
            onClose={() => { setObsField(null); setObsStack(null); }}
          />
        )}
      </Modal>

      {/* ── Timeline Modal ── */}
      <Modal
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        title="Case Timeline"
        fullscreen
      >
        <TimelineView events={events} transparencyMode={transparencyMode} />
      </Modal>
    </div>
  );
}

// ── Fields Tab ──────────────────────────────────────────────────────

function FieldsTab({ stacks, transparencyMode, onObserve }) {
  return (
    <div>
      {SECTIONS.map(section => {
        const sectionFields = section.fields;
        const completedCount = sectionFields.filter(f => stacks.get(f.key)?.claims?.length > 0).length;
        const pct = Math.round((completedCount / sectionFields.length) * 100);

        return (
          <div key={section.key} style={{ marginBottom: 16 }}>
            <div className="section-header">
              <Icon name={section.icon} size={13} color="var(--tx-3)" />
              {section.label}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--tx-3)', fontFamily: 'var(--mono)' }}>
                {completedCount}/{sectionFields.length} · {pct}%
              </span>
            </div>
            {/* Completion bar */}
            <div style={{
              height: 1.5,
              background: 'var(--border-0)',
              borderRadius: 1,
              marginBottom: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: pct === 100 ? 'var(--green)' : 'var(--gold)',
                borderRadius: 1,
                transition: 'width .3s ease',
              }} />
            </div>
            <div className="field-stack">
              {sectionFields.map(field => (
                <FieldCard
                  key={field.key}
                  fieldKey={field.key}
                  stack={stacks.get(field.key) || { claims: [], conLinks: {} }}
                  transparencyMode={transparencyMode}
                  onObserve={onObserve}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Notes Tab ───────────────────────────────────────────────────────

function NotesTab({ stacks, events }) {
  // Extract notes from case_notes and worker_assessment
  const notes = [];
  const caseNotes = stacks.get('case_notes');
  const workerAssessment = stacks.get('worker_assessment');

  if (caseNotes?.claims) {
    for (const claim of caseNotes.claims) {
      notes.push({
        id: claim.id,
        title: 'Case Notes',
        content: claim.value,
        agent: claim.agent,
        date: claim.timestamp,
        phase: claim.phase,
      });
    }
  }
  if (workerAssessment?.claims) {
    for (const claim of workerAssessment.claims) {
      notes.push({
        id: claim.id,
        title: 'Worker Assessment',
        content: claim.value,
        agent: claim.agent,
        date: claim.timestamp,
        phase: claim.phase,
      });
    }
  }

  notes.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (notes.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="file-text" size={40} color="var(--tx-3)" className="empty-state-icon" />
        <div className="empty-state-title">No notes yet</div>
        <div className="empty-state-desc">Case notes and assessments will appear here.</div>
      </div>
    );
  }

  return (
    <div className="stack">
      {notes.map(note => (
        <div key={note.id} className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0)', flex: 1 }}>{note.title}</span>
            <PhaseBadge phase={note.phase} />
            <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{formatTime(note.date)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx-1)', lineHeight: 1.6 }}>{note.content}</div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 8 }}>{formatAgent(note.agent)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Activity Tab ────────────────────────────────────────────────────

function ActivityTab({ events, transparencyMode }) {
  const sorted = [...events].sort((a, b) => new Date(b.date) - new Date(a.date));

  const OP_COLORS = {
    NUL: 'var(--red)', SIG: 'var(--teal)', INS: 'var(--green)',
    SEG: 'var(--orange)', CON: 'var(--blue)', SYN: 'var(--purple)',
    ALT: 'var(--gold)', SUP: 'var(--pink)', REC: 'var(--teal)',
  };

  return (
    <div>
      {sorted.map(event => {
        const fieldOps = (event.ops || []).filter(op => op.field && op.value !== undefined);
        const primaryOp = event.ops?.[0]?.op || 'INS';

        return (
          <div key={event.id} className="activity-item">
            <div className="activity-dot" style={{ background: OP_COLORS[primaryOp] || 'var(--tx-3)' }} />
            <div className="activity-content">
              <div className="activity-label">{event.label}</div>
              <div className="activity-meta">
                {formatAgent(event.agent)} · {formatTime(event.date)}
                {transparencyMode && (
                  <span style={{ marginLeft: 8 }}>
                    {(event.ops || []).map((op, i) => (
                      <OperatorBadge key={i} operator={op.op} />
                    ))}
                  </span>
                )}
              </div>
              {fieldOps.slice(0, 3).map((op, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 4 }}>
                  <span style={{ fontWeight: 500 }}>{op.field}</span>: {op.value}
                </div>
              ))}
              {fieldOps.length > 3 && (
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4 }}>
                  +{fieldOps.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Provenance Tab ──────────────────────────────────────────────────

function ProvenanceTab({ events, stacks }) {
  return (
    <div>
      <AuditPanel events={events} currentStacks={stacks} />
    </div>
  );
}

// ── Access Tab ──────────────────────────────────────────────────────

function AccessTab() {
  const providers = [
    { id: '@jreyes:khora.us', name: 'J. Reyes', role: 'Intake Worker', status: 'active', fields: 45 },
    { id: '@tkhan:khora.us', name: 'T. Khan', role: 'Caseworker', status: 'active', fields: 60 },
    { id: '@mchen:khora.us', name: 'M. Chen', role: 'Supervisor', status: 'active', fields: 60 },
  ];

  // Claim status — in production this would come from AccessControl.getClaimStatus()
  const [claimStatus] = useState({
    claimable: true,
    claimedBy: null,
    createdBy: '@tkhan:khora.us',
  });

  return (
    <div>
      {/* Account Claim Status */}
      <div className="card" style={{
        marginBottom: 16,
        background: claimStatus.claimedBy ? 'var(--green-dim)' : 'var(--gold-dim)',
        border: `1px solid ${claimStatus.claimedBy ? 'var(--green-dim)' : 'var(--gold-dim)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon
            name={claimStatus.claimedBy ? 'user-check' : 'user-plus'}
            size={16}
            color={claimStatus.claimedBy ? 'var(--green)' : 'var(--gold)'}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0)' }}>
              {claimStatus.claimedBy
                ? `Account claimed by ${claimStatus.claimedBy}`
                : 'Claimable Account'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx-2)' }}>
              {claimStatus.claimedBy
                ? 'This individual owns their data. Provider access is at their discretion.'
                : `Profile created by ${claimStatus.createdBy || 'provider'}. When the individual claims this account, they become the sovereign owner and can revoke provider access.`}
            </div>
          </div>
          {claimStatus.claimable && !claimStatus.claimedBy && (
            <button className="btn-primary btn-sm">
              <Icon name="key" size={12} /> Claim Account
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="section-header">
          <Icon name="users" size={14} color="var(--tx-2)" />
          Provider Access
        </div>
        <div style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 16 }}>
          The individual controls who can access their data. Revoking a provider&apos;s access removes their decryption keys permanently.
        </div>
      </div>

      <div className="stack">
        {providers.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{p.role} · {p.fields} fields accessible</div>
            </div>
            <span className={`status-dot ${p.status === 'active' ? 'active' : 'inactive'}`} />
            <span style={{ fontSize: 12, color: p.status === 'active' ? 'var(--green)' : 'var(--tx-3)' }}>
              {p.status === 'active' ? 'Active' : 'Revoked'}
            </span>
            <button className="b-red b-xs">Revoke</button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, background: 'var(--bg-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="lock" size={14} color="var(--gold)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0)' }}>Encryption Model</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>
          Data is stored as encrypted blobs. Each vault represents a permission structure.
          Providers receive decryption credentials when granted access. Once revoked,
          providers can no longer decrypt any data — past or future.
          The individual controls all access grants.
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

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
