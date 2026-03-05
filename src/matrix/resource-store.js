/**
 * ResourceStore — CRUD for resource tracking via Matrix.
 *
 * Resource types in org/network rooms (state events).
 * Inventory in org rooms (state events).
 * Allocations in bridge rooms (timeline events).
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const ResourceStore = {
  /**
   * Load all resource types from a room.
   */
  async loadResourceTypes(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.RESOURCE_TYPE);
    return events
      .map(e => ({ typeId: e.stateKey, ...e.content }))
      .filter(r => !r.deleted);
  },

  /**
   * Create a resource type definition.
   */
  async createResourceType(roomId, { name, category, unit = 'unit', description = '', constraints = {} }) {
    const typeId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await MatrixService.setState(roomId, EVT.RESOURCE_TYPE, typeId, {
      name,
      category,
      unit,
      description,
      constraints,
      typeId,
      created: new Date().toISOString(),
      created_by: MatrixService.userId,
    });
    return typeId;
  },

  /**
   * Update a resource type.
   */
  async updateResourceType(roomId, typeId, updates) {
    const current = await MatrixService.getState(roomId, EVT.RESOURCE_TYPE, typeId) || {};
    await MatrixService.setState(roomId, EVT.RESOURCE_TYPE, typeId, {
      ...current,
      ...updates,
      updated: new Date().toISOString(),
    });
  },

  /**
   * Load inventory for a room.
   */
  async loadInventory(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.RESOURCE_INVENTORY);
    return events
      .map(e => ({ typeId: e.stateKey, ...e.content }))
      .filter(i => !i.deleted);
  },

  /**
   * Set inventory for a resource type.
   */
  async setInventory(roomId, typeId, { capacity, available, fundingSource = '' }) {
    await MatrixService.setState(roomId, EVT.RESOURCE_INVENTORY, typeId, {
      typeId,
      capacity,
      available,
      allocated: (capacity || 0) - (available || 0),
      funding_source: fundingSource,
      updated: new Date().toISOString(),
      updated_by: MatrixService.userId,
    });
  },

  /**
   * Allocate a resource to an individual (timeline event in bridge room).
   */
  async allocateResource(bridgeRoomId, { typeId, typeName, quantity = 1, notes = '' }) {
    const allocId = `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await MatrixService.sendTimelineEvent(bridgeRoomId, EVT.RESOURCE_ALLOC, {
      allocId,
      typeId,
      typeName,
      quantity,
      status: 'active',
      notes,
      allocated_by: MatrixService.userId,
      allocated_at: new Date().toISOString(),
    });
    return allocId;
  },

  /**
   * Record a resource lifecycle event (consumed, expired, revoked).
   */
  async recordResourceEvent(bridgeRoomId, { allocId, event, notes = '' }) {
    await MatrixService.sendTimelineEvent(bridgeRoomId, EVT.RESOURCE_EVENT, {
      allocId,
      event, // 'consumed', 'expired', 'revoked', 'partial_consume'
      notes,
      recorded_by: MatrixService.userId,
      recorded_at: new Date().toISOString(),
    });
  },

  /**
   * Load allocations from a bridge room.
   */
  async loadAllocations(bridgeRoomId) {
    const events = await MatrixService.getRoomTimeline(bridgeRoomId, {
      filter: (type) => type === EVT.RESOURCE_ALLOC || type === EVT.RESOURCE_EVENT,
    });

    // Build allocation map with latest status
    const allocMap = new Map();
    for (const ev of events) {
      if (ev.content.allocId) {
        if (ev.type === EVT.RESOURCE_ALLOC) {
          allocMap.set(ev.content.allocId, { ...ev.content });
        } else if (ev.type === EVT.RESOURCE_EVENT) {
          const existing = allocMap.get(ev.content.allocId);
          if (existing) {
            existing.status = ev.content.event;
            existing.lastEvent = ev.content;
          }
        }
      }
    }

    return [...allocMap.values()];
  },

  /**
   * Load resource policies from a room.
   */
  async loadPolicies(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.RESOURCE_POLICY);
    return events.map(e => ({ policyId: e.stateKey, ...e.content }));
  },

  /**
   * Set a resource policy.
   */
  async setPolicy(roomId, policyId, policyData) {
    await MatrixService.setState(roomId, EVT.RESOURCE_POLICY, policyId, {
      ...policyData,
      policyId,
      updated: new Date().toISOString(),
    });
  },
};
