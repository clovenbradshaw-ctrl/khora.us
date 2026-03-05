import { useState, useMemo } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import { ClientStore } from '../matrix/client-store.js';

/**
 * CaseList — DataTable view of all individuals/cases.
 *
 * Shows sortable, searchable list with status indicators.
 * Clicking a row opens the individual profile.
 */

// Demo case data
const DEMO_CASES = [
  {
    id: 'case_001',
    name: 'Maria Gonzalez',
    status: 'Active',
    housing: 'Transitionally Housed',
    lastEvent: '2025-08-20',
    worker: 'T. Khan',
    claims: 48,
    flags: ['contested'],
  },
  {
    id: 'case_002',
    name: 'James Cooper',
    status: 'Active',
    housing: 'Emergency Shelter',
    lastEvent: '2025-08-18',
    worker: 'J. Reyes',
    claims: 22,
    flags: [],
  },
  {
    id: 'case_003',
    name: 'Aisha Williams',
    status: 'Active',
    housing: 'Permanently Housed',
    lastEvent: '2025-08-15',
    worker: 'T. Khan',
    claims: 35,
    flags: ['held'],
  },
  {
    id: 'case_004',
    name: 'Robert Chen',
    status: 'Intake',
    housing: 'Literally Homeless',
    lastEvent: '2025-08-22',
    worker: 'J. Reyes',
    claims: 8,
    flags: [],
  },
  {
    id: 'case_005',
    name: 'Fatima Hassan',
    status: 'Active',
    housing: 'At Risk of Homelessness',
    lastEvent: '2025-08-10',
    worker: 'M. Chen',
    claims: 31,
    flags: ['due'],
  },
  {
    id: 'case_006',
    name: 'David Morales',
    status: 'Closed',
    housing: 'Stably Housed',
    lastEvent: '2025-07-28',
    worker: 'T. Khan',
    claims: 56,
    flags: [],
  },
  {
    id: 'case_007',
    name: 'Sarah Kim',
    status: 'Active',
    housing: 'Transitionally Housed',
    lastEvent: '2025-08-19',
    worker: 'M. Chen',
    claims: 27,
    flags: [],
  },
];

const STATUS_COLORS = {
  'Active':  'green',
  'Intake':  'blue',
  'Closed':  'gray',
  'Inactive': 'orange',
};

const HOUSING_COLORS = {
  'Literally Homeless':       'red',
  'Emergency Shelter':        'orange',
  'At Risk of Homelessness':  'orange',
  'Transitionally Housed':    'blue',
  'Permanently Housed':       'green',
  'Stably Housed':            'green',
};

export default function CaseList({ onSelectCase, hideDemoData = false, clients = [], loading = false, onClientCreated }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('lastEvent');
  const [sortDir, setSortDir] = useState('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ preferredName: '', legalName: '', status: 'Intake' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.preferredName.trim()) return;
    setCreating(true);
    try {
      await ClientStore.createClient(createForm);
      setShowCreate(false);
      setCreateForm({ preferredName: '', legalName: '', status: 'Intake' });
      onClientCreated?.();
    } catch (err) {
      console.error('Failed to create client:', err);
    }
    setCreating(false);
  };

  const filtered = useMemo(() => {
    let cases = hideDemoData ? [] : DEMO_CASES;

    // Merge real Matrix clients
    const realCases = clients.map(c => ({
      id: c.roomId,
      name: c.meta?.preferred_name || c.roomName || 'Unknown',
      status: c.meta?.status || 'Intake',
      housing: c.meta?.housing_status || '—',
      lastEvent: c.meta?.created || '',
      worker: c.meta?.created_by?.replace(/:.*$/, '').replace(/^@/, '') || '',
      claims: 0,
      flags: [],
    }));
    cases = [...cases, ...realCases];
    if (search.trim()) {
      const q = search.toLowerCase();
      cases = cases.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        c.housing.toLowerCase().includes(q) ||
        c.worker.toLowerCase().includes(q)
      );
    }
    cases = [...cases].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return cases;
  }, [search, sortField, sortDir, hideDemoData]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return <Icon name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={10} color="var(--tx-3)" />;
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="dt-toolbar">
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14} color="var(--tx-3)" className="search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases..."
            style={{ paddingLeft: 36, fontSize: 13 }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
          {filtered.length} case{filtered.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={12} /> New Client
        </button>
      </div>

      {/* Table */}
      <div className="dt-wrap">
        <div className="dt-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ width: '25%' }}>
                  Name <SortIcon field="name" />
                </th>
                <th onClick={() => handleSort('status')} style={{ width: '12%' }}>
                  Status <SortIcon field="status" />
                </th>
                <th onClick={() => handleSort('housing')} style={{ width: '22%' }}>
                  Housing <SortIcon field="housing" />
                </th>
                <th onClick={() => handleSort('worker')} style={{ width: '14%' }}>
                  Worker <SortIcon field="worker" />
                </th>
                <th onClick={() => handleSort('claims')} style={{ width: '10%' }}>
                  Claims <SortIcon field="claims" />
                </th>
                <th onClick={() => handleSort('lastEvent')} style={{ width: '17%' }}>
                  Last Event <SortIcon field="lastEvent" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className="dt-row"
                  onClick={() => onSelectCase?.(c.id)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="avatar" style={{ background: 'var(--gold-dim)', color: 'var(--gold)', width: 28, height: 28, fontSize: 11 }}>
                        {c.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--tx-0)' }}>{c.name}</span>
                      {c.flags.includes('contested') && (
                        <span className="status-dot error" title="Contested field" />
                      )}
                      {c.flags.includes('held') && (
                        <span className="status-dot warning" title="Held field" />
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`tag tag-${STATUS_COLORS[c.status] || 'gray'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <span className={`tag tag-${HOUSING_COLORS[c.housing] || 'gray'}`}>
                      {c.housing}
                    </span>
                  </td>
                  <td style={{ color: 'var(--tx-1)' }}>{c.worker}</td>
                  <td style={{ color: 'var(--tx-2)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {c.claims}
                  </td>
                  <td style={{ color: 'var(--tx-3)', fontSize: 12 }}>
                    {formatDate(c.lastEvent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="dt-empty">
            {loading ? 'Loading clients...' : 'No cases match your search.'}
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {showCreate && (
        <Modal title="New Client" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', display: 'block', marginBottom: 4 }}>
                  Preferred Name *
                </label>
                <input
                  type="text"
                  value={createForm.preferredName}
                  onChange={(e) => setCreateForm(f => ({ ...f, preferredName: e.target.value }))}
                  placeholder="How the client prefers to be called"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', display: 'block', marginBottom: 4 }}>
                  Legal Name
                </label>
                <input
                  type="text"
                  value={createForm.legalName}
                  onChange={(e) => setCreateForm(f => ({ ...f, legalName: e.target.value }))}
                  placeholder="Full legal name (optional)"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', display: 'block', marginBottom: 4 }}>
                  Status
                </label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm(f => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border-0)', background: 'var(--bg-0)', color: 'var(--tx-0)' }}
                >
                  <option value="Intake">Intake</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={creating || !createForm.preferredName.trim()}>
                  {creating ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
