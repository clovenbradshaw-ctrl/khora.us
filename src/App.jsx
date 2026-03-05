import { useState, useCallback } from 'react';
import Icon from './components/common/Icon.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import CaseList from './components/CaseList.jsx';
import IndividualProfile from './components/IndividualProfile.jsx';
import InboxView from './components/InboxView.jsx';
import SEED_EVENTS from './data/seed-events.js';

/**
 * App — main shell for Khora.
 *
 * Login → App shell with sidebar navigation.
 * Views: Cases, Inbox, Individual Profile.
 */
export default function App() {
  // ── Auth state ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);

  // ── Navigation state ───────────────────────────────────────────
  const [view, setView] = useState('cases');
  const [selectedCase, setSelectedCase] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transparencyMode, setTransparencyMode] = useState(
    () => localStorage.getItem('khora:transparency') === 'true'
  );

  // ── Demo data ──────────────────────────────────────────────────
  const [events, setEvents] = useState(() => [...SEED_EVENTS]);

  const handleAddEvent = useCallback((event) => {
    setEvents(prev => [...prev, event]);
  }, []);

  const toggleTransparency = useCallback(() => {
    setTransparencyMode(prev => {
      const next = !prev;
      localStorage.setItem('khora:transparency', String(next));
      return next;
    });
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  // ── Navigation items ───────────────────────────────────────────
  const navItems = [
    { key: 'cases', label: 'Cases', icon: 'folder' },
    { key: 'inbox', label: 'Inbox', icon: 'inbox', badge: 3 },
  ];

  const navTools = [
    { key: 'schema', label: 'Schema', icon: 'database' },
    { key: 'metrics', label: 'Metrics', icon: 'bar-chart' },
  ];

  // ── Handle case selection ──────────────────────────────────────
  const handleSelectCase = (caseId) => {
    setSelectedCase(caseId);
    setView('profile');
  };

  const handleBackToList = () => {
    setSelectedCase(null);
    setView('cases');
  };

  // ── Render view content ────────────────────────────────────────
  const renderContent = () => {
    if (view === 'profile' && selectedCase) {
      return (
        <IndividualProfile
          events={events}
          onAddEvent={handleAddEvent}
          transparencyMode={transparencyMode}
          onBack={handleBackToList}
          agent={user.userId}
          agentRole="Caseworker"
        />
      );
    }

    if (view === 'inbox') {
      return <InboxView />;
    }

    if (view === 'schema') {
      return (
        <div className="empty-state" style={{ minHeight: 400 }}>
          <Icon name="database" size={40} color="var(--tx-3)" className="empty-state-icon" />
          <div className="empty-state-title">Schema Workbench</div>
          <div className="empty-state-desc">
            Define fields using EO operators. NUL creates, DES designates, INS instantiates.
            Schema changes are governed by the same operator vocabulary as data claims.
          </div>
        </div>
      );
    }

    if (view === 'metrics') {
      return (
        <div className="empty-state" style={{ minHeight: 400 }}>
          <Icon name="bar-chart" size={40} color="var(--tx-3)" className="empty-state-icon" />
          <div className="empty-state-title">Metrics</div>
          <div className="empty-state-desc">
            Anonymized aggregate metrics. Individual data is never exposed.
          </div>
        </div>
      );
    }

    // Default: case list
    return <CaseList onSelectCase={handleSelectCase} />;
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <span className="sidebar-brand">Khora</span>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(true)}
            title="Collapse sidebar"
          >
            <Icon name="chevron-left" size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-group">
            <div className="sidebar-nav-label">Case Management</div>
            {navItems.map(item => (
              <button
                key={item.key}
                className={`sidebar-nav-item ${view === item.key ? 'active' : ''}`}
                onClick={() => { setView(item.key); setSelectedCase(null); }}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
                {item.badge > 0 && (
                  <span className="sidebar-nav-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </div>

          <div className="sidebar-nav-group">
            <div className="sidebar-nav-label">Tools</div>
            {navTools.map(item => (
              <button
                key={item.key}
                className={`sidebar-nav-item ${view === item.key ? 'active' : ''}`}
                onClick={() => { setView(item.key); setSelectedCase(null); }}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="sidebar-nav-group">
            <div className="sidebar-nav-label">Transparency</div>
            <button
              className={`sidebar-nav-item ${transparencyMode ? 'active' : ''}`}
              onClick={toggleTransparency}
            >
              <Icon name={transparencyMode ? 'eye' : 'eye-off'} size={16} />
              {transparencyMode ? 'EO Operators On' : 'EO Operators Off'}
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="avatar avatar-sm" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
            {(user.userId || '@D').charAt(1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.userId}
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>
              {user.role || 'Provider'}
            </div>
          </div>
          <ThemeToggle compact />
          <button
            className="btn-icon"
            onClick={() => setUser(null)}
            title="Sign out"
          >
            <Icon name="log-out" size={14} color="var(--tx-3)" />
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="app-main">
        {/* Top bar (shows collapse-expand when sidebar hidden) */}
        <div className="app-main-header">
          {sidebarCollapsed && (
            <button
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
            >
              <Icon name="menu" size={14} />
            </button>
          )}
          <span style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--tx-0)' }}>
            {view === 'cases' && 'Cases'}
            {view === 'inbox' && 'Messages'}
            {view === 'profile' && 'Individual Profile'}
            {view === 'schema' && 'Schema Workbench'}
            {view === 'metrics' && 'Metrics'}
          </span>
          <div className="nav-spacer" />
          {view === 'cases' && (
            <button className="btn-primary btn-sm" onClick={() => handleSelectCase('case_001')}>
              <Icon name="plus" size={12} /> Open Demo Case
            </button>
          )}
        </div>

        {/* Content */}
        <div className="app-main-content anim-up">
          {renderContent()}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {[
            { key: 'cases', label: 'Cases', icon: 'folder' },
            { key: 'inbox', label: 'Inbox', icon: 'inbox' },
            { key: 'schema', label: 'Schema', icon: 'database' },
            { key: 'metrics', label: 'Metrics', icon: 'bar-chart' },
          ].map(item => (
            <button
              key={item.key}
              className={`mobile-bottom-nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => { setView(item.key); setSelectedCase(null); }}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
