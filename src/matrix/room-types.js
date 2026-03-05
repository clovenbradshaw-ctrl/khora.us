/**
 * Room type classification — identifies Khora room types from Matrix state.
 *
 * Ported from existing Khora provenance.js classifyRoom.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const ROOM_TYPES = Object.freeze({
  VAULT:          'vault',
  BRIDGE:         'bridge',
  ORG:            'org',
  ROSTER:         'roster',
  SCHEMA:         'schema',
  METRICS:        'metrics',
  NETWORK:        'network',
  CLIENT_RECORD:  'client_record',
  TEAM:           'team',
  UNKNOWN:        'unknown',
});

export const ROOM_COLORS = Object.freeze({
  vault:          'teal',
  bridge:         'blue',
  roster:         'gold',
  org:            'blue',
  schema:         'purple',
  metrics:        'orange',
  network:        'green',
  client_record:  'teal',
  team:           'purple',
  unknown:        'orange',
});

export const ROOM_LABELS = Object.freeze({
  vault:          'Personal Vault',
  bridge:         'Bridge Room',
  roster:         'Team Member Roster',
  org:            'Organization',
  schema:         'Schema Room',
  metrics:        'Metrics Room',
  network:        'Network Room',
  client_record:  'Personal Record',
  team:           'Team Room',
  unknown:        'Unknown',
});

const ACCOUNT_TYPE_MAP = {
  client:         'vault',
  client_record:  'client_record',
  provider:       'roster',
  organization:   'org',
  schema:         'schema',
  metrics:        'metrics',
  network:        'network',
  team:           'team',
};

/**
 * Classify a room by reading its identity or bridge state.
 * Returns { type, label, color }.
 */
export async function classifyRoom(roomId, scannedState = null) {
  const state = scannedState || {};

  // Check identity state event
  const identity = state[EVT.IDENTITY] || await MatrixService.getState(roomId, EVT.IDENTITY);
  if (identity?.account_type) {
    const type = ACCOUNT_TYPE_MAP[identity.account_type] || 'unknown';
    return {
      type,
      label: ROOM_LABELS[type] || 'Unknown',
      color: ROOM_COLORS[type] || 'orange',
    };
  }

  // Check bridge meta
  const bridgeMeta = state[EVT.BRIDGE_META] || await MatrixService.getState(roomId, EVT.BRIDGE_META);
  if (bridgeMeta) {
    return { type: 'bridge', label: 'Bridge Room', color: 'blue' };
  }

  return { type: 'unknown', label: 'Unknown', color: 'orange' };
}
