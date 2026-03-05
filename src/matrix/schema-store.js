/**
 * SchemaStore — CRUD for schema/form definitions via Matrix state events.
 *
 * Forms are stored as SCHEMA_FORM state events.
 * Fields as SCHEMA_FIELD, bindings as SCHEMA_BINDING.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const SchemaStore = {
  /**
   * Find schema rooms from joined rooms.
   */
  async findSchemaRooms() {
    const scanned = await MatrixService.scanRooms([EVT.IDENTITY]);
    return scanned.filter(r => r.state[EVT.IDENTITY]?.account_type === 'schema');
  },

  /**
   * Load all forms from a schema room.
   */
  async loadForms(roomId) {
    const formEvents = await MatrixService.getAllState(roomId, EVT.SCHEMA_FORM);
    return formEvents
      .map(e => ({ formId: e.stateKey, ...e.content }))
      .filter(f => !f.deleted);
  },

  /**
   * Save a form definition.
   */
  async saveForm(roomId, formId, formData) {
    await MatrixService.setState(roomId, EVT.SCHEMA_FORM, formId, {
      ...formData,
      formId,
      updated: new Date().toISOString(),
      updated_by: MatrixService.userId,
    });
  },

  /**
   * Create a new form.
   */
  async createForm(roomId, { name, description = '', sections = [] }) {
    const formId = `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.saveForm(roomId, formId, {
      name,
      description,
      sections,
      version: 1,
      status: 'draft',
      created: new Date().toISOString(),
      created_by: MatrixService.userId,
    });
    return formId;
  },

  /**
   * Delete a form (soft delete).
   */
  async deleteForm(roomId, formId) {
    const current = await MatrixService.getState(roomId, EVT.SCHEMA_FORM, formId) || {};
    await MatrixService.setState(roomId, EVT.SCHEMA_FORM, formId, {
      ...current,
      deleted: true,
      deleted_by: MatrixService.userId,
      deleted_at: new Date().toISOString(),
    });
  },

  /**
   * Load fields for a form.
   */
  async loadFields(roomId) {
    const fieldEvents = await MatrixService.getAllState(roomId, EVT.SCHEMA_FIELD);
    return fieldEvents
      .map(e => ({ fieldId: e.stateKey, ...e.content }))
      .filter(f => !f.deleted);
  },

  /**
   * Save a field definition.
   */
  async saveField(roomId, fieldId, fieldData) {
    await MatrixService.setState(roomId, EVT.SCHEMA_FIELD, fieldId, {
      ...fieldData,
      fieldId,
      updated: new Date().toISOString(),
    });
  },

  /**
   * Load bindings for a form.
   */
  async loadBindings(roomId) {
    const bindingEvents = await MatrixService.getAllState(roomId, EVT.SCHEMA_BINDING);
    return bindingEvents
      .map(e => ({ bindingId: e.stateKey, ...e.content }))
      .filter(b => !b.deleted);
  },

  /**
   * Save a binding.
   */
  async saveBinding(roomId, bindingId, bindingData) {
    await MatrixService.setState(roomId, EVT.SCHEMA_BINDING, bindingId, {
      ...bindingData,
      bindingId,
      updated: new Date().toISOString(),
    });
  },

  /**
   * Create a schema room.
   */
  async createSchemaRoom(name = 'Schema') {
    return await MatrixService.createRoom({
      name: `Schema: ${name}`,
      initialState: [
        {
          type: EVT.IDENTITY,
          state_key: '',
          content: { account_type: 'schema' },
        },
      ],
    });
  },
};
