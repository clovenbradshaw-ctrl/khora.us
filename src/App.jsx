import { useState, useCallback, useEffect } from 'react';
import Icon from './components/common/Icon.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import CaseList from './components/CaseList.jsx';
import IndividualProfile from './components/IndividualProfile.jsx';
import InboxView from './components/InboxView.jsx';
import TeamView from './components/TeamView.jsx';
import SchemaBuilder from './components/SchemaBuilder.jsx';
import ResourcesView from './components/ResourcesView.jsx';
import GovernanceView from './components/GovernanceView.jsx';
import { MatrixService } from './matrix/service.js';
import { ClientStore } from './matrix/client-store.js';
import { ClaimStore } from './matrix/claim-store.js';
import { EVT } from './engine/operators.js';
import SEED_EVENTS from './data/seed-events.js';

/**
 * App — main shell for Khora.
 *
 * Real Matrix auth → context detection → Provider or Client view.
 */
export default function App() {
  // ── Auth state ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState('');

  // ── Context ──────────────────────────────────────────────────────
  const [contexts, setContexts] = useState([]); // ['client', 'provider']
  const [activeContext, setActiveContext] = useState(
    () => localStorage.getItem('khora:context') || 'provider'
  );
  const [detectingContext, setDetectingContext] = useState(false);

  // ── Navigation state ───────────────────────────────────────────
  const [view, setView] = useState('cases');
  const [selectedCase, setSelectedCase] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [transparencyMode, setTransparencyMode] = useState(
    () => localStorage.getItem('khora:transparency') === 'true'
  );

  // ── Demo data (used alongside Matrix data) ────────────────────
  const [hideDemoData, setHideDemoData] = useState(
    () => localStorage.getItem('khora:hideDemoData') === 'true'
  );
  const [events, setEvents] = useState(() => {
    if (localStorage.getItem('khora:hideDemoData') === 'true') return [];
    return [...SEED_EVENTS];
  });

  // ── Real client data from Matrix ─────────────────────────────────
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [profileEvents, setProfileEvents] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadClients = useCallback(async (optimisticClient) => {
    // If a newly created client was passed, add it immediately so it appears
    // in the list before the next Matrix sync round-trip completes.
    if (optimisticClient) {
      setClients(prev => {
        if (prev.some(c => c.roomId === optimisticClient.roomId)) return prev;
        return [...prev, optimisticClient];
      });
    }
    if (!MatrixService.isConnected) return;
    setClientsLoading(true);
    try {
      const result = await ClientStore.loadClients();
      setClients(result);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
    setClientsLoading(false);
  }, []);

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

  const toggleDemoData = useCallback(() => {
    setHideDemoData(prev => {
      const next = !prev;
      localStorage.setItem('khora:hideDemoData', String(next));
      if (next) {
        setEvents([]);
      } else {
        setEvents([...SEED_EVENTS]);
      }
      return next;
    });
  }, []);

  // ── Session restore on mount ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await MatrixService.restoreSession();
        if (result) {
          setUser({ userId: result.userId, role: 'provider' });
          await detectContextFromRooms();
          await loadClients();
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      }
      setRestoring(false);
    })();
  }, []);

  // ── Detect contexts from Matrix rooms ────────────────────────
  const detectContextFromRooms = async () => {
    setDetectingContext(true);
    try {
      const detected = await MatrixService.detectContexts(EVT.IDENTITY);
      setContexts(detected);
      if (detected.length === 1) {
        setActiveContext(detected[0]);
        localStorage.setItem('khora:context', detected[0]);
      }
    } catch (err) {
      console.error('Context detection failed:', err);
    }
    setDetectingContext(false);
  };

  // ── Login handler ────────────────────────────────────────────
  const handleLogin = async (homeserver, username, password) => {
    setAuthError('');
    const result = await MatrixService.login(homeserver, username, password);
    setUser({ userId: result.userId, role: 'provider' });
    await detectContextFromRooms();
    await loadClients();
  };

  // ── Logout ───────────────────────────────────────────────────
  const handleLogout = async () => {
    await MatrixService.logout();
    setUser(null);
    setContexts([]);
    setView('cases');
    setSelectedCase(null);
  };

  // ── Context switch ───────────────────────────────────────────
  const switchContext = (ctx) => {
    setActiveContext(ctx);
    localStorage.setItem('khora:context', ctx);
    setView(ctx === 'client' ? 'vault' : 'cases');
    setSelectedCase(null);
  };

  // ── Loading ──────────────────────────────────────────────────
  if (restoring) {
    return (
      <div className="login-screen">
        <div style={{ fontSize: 14, color: 'var(--tx-3)' }}>Restoring session...</div>
      </div>
    );
  }

  // ── Login ──────────────────────────────────────────────────────
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ── Navigation items ───────────────────────────────────────────
  const providerNav = [
    { group: 'Case Management', items: [
      { key: 'cases', label: 'Cases', icon: 'folder' },
      { key: 'inbox', label: 'Inbox', icon: 'inbox' },
    ]},
    { group: 'Team & Org', items: [
      { key: 'teams', label: 'Teams', icon: 'users' },
      { key: 'resources', label: 'Resources', icon: 'package' },
    ]},
    { group: 'Tools', items: [
      { key: 'schema', label: 'Schema', icon: 'database' },
      { key: 'governance', label: 'Governance', icon: 'vote' },
      { key: 'metrics', label: 'Metrics', icon: 'bar-chart' },
    ]},
  ];

  const clientNav = [
    { group: 'My Data', items: [
      { key: 'vault', label: 'My Vault', icon: 'lock' },
      { key: 'resources', label: 'My Resources', icon: 'package' },
    ]},
    { group: 'Communication', items: [
      { key: 'inbox', label: 'Messages', icon: 'inbox' },
    ]},
  ];

  const navGroups = activeContext === 'client' ? clientNav : providerNav;

  // ── Handle case selection ──────────────────────────────────────
  const handleSelectCase = async (caseId) => {
    setSelectedCase(caseId);
    setView('profile');

    // Load events from Matrix for real clients (room IDs start with !)
    if (caseId?.startsWith('!')) {
      setProfileLoading(true);
      setProfileEvents([]);
      try {
        const evts = await ClaimStore.loadEvents(caseId);
        setProfileEvents(evts);
      } catch (err) {
        console.error('Failed to load client events:', err);
      }
      setProfileLoading(false);
    } else {
      // Demo case — use seed events
      setProfileEvents(hideDemoData ? [] : [...SEED_EVENTS]);
    }
  };

  const handleBackToList = () => {
    setSelectedCase(null);
    setProfileEvents([]);
    setView('cases');
  };

  // ── View titles ────────────────────────────────────────────────
  const VIEW_TITLES = {
    cases: 'Cases',
    inbox: 'Messages',
    profile: 'Individual Profile',
    teams: 'Teams',
    resources: 'Resources',
    schema: 'Schema Workbench',
    governance: 'Governance',
    metrics: 'Metrics',
    vault: 'My Vault',
  };

  // ── Render view content ────────────────────────────────────────
  const renderContent = () => {
    if (view === 'profile' && selectedCase) {
      const isRealClient = selectedCase.startsWith('!');

      if (profileLoading) {
        return (
          <div className="empty-state" style={{ minHeight: 300 }}>
            <div className="empty-state-desc">Loading client record...</div>
          </div>
        );
      }

      return (
        <IndividualProfile
          events={isRealClient ? profileEvents : events}
          onAddEvent={isRealClient
            ? async (event) => {
                await ClaimStore.emitEvent(selectedCase, event);
                const evts = await ClaimStore.loadEvents(selectedCase);
                setProfileEvents(evts);
              }
            : handleAddEvent}
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

    if (view === 'teams') {
      return <TeamView />;
    }

    if (view === 'schema') {
      return <SchemaBuilder />;
    }

    if (view === 'resources') {
      return <ResourcesView />;
    }

    if (view === 'governance') {
      return <GovernanceView />;
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

    if (view === 'vault') {
      return (
        <div className="empty-state" style={{ minHeight: 400 }}>
          <Icon name="lock" size={40} color="var(--tx-3)" className="empty-state-icon" />
          <div className="empty-state-title">My Vault</div>
          <div className="empty-state-desc">
            Your personal data vault. All fields are encrypted and under your control.
          </div>
        </div>
      );
    }

    // Default: case list
    return (
      <CaseList
        onSelectCase={handleSelectCase}
        hideDemoData={hideDemoData}
        clients={clients}
        loading={clientsLoading}
        onClientCreated={loadClients}
      />
    );
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

        {/* Context switcher */}
        {contexts.length > 1 && (
          <div style={{ padding: '0 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bd)' }}>
              {contexts.map(ctx => (
                <button
                  key={ctx}
                  onClick={() => switchContext(ctx)}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: activeContext === ctx ? 'var(--gold-dim)' : 'transparent',
                    color: activeContext === ctx ? 'var(--gold)' : 'var(--tx-3)',
                    textTransform: 'capitalize',
                  }}
                >
                  {ctx}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navGroups.map(group => (
            <div className="sidebar-nav-group" key={group.group}>
              <div className="sidebar-nav-label">{group.group}</div>
              {group.items.map(item => (
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
          ))}

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

          <div className="sidebar-nav-group">
            <div className="sidebar-nav-label">Data</div>
            <button
              className={`sidebar-nav-item ${hideDemoData ? '' : 'active'}`}
              onClick={toggleDemoData}
            >
              <Icon name={hideDemoData ? 'eye-off' : 'database'} size={16} />
              {hideDemoData ? 'Demo Data Hidden' : 'Demo Data Visible'}
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
              {MatrixService.isConnected ? 'Connected' : 'Offline'} · {activeContext}
            </div>
          </div>
          <ThemeToggle compact />
          <button
            className="btn-icon"
            onClick={handleLogout}
            title="Sign out"
          >
            <Icon name="log-out" size={14} color="var(--tx-3)" />
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="app-main">
        {/* Top bar */}
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
            {VIEW_TITLES[view] || 'Khora'}
          </span>
          <div className="nav-spacer" />
          {view === 'cases' && !hideDemoData && (
            <button className="btn-primary btn-sm" onClick={() => handleSelectCase('case_001')}>
              <Icon name="plus" size={12} /> Open Demo Case
            </button>
          )}
        </div>

        {/* Content */}
        <div className="app-main-content anim-up">
          {detectingContext ? (
            <div className="empty-state" style={{ minHeight: 300 }}>
              <div className="empty-state-desc">Detecting your context from Matrix rooms...</div>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          {(activeContext === 'client'
            ? [
              { key: 'vault', label: 'Vault', icon: 'lock' },
              { key: 'resources', label: 'Resources', icon: 'package' },
              { key: 'inbox', label: 'Messages', icon: 'inbox' },
            ]
            : [
              { key: 'cases', label: 'Cases', icon: 'folder' },
              { key: 'teams', label: 'Teams', icon: 'users' },
              { key: 'resources', label: 'Resources', icon: 'package' },
              { key: 'governance', label: 'Gov', icon: 'vote' },
            ]
          ).map(item => (
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
