import { useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './common/Icon.jsx';

/**
 * AddMountModal — the "+" surface from the launcher (SPEC §16.5–§16.7).
 *
 * Stub for the four-option add flow:
 *   1. Browse Library      (§16.3)  — registry-fed app list
 *   2. Add by URI          (§16.3)  — paste a room alias or mxapp:// URI
 *   3. Create from repo    (§16.5)  — paste GitHub URL, look up khora.json
 *   4. Mount existing      (§16.7)  — pair an installed app with a data room
 *
 * Each option renders an inert form so the shape of the surface is visible
 * to the user. Wiring lands with the bootstrap shell (Phase 1+).
 */

const TABS = [
  { id: 'library',  label: 'Library',     icon: 'database',  hint: 'Browse apps from trusted registries (SPEC §16.3).' },
  { id: 'uri',      label: 'Add by URI',  icon: 'plus',      hint: 'Paste a room alias, room ID, or mxapp:// URI.' },
  { id: 'repo',     label: 'From repo',   icon: 'code',      hint: 'Build an app from a GitHub repo with a khora.json (SPEC §16.5).' },
  { id: 'mount',    label: 'New mount',   icon: 'folder',    hint: 'Pair an installed app with a subscribed data room (SPEC §16.7).' },
];

export default function AddMountModal({ onClose }) {
  const [tab, setTab] = useState('library');
  const [uri, setUri] = useState('');
  const [repo, setRepo] = useState('');

  const stop = (e) => e.stopPropagation();

  const body = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ width: 560, maxWidth: '92vw', padding: 0 }}
        onClick={stop}
      >
        <div className="add-mount-header">
          <div>
            <div className="add-mount-title">Add to your mounts</div>
            <div className="add-mount-sub">
              Find an app, paste a URI, or create one from source.
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <Icon name="x" size={16} color="var(--tx-3)" />
          </button>
        </div>

        <div className="add-mount-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`add-mount-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="add-mount-body">
          <div className="add-mount-hint">
            {TABS.find(t => t.id === tab)?.hint}
          </div>

          {tab === 'library' && (
            <div className="add-mount-empty">
              <Icon name="database" size={32} color="var(--tx-3)" />
              <div className="add-mount-empty-title">No registries configured yet.</div>
              <div className="add-mount-empty-desc">
                The bootstrap will ship a small seed registry. You'll be able to add
                more in Settings → Trusted registries (SPEC §16.11).
              </div>
            </div>
          )}

          {tab === 'uri' && (
            <form onSubmit={(e) => { e.preventDefault(); }}>
              <div className="field-group">
                <label>App room URI</label>
                <input
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="#khora-cm-app:michael.tld  or  mxapp://michael.tld/khora-cm"
                />
              </div>
              <button type="submit" className="btn-primary" disabled style={{ width: '100%' }}>
                Install (Phase 1)
              </button>
              <div className="add-mount-foot">
                Bootstrap subscribes to the app room, fetches the manifest, verifies
                the SHA-256, then lets you pair it with a data room.
              </div>
            </form>
          )}

          {tab === 'repo' && (
            <form onSubmit={(e) => { e.preventDefault(); }}>
              <div className="field-group">
                <label>GitHub repo URL</label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/your-org/your-app"
                />
              </div>
              <button type="submit" className="btn-primary" disabled style={{ width: '100%' }}>
                Create app from repo (Phase 1)
              </button>
              <div className="add-mount-foot">
                Bootstrap looks for <code>khora.json</code> in the repo root, then
                shows a copyable <code>npx khora publish</code> command (or fires a
                hosted build if configured).
              </div>
            </form>
          )}

          {tab === 'mount' && (
            <div className="add-mount-empty">
              <Icon name="folder" size={32} color="var(--tx-3)" />
              <div className="add-mount-empty-title">Install an app first.</div>
              <div className="add-mount-empty-desc">
                A mount is an (app × data) pair. The picker filters data rooms to
                only those whose schema the app accepts (SPEC §16.7).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
