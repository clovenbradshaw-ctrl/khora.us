/**
 * UserTableStore — CRUD for user table definitions and records via Matrix.
 *
 * User tables are their own room type (account_type: 'user_table').
 * Table definitions (columns) are stored as USER_TABLE_DEF state events.
 * Individual user records are stored as USER_TABLE_RECORD state events,
 * keyed by a unique record ID.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';
import { SECTIONS } from '../schema/fields.js';

export const UserTableStore = {
  /**
   * Create a new user table room with a default column definition
   * derived from the schema SECTIONS.
   * Returns { roomId, tableDef }.
   */
  async createTable({ name = 'Users', description = '' } = {}) {
    const columns = buildDefaultColumns();

    const result = await MatrixService.createRoom({
      name: `Table: ${name}`,
      initialState: [
        {
          type: EVT.IDENTITY,
          state_key: '',
          content: { account_type: 'user_table' },
        },
        {
          type: EVT.USER_TABLE_DEF,
          state_key: '',
          content: {
            name,
            description,
            columns,
            created: new Date().toISOString(),
            created_by: MatrixService.userId,
          },
        },
      ],
    });

    return {
      roomId: result.room_id,
      tableDef: { name, description, columns },
    };
  },

  /**
   * Find all user table rooms the current user has joined.
   * Returns [{ roomId, roomName, tableDef }].
   */
  async findTables() {
    const scanned = await MatrixService.scanRooms([EVT.IDENTITY, EVT.USER_TABLE_DEF]);
    return scanned
      .filter(r => r.state[EVT.IDENTITY]?.account_type === 'user_table')
      .map(r => ({
        roomId: r.roomId,
        roomName: r.roomName,
        tableDef: r.state[EVT.USER_TABLE_DEF] || {},
      }));
  },

  /**
   * Load the table definition for a given user table room.
   */
  async getTableDef(roomId) {
    return await MatrixService.getState(roomId, EVT.USER_TABLE_DEF) || {};
  },

  /**
   * Update columns or metadata on the table definition.
   */
  async updateTableDef(roomId, updates) {
    const current = await this.getTableDef(roomId);
    await MatrixService.setState(roomId, EVT.USER_TABLE_DEF, '', {
      ...current,
      ...updates,
      updated: new Date().toISOString(),
      updated_by: MatrixService.userId,
    });
  },

  /**
   * Add a column to the table definition.
   */
  async addColumn(roomId, column) {
    const def = await this.getTableDef(roomId);
    const columns = [...(def.columns || []), column];
    await this.updateTableDef(roomId, { columns });
  },

  /**
   * Remove a column from the table definition (by key).
   */
  async removeColumn(roomId, columnKey) {
    const def = await this.getTableDef(roomId);
    const columns = (def.columns || []).filter(c => c.key !== columnKey);
    await this.updateTableDef(roomId, { columns });
  },

  // ── Records ──────────────────────────────────────────────────────

  /**
   * Create a new user record in the table.
   * Returns { recordId, data }.
   */
  async createRecord(roomId, data) {
    const recordId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      ...data,
      recordId,
      created: new Date().toISOString(),
      created_by: MatrixService.userId,
    };
    await MatrixService.setState(roomId, EVT.USER_TABLE_RECORD, recordId, record);
    return { recordId, data: record };
  },

  /**
   * Load all user records from a table room.
   * Returns [{ recordId, ...data }].
   */
  async loadRecords(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.USER_TABLE_RECORD);
    return events
      .map(e => ({ recordId: e.stateKey, ...e.content }))
      .filter(r => !r.deleted);
  },

  /**
   * Update an existing user record.
   */
  async updateRecord(roomId, recordId, updates) {
    const current = await MatrixService.getState(roomId, EVT.USER_TABLE_RECORD, recordId) || {};
    await MatrixService.setState(roomId, EVT.USER_TABLE_RECORD, recordId, {
      ...current,
      ...updates,
      updated: new Date().toISOString(),
      updated_by: MatrixService.userId,
    });
  },

  /**
   * Soft-delete a user record.
   */
  async deleteRecord(roomId, recordId) {
    const current = await MatrixService.getState(roomId, EVT.USER_TABLE_RECORD, recordId) || {};
    await MatrixService.setState(roomId, EVT.USER_TABLE_RECORD, recordId, {
      ...current,
      deleted: true,
      deleted_by: MatrixService.userId,
      deleted_at: new Date().toISOString(),
    });
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build default columns from the schema SECTIONS.
 * Each field becomes a column with its type, label, section, and layer.
 */
function buildDefaultColumns() {
  const columns = [];
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      columns.push({
        key: field.key,
        label: field.label,
        type: field.type,
        layer: field.layer,
        section: section.key,
        sectionLabel: section.label,
        options: field.options || undefined,
      });
    }
  }
  return columns;
}
