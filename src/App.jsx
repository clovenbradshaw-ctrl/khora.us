import { useState, useCallback } from 'react';
import Icon from './components/common/Icon.jsx';
import Modal from './components/common/Modal.jsx';
import AttentionStrip from './components/AttentionStrip.jsx';
import FieldCard from './components/FieldCard.jsx';
import ObservationPanel from './components/ObservationPanel.jsx';
import TimelineView from './components/TimelineView.jsx';
import AuditPanel from './components/AuditPanel.jsx';
import Search from './components/Search.jsx';
import RecentActivity from './components/RecentActivity.jsx';
import useClaimStacks from './hooks/useClaimStacks.js';
import useAttention from './hooks/useAttention.js';
import useObservation from './hooks/useObservation.js';
import { SECTIONS } from './schema/fields.js';
import { replayTo, buildClaimEvent, inferOperator } from './engine/claims.js';

/**
 * App — main shell for the Khora claim-stack UI.
 *
 * Wires together all Phase 4 components with the claim engine.
 * In demo mode (no Matrix connection), works with local event state.
 */
export default function App() {
  // ── Demo state (no Matrix needed) ─────────────────────────────
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('fields');  // fields | search | timeline
  const [transparencyMode, setTransparencyMode] = useState(
    () => localStorage.getItem('khora:transparency') === 'true'
  );

  // Observation panel state
  const [obsField, setObsField] = useState(null);
  const [obsStack, setObsStack] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Demo agent
  const agent = '@demo:khora.us';
  const agentRole = 'Caseworker';

  // ── Replay stacks from local events ───────────────────────────
  const stacks = replayTo(events);
  const attentionItems = useAttention(stacks);

  // ── Toggle transparency mode ──────────────────────────────────
  const toggleTransparency = useCallback(() => {
    setTransparencyMode(prev => {
      const next = !prev;
      localStorage.setItem('khora:transparency', String(next));
      return next;
    });
  }, []);

  // ── Handle observation save ───────────────────────────────────
  const handleSave = useCallback((fieldKey, newClaim, ops) => {
    const claimEvent = buildClaimEvent(agent, agentRole, ops, `${agentRole} updated ${fieldKey}`);
    setEvents(prev => [...prev, claimEvent]);
    setObsField(null);
    setObsStack(null);
  }, [agent, agentRole]);

  // ── Open observation panel ────────────────────────────────────
  const handleObserve = useCallback((fieldKey, stack) => {
    setObsField(fieldKey);
    setObsStack(stack || stacks.get(fieldKey) || { claims: [], conLinks: {} });
  }, [stacks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Nav ── */}
      <nav className="nav">
        <span className="nav-title">Khora</span>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Claim Stack Architecture</span>
        <div className="nav-spacer" />

        {/* View toggles */}
        <button
          className={`btn btn-sm ${view === 'fields' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setView('fields')}
        >
          Fields
        </button>
        <button
          className={`btn btn-sm ${view === 'search' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setView('search')}
        >
          <Icon name="search" size={12} /> Search
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setTimelineOpen(true)}
        >
          <Icon name="history" size={12} /> Timeline
        </button>

        {/* Transparency toggle */}
        <button
          className={`btn btn-sm ${transparencyMode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={toggleTransparency}
          title={transparencyMode ? 'Hide EO operators' : 'Show EO operators (audit mode)'}
        >
          <Icon name={transparencyMode ? 'eye' : 'eye-off'} size={12} />
          {transparencyMode ? 'EO On' : 'EO Off'}
        </button>
      </nav>

      {/* ── Main content ── */}
      <div className="container" style={{ flex: 1, paddingTop: 16 }}>
        {/* Attention strip */}
        {attentionItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <AttentionStrip
              items={attentionItems}
              onUpdate={(fieldKey) => handleObserve(fieldKey)}
            />
          </div>
        )}

        {/* View: Fields */}
        {view === 'fields' && (
          <div>
            {/* Recent activity */}
            {events.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-header">
                  <Icon name="activity" size={14} color="var(--tx-2)" />
                  Recent Activity
                </div>
                <RecentActivity events={events} transparencyMode={transparencyMode} />
              </div>
            )}

            {/* Audit panel (when transparency on) */}
            {transparencyMode && events.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <AuditPanel events={events} currentStacks={stacks} />
              </div>
            )}

            {/* Field cards by section */}
            {SECTIONS.map(section => (
              <div key={section.key} style={{ marginBottom: 20 }}>
                <div className="section-header">
                  <Icon name={section.icon} size={14} color="var(--tx-2)" />
                  {section.label}
                </div>
                <div className="stack">
                  {section.fields.map(field => (
                    <FieldCard
                      key={field.key}
                      fieldKey={field.key}
                      stack={stacks.get(field.key) || { claims: [], conLinks: {} }}
                      transparencyMode={transparencyMode}
                      onObserve={handleObserve}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View: Search */}
        {view === 'search' && (
          <Search
            stacks={stacks}
            transparencyMode={transparencyMode}
            onObserve={handleObserve}
          />
        )}
      </div>

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
        <TimelineView
          events={events}
          transparencyMode={transparencyMode}
        />
      </Modal>
    </div>
  );
}
