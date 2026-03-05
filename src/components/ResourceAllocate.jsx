import { useState, useEffect } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import { ResourceStore } from '../matrix/resource-store.js';
import { MatrixService } from '../matrix/service.js';
import { EVT, RESOURCE_CATEGORIES } from '../engine/operators.js';

/**
 * ResourceAllocate — modal for allocating a resource to an individual in a bridge room.
 */
export default function ResourceAllocate({ bridgeRoomId, onClose, onAllocated }) {
  const [orgRooms, setOrgRooms] = useState([]);
  const [selectedOrgRoom, setSelectedOrgRoom] = useState(null);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const scanned = await MatrixService.scanRooms([EVT.IDENTITY]);
      const orgs = scanned.filter(r => {
        const t = r.state[EVT.IDENTITY]?.account_type;
        return t === 'organization' || t === 'team';
      });
      setOrgRooms(orgs);
      if (orgs.length > 0) {
        setSelectedOrgRoom(orgs[0].roomId);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedOrgRoom) return;
    (async () => {
      const types = await ResourceStore.loadResourceTypes(selectedOrgRoom);
      setResourceTypes(types);
    })();
  }, [selectedOrgRoom]);

  const handleAllocate = async () => {
    if (!selectedType || !bridgeRoomId) return;
    setSubmitting(true);
    try {
      await ResourceStore.allocateResource(bridgeRoomId, {
        typeId: selectedType.typeId,
        typeName: selectedType.name,
        quantity,
        notes,
      });
      onAllocated?.();
      onClose();
    } catch (err) {
      console.error('Allocation failed:', err);
    }
    setSubmitting(false);
  };

  return (
    <Modal title="Allocate Resource" onClose={onClose}>
      {orgRooms.length > 1 && (
        <div className="field-group">
          <label>From Organization</label>
          <select value={selectedOrgRoom || ''} onChange={e => setSelectedOrgRoom(e.target.value)}>
            {orgRooms.map(r => <option key={r.roomId} value={r.roomId}>{r.roomName}</option>)}
          </select>
        </div>
      )}
      <div className="field-group">
        <label>Resource</label>
        {resourceTypes.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>No resources available. Create resource types first.</div>
        ) : (
          <select
            value={selectedType?.typeId || ''}
            onChange={e => setSelectedType(resourceTypes.find(r => r.typeId === e.target.value))}
          >
            <option value="">Select resource...</option>
            {resourceTypes.map(r => (
              <option key={r.typeId} value={r.typeId}>{r.name} ({r.category})</option>
            ))}
          </select>
        )}
      </div>
      <div className="field-group">
        <label>Quantity</label>
        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} />
      </div>
      <div className="field-group">
        <label>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleAllocate} disabled={submitting || !selectedType}>
          {submitting ? 'Allocating...' : 'Allocate'}
        </button>
      </div>
    </Modal>
  );
}
