import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';
import Modal from './common/Modal.jsx';
import { SchemaStore } from '../matrix/schema-store.js';
import { FIELD_TYPES, LAYERS } from '../schema/fields.js';
import { PROPAGATION_LEVELS } from '../engine/operators.js';

/**
 * SchemaBuilder — form builder for creating and editing schema forms.
 *
 * Left sidebar: form list + create.
 * Main area: form editor with sections, questions, field types.
 */
export default function SchemaBuilder() {
  const [schemaRooms, setSchemaRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');

  const loadSchemaRooms = useCallback(async () => {
    setLoading(true);
    try {
      const rooms = await SchemaStore.findSchemaRooms();
      setSchemaRooms(rooms);
      if (rooms.length > 0 && !activeRoomId) {
        setActiveRoomId(rooms[0].roomId);
      }
    } catch (err) {
      console.error('Failed to load schema rooms:', err);
    }
    setLoading(false);
  }, [activeRoomId]);

  const loadForms = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const f = await SchemaStore.loadForms(activeRoomId);
      setForms(f);
    } catch (err) {
      console.error('Failed to load forms:', err);
    }
  }, [activeRoomId]);

  useEffect(() => { loadSchemaRooms(); }, [loadSchemaRooms]);
  useEffect(() => { loadForms(); }, [loadForms]);

  useEffect(() => {
    if (selectedFormId && forms.length > 0) {
      const form = forms.find(f => f.formId === selectedFormId);
      setSelectedForm(form || null);
    } else {
      setSelectedForm(null);
    }
  }, [selectedFormId, forms]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const result = await SchemaStore.createSchemaRoom(newRoomName.trim());
      setShowCreateRoom(false);
      setNewRoomName('');
      await loadSchemaRooms();
      setActiveRoomId(result.room_id);
    } catch (err) {
      console.error('Failed to create schema room:', err);
    }
  };

  const handleCreateForm = async () => {
    if (!newFormName.trim() || !activeRoomId) return;
    try {
      const formId = await SchemaStore.createForm(activeRoomId, {
        name: newFormName.trim(),
        sections: [{ key: 'default', label: 'General', fields: [] }],
      });
      setShowCreateForm(false);
      setNewFormName('');
      await loadForms();
      setSelectedFormId(formId);
    } catch (err) {
      console.error('Failed to create form:', err);
    }
  };

  const handleAddSection = async () => {
    if (!selectedForm || !activeRoomId) return;
    const sectionKey = `section_${Date.now()}`;
    const updatedSections = [
      ...(selectedForm.sections || []),
      { key: sectionKey, label: 'New Section', fields: [] },
    ];
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      sections: updatedSections,
    });
    await loadForms();
  };

  const handleAddField = async (sectionIdx) => {
    if (!selectedForm || !activeRoomId) return;
    const sections = [...(selectedForm.sections || [])];
    const fieldKey = `field_${Date.now()}`;
    sections[sectionIdx] = {
      ...sections[sectionIdx],
      fields: [
        ...(sections[sectionIdx].fields || []),
        { key: fieldKey, label: 'New Field', type: 'text', layer: 'given' },
      ],
    };
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      sections,
    });
    await loadForms();
  };

  const handleUpdateField = async (sectionIdx, fieldIdx, updates) => {
    if (!selectedForm || !activeRoomId) return;
    const sections = [...(selectedForm.sections || [])];
    const fields = [...sections[sectionIdx].fields];
    fields[fieldIdx] = { ...fields[fieldIdx], ...updates };
    sections[sectionIdx] = { ...sections[sectionIdx], fields };
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      sections,
    });
    await loadForms();
  };

  const handleRemoveField = async (sectionIdx, fieldIdx) => {
    if (!selectedForm || !activeRoomId) return;
    const sections = [...(selectedForm.sections || [])];
    const fields = [...sections[sectionIdx].fields];
    fields.splice(fieldIdx, 1);
    sections[sectionIdx] = { ...sections[sectionIdx], fields };
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      sections,
    });
    await loadForms();
  };

  const handleUpdateSection = async (sectionIdx, updates) => {
    if (!selectedForm || !activeRoomId) return;
    const sections = [...(selectedForm.sections || [])];
    sections[sectionIdx] = { ...sections[sectionIdx], ...updates };
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      sections,
    });
    await loadForms();
  };

  const handleDeleteForm = async (formId) => {
    if (!activeRoomId) return;
    await SchemaStore.deleteForm(activeRoomId, formId);
    if (selectedFormId === formId) setSelectedFormId(null);
    await loadForms();
  };

  const handleVersionBump = async () => {
    if (!selectedForm || !activeRoomId) return;
    await SchemaStore.saveForm(activeRoomId, selectedForm.formId, {
      ...selectedForm,
      version: (selectedForm.version || 1) + 1,
    });
    await loadForms();
  };

  if (loading) {
    return <div className="empty-state"><div className="empty-state-desc">Loading schema...</div></div>;
  }

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      {/* Left sidebar: rooms + forms */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--bd)', paddingRight: 16 }}>
        {/* Schema rooms */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 8, textTransform: 'uppercase' }}>
          Schema Rooms
        </div>
        {schemaRooms.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 12 }}>No schema rooms</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {schemaRooms.map(r => (
              <button
                key={r.roomId}
                onClick={() => { setActiveRoomId(r.roomId); setSelectedFormId(null); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                  fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: activeRoomId === r.roomId ? 'var(--purple-dim)' : 'none',
                  color: activeRoomId === r.roomId ? 'var(--purple)' : 'var(--tx-2)',
                }}
              >
                {r.roomName}
              </button>
            ))}
          </div>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setShowCreateRoom(true)} style={{ width: '100%', fontSize: 11 }}>
          <Icon name="plus" size={10} /> New Room
        </button>

        {/* Forms */}
        {activeRoomId && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' }}>
              Forms
            </div>
            {forms.map(f => (
              <button
                key={f.formId}
                onClick={() => setSelectedFormId(f.formId)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                  fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: selectedFormId === f.formId ? 'var(--gold-dim)' : 'none',
                  color: selectedFormId === f.formId ? 'var(--gold)' : 'var(--tx-2)',
                }}
              >
                {f.name} <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>v{f.version || 1}</span>
              </button>
            ))}
            <button className="btn-ghost btn-sm" onClick={() => setShowCreateForm(true)} style={{ width: '100%', fontSize: 11, marginTop: 4 }}>
              <Icon name="plus" size={10} /> New Form
            </button>
          </>
        )}
      </div>

      {/* Main area: form editor */}
      <div style={{ flex: 1 }}>
        {!selectedForm ? (
          <div className="empty-state" style={{ minHeight: 400 }}>
            <Icon name="database" size={40} color="var(--tx-3)" className="empty-state-icon" />
            <div className="empty-state-title">Schema Workbench</div>
            <div className="empty-state-desc">
              Select a form to edit, or create a new one. Forms define the fields collected via EO operators.
            </div>
          </div>
        ) : (
          <div>
            {/* Form header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-0)' }}>{selectedForm.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                  v{selectedForm.version || 1} · {selectedForm.status || 'draft'} · {selectedForm.sections?.length || 0} sections
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost btn-sm" onClick={handleVersionBump}>
                  <Icon name="git-branch" size={12} /> Bump Version
                </button>
                <button className="btn-ghost btn-sm" onClick={() => handleDeleteForm(selectedForm.formId)} style={{ color: 'var(--red)' }}>
                  <Icon name="trash-2" size={12} /> Delete
                </button>
              </div>
            </div>

            {/* Sections */}
            {(selectedForm.sections || []).map((section, si) => (
              <div key={section.key} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <input
                    type="text"
                    value={section.label}
                    onChange={e => handleUpdateSection(si, { label: e.target.value })}
                    style={{ fontSize: 14, fontWeight: 600, border: 'none', background: 'none', color: 'var(--tx-0)', padding: 0 }}
                  />
                  <button className="btn-ghost btn-sm" onClick={() => handleAddField(si)}>
                    <Icon name="plus" size={10} /> Field
                  </button>
                </div>

                {(section.fields || []).map((field, fi) => (
                  <div key={field.key} style={{
                    display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                    borderTop: fi > 0 ? '1px solid var(--bd)' : 'none',
                  }}>
                    <input
                      type="text"
                      value={field.label}
                      onChange={e => handleUpdateField(si, fi, { label: e.target.value })}
                      style={{ flex: 2, fontSize: 12, padding: '4px 6px' }}
                      placeholder="Label"
                    />
                    <input
                      type="text"
                      value={field.key}
                      onChange={e => handleUpdateField(si, fi, { key: e.target.value })}
                      style={{ flex: 1, fontSize: 11, padding: '4px 6px', fontFamily: 'monospace' }}
                      placeholder="key"
                    />
                    <select
                      value={field.type}
                      onChange={e => handleUpdateField(si, fi, { type: e.target.value })}
                      style={{ fontSize: 11, padding: '4px' }}
                    >
                      {Object.values(FIELD_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                      value={field.layer || 'given'}
                      onChange={e => handleUpdateField(si, fi, { layer: e.target.value })}
                      style={{ fontSize: 11, padding: '4px' }}
                    >
                      <option value="given">given</option>
                      <option value="framework">framework</option>
                      <option value="meant">meant</option>
                    </select>
                    <button className="btn-icon" onClick={() => handleRemoveField(si, fi)}>
                      <Icon name="x" size={12} color="var(--red)" />
                    </button>
                  </div>
                ))}

                {(section.fields || []).length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--tx-3)', padding: '8px 0' }}>
                    No fields. Click "+ Field" to add one.
                  </div>
                )}
              </div>
            ))}

            <button className="btn-ghost" onClick={handleAddSection} style={{ width: '100%', marginTop: 8 }}>
              <Icon name="plus" size={14} /> Add Section
            </button>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <Modal title="Create Schema Room" onClose={() => setShowCreateRoom(false)}>
          <div className="field-group">
            <label>Room Name</label>
            <input type="text" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. Main Schema" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setShowCreateRoom(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateRoom} disabled={!newRoomName.trim()}>Create</button>
          </div>
        </Modal>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <Modal title="New Form" onClose={() => setShowCreateForm(false)}>
          <div className="field-group">
            <label>Form Name</label>
            <input type="text" value={newFormName} onChange={e => setNewFormName(e.target.value)} placeholder="e.g. Intake Assessment" autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateForm} disabled={!newFormName.trim()}>Create</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
