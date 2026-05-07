import { useState } from 'react';
import Icon from './common/Icon.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AddMountModal from './AddMountModal.jsx';
import { MatrixService } from '../matrix/service.js';

/**
 * Launcher — the bootstrap home surface (SPEC §16.2).
 *
 * Shows tiles for the apps the user can run. Each tile is conceptually a
 * mount: an (app × data) pair. In this scaffold the data side is implicit
 * (the user's joined Matrix rooms); a real mount picker comes with §16.7.
 *
 * Tap a tile → bootstrap "loads" the app. In Phase 1+ this becomes
 * sandboxed-iframe + capability API; today it's an in-process route swap.
 */

const APPS = [
  {
    id: 'khora-cm',
    name: 'Khora CM',
    description: 'Sovereign case management. Claim-stack data model, EO operators, vault/bridge/roster rooms.',
    schemas: ['eo.case.v1'],
    icon: 'folder',
    status: 'ready',
  },
  {
    id: 'wire',
    name: 'wire',
    description: 'RSS reader over eo.feed.v1. First app planned for Phase 2 of the bootstrap protocol.',
    schemas: ['eo.feed.v1'],
    icon: 'inbox',
    status: 'planned',
  },
  {
    id: 'eo-wiki',
    name: 'eo-wiki',
    description: 'Append-rich wiki over eo.corpus.v1. Tests the write path in Phase 3.',
    schemas: ['eo.corpus.v1'],
    icon: 'file-text',
    status: 'planned',
  },
  {
    id: 'eodb',
    name: 'EO///DB',
    description: 'Database workbench. Nine-operator fold over any EO data room.',
    schemas: ['eo.*'],
    icon: 'database',
    status: 'planned',
  },
  {
    id: 'eoreader',
    name: 'eoReader',
    description: 'Read-only viewer for eo.corpus.v1 or compatible schemas.',
    schemas: ['eo.corpus.v1'],
    icon: 'eye',
    status: 'planned',
  },
  {
    id: 'anchorage',
    name: 'Anchorage',
    description: 'Provenance-first surface. Verbose by default.',
    schemas: ['eo.*'],
    icon: 'shield',
    status: 'planned',
  },
];

export default function Launcher({ user, onSelectApp, onLogout }) {
  const [showAdd, setShowAdd] = useState(false);

  const handleTile = (app) => {
    if (app.status !== 'ready') return;
    onSelectApp(app.id);
  };

  return (
    <div className="launcher-screen">
      <header className="launcher-header">
        <div className="launcher-brand">
          <span className="launcher-brand-mark">Khora</span>
          <span className="launcher-brand-sub">Bootstrap</span>
        </div>
        <div className="launcher-header-spacer" />
        <div className="launcher-user">
          <div className="avatar avatar-sm" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
            {(user?.userId || '@?').charAt(1).toUpperCase()}
          </div>
          <div className="launcher-user-meta">
            <div className="launcher-user-id">{user?.userId}</div>
            <div className="launcher-user-status">
              {MatrixService.isConnected ? 'Connected' : 'Offline'}
            </div>
          </div>
          <ThemeToggle compact />
          <button className="btn-icon" onClick={onLogout} title="Sign out">
            <Icon name="log-out" size={14} color="var(--tx-3)" />
          </button>
        </div>
      </header>

      <main className="launcher-main">
        <div className="launcher-intro">
          <h1>Mounts</h1>
          <p>
            Each tile is an app you can run over your Matrix data. Khora itself is
            the bootstrap — apps are loaded from app rooms, paired with data rooms,
            sandboxed at runtime. (SPEC §2, §16.2.)
          </p>
        </div>

        <div className="launcher-grid">
          {APPS.map(app => (
            <button
              key={app.id}
              type="button"
              className={`launcher-tile ${app.status === 'ready' ? '' : 'launcher-tile--planned'}`}
              onClick={() => handleTile(app)}
              disabled={app.status !== 'ready'}
              title={app.status === 'ready' ? `Open ${app.name}` : `${app.name} — not yet implemented`}
            >
              <div className="launcher-tile-icon">
                <Icon name={app.icon} size={28} />
              </div>
              <div className="launcher-tile-name">{app.name}</div>
              <div className="launcher-tile-desc">{app.description}</div>
              <div className="launcher-tile-meta">
                <span className="launcher-tile-schema">accepts: {app.schemas.join(', ')}</span>
                <span className={`launcher-tile-status launcher-tile-status--${app.status}`}>
                  {app.status === 'ready' ? 'Ready' : 'Planned'}
                </span>
              </div>
            </button>
          ))}

          <button
            type="button"
            className="launcher-tile launcher-tile--add"
            onClick={() => setShowAdd(true)}
            title="Add an app or mount"
          >
            <div className="launcher-tile-icon">
              <Icon name="plus" size={32} />
            </div>
            <div className="launcher-tile-name">New mount</div>
            <div className="launcher-tile-desc">
              Browse the library, paste a room URI, or create an app from a repo.
            </div>
          </button>
        </div>
      </main>

      {showAdd && <AddMountModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
