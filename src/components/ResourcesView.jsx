import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import { ResourceStore } from '../matrix/resource-store.js';
import { RESOURCE_CATEGORIES } from '../engine/operators.js';
import { MatrixService } from '../matrix/service.js';
import { EVT } from '../engine/operators.js';

const CATEGORY_ICONS = {
  housing: 'home', financial: 'dollar-sign', transportation: 'truck',
  food: 'apple', health: 'heart-pulse', employment: 'briefcase',
  legal: 'scale', education: 'graduation-cap', general: 'package',
};

/**
 * ResourcesView — inventory table + create resource types.
 */
export default function ResourcesView() {
  const [orgRooms, setOrgRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Create resource type
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', category: 'general', unit: 'unit', description: '',
  });

  // Inventory editing
  const [editingInventory, setEditingInventory] = useState(null);
  const [inventoryForm, setInventoryForm] = useState({ capacity: 0, available: 0, fundingSource: '' });

  const loadOrgRooms = useCallback(async () => {
    setLoading(true);
    try {
      const scanned = await MatrixService.scanRooms([EVT.IDENTITY]);
      const orgs = scanned.filter(r => {
        const t = r.state[EVT.IDENTITY]?.account_type;
        return t === 'organization' || t === 'network' || t === 'team';
      });
      setOrgRooms(orgs);
      if (orgs.length > 0 && !activeRoomId) {
        setActiveRoomId(orgs[0].roomId);
      }
    } catch (err) {
      console.error('Failed to load org rooms:', err);
    }
    setLoading(false);
  }, [activeRoomId]);

  const loadResources = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const [types, inv] = await Promise.all([
        ResourceStore.loadResourceTypes(activeRoomId),
        ResourceStore.loadInventory(activeRoomId),
      ]);
      setResourceTypes(types);
      setInventory(inv);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  }, [activeRoomId]);

  useEffect(() => { loadOrgRooms(); }, [loadOrgRooms]);
  useEffect(() => { loadResources(); }, [loadResources]);

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !activeRoomId) return;
    try {
      await ResourceStore.createResourceType(activeRoomId, createForm);
      setShowCreate(false);
      setCreateForm({ name: '', category: 'general', unit: 'unit', description: '' });
      await loadResources();
    } catch (err) {
      console.error('Failed to create resource type:', err);
    }
  };

  const handleSaveInventory = async () => {
    if (!editingInventory || !activeRoomId) return;
    try {
      await ResourceStore.setInventory(activeRoomId, editingInventory, inventoryForm);
      setEditingInventory(null);
      await loadResources();
    } catch (err) {
      console.error('Failed to save inventory:', err);
    }
  };

  const filteredTypes = filter === 'all'
    ? resourceTypes
    : resourceTypes.filter(r => r.category === filter);

  // Merge inventory data
  const invMap = new Map(inventory.map(i => [i.typeId, i]));

  if (loading) {
    return <div className="empty-state"><div className="empty-state-desc">Loading resources...</div></div>;
  }

  return (
    <div>
      {/* Room selector */}
      {orgRooms.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {orgRooms.map(r => (
            <button
              key={r.roomId}
              className={`btn-ghost btn-sm ${activeRoomId === r.roomId ? 'active' : ''}`}
              onClick={() => { setActiveRoomId(r.roomId); }}
              style={activeRoomId === r.roomId ? { background: 'var(--gold-dim)', color: 'var(--gold)' } : {}}
            >
              {r.roomName}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn-ghost btn-sm ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
            style={filter === 'all' ? { background: 'var(--gold-dim)', color: 'var(--gold)' } : {}}
          >
            All ({resourceTypes.length})
          </button>
          {RESOURCE_CATEGORIES.filter(c => resourceTypes.some(r => r.category === c)).map(c => (
            <button
              key={c}
              className={`btn-ghost btn-sm ${filter === c ? 'active' : ''}`}
              onClick={() => setFilter(c)}
              style={filter === c ? { background: 'var(--gold-dim)', color: 'var(--gold)' } : {}}
            >
              {c}
            </button>
          ))}
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={12} /> New Resource
        </button>
      </div>

      {/* Resource table */}
      {filteredTypes.length === 0 ? (
        <div className="empty-state" style={{ minHeight: 300 }}>
          <Icon name="package" size={40} color="var(--tx-3)" className="empty-state-icon" />
          <div className="empty-state-title">No Resources</div>
          <div className="empty-state-desc">
            Define resource types to track allocations. Resources can be housing vouchers, financial aid, services, and more.
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 16 }}>
            <Icon name="plus" size={14} /> Create Resource Type
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }}>Resource</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }}>Category</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }}>Capacity</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }}>Available</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }}>Allocated</th>
                <th style={{ padding: '8px 12px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map(rt => {
                const inv = invMap.get(rt.typeId) || {};
                return (
                  <tr key={rt.typeId} style={{ borderBottom: '1px solid var(--bd)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={CATEGORY_ICONS[rt.category] || 'package'} size={14} color="var(--tx-3)" />
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{rt.name}</div>
                          {rt.description && <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{rt.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--tx-2)' }}>{rt.category}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--tx-2)' }}>{inv.capacity ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: inv.available > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {inv.available ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--tx-2)' }}>{inv.allocated ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button className="btn-ghost btn-sm" onClick={() => {
                        setEditingInventory(rt.typeId);
                        setInventoryForm({
                          capacity: inv.capacity || 0,
                          available: inv.available || 0,
                          fundingSource: inv.funding_source || '',
                        });
                      }}>
                        <Icon name="edit-2" size={12} /> Inventory
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Resource Modal */}
      {showCreate && (
        <Modal title="New Resource Type" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateType}>
            <div className="field-group">
              <label>Name</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bus Pass" autoFocus />
            </div>
            <div className="field-group">
              <label>Category</label>
              <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}>
                {RESOURCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Unit</label>
              <input type="text" value={createForm.unit} onChange={e => setCreateForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. voucher, dollar, hour" />
            </div>
            <div className="field-group">
              <label>Description</label>
              <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional description" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!createForm.name.trim()}>Create</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Inventory Modal */}
      {editingInventory && (
        <Modal title="Set Inventory" onClose={() => setEditingInventory(null)}>
          <div className="field-group">
            <label>Capacity</label>
            <input type="number" value={inventoryForm.capacity} onChange={e => setInventoryForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
          </div>
          <div className="field-group">
            <label>Available</label>
            <input type="number" value={inventoryForm.available} onChange={e => setInventoryForm(f => ({ ...f, available: Number(e.target.value) }))} />
          </div>
          <div className="field-group">
            <label>Funding Source</label>
            <input type="text" value={inventoryForm.fundingSource} onChange={e => setInventoryForm(f => ({ ...f, fundingSource: e.target.value }))} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-ghost" onClick={() => setEditingInventory(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveInventory}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
