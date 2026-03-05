/**
 * GovernanceStore — CRUD for governance proposals and rhythms via Matrix.
 *
 * Proposals as GOV_PROPOSAL state events (keyed by proposalId).
 * Consent positions as timeline events.
 * Rhythms as GOV_RHYTHM state events.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from './service.js';

export const GovernanceStore = {
  /**
   * Load all proposals from a room.
   */
  async loadProposals(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.GOV_PROPOSAL);
    return events
      .map(e => ({ proposalId: e.stateKey, ...e.content }))
      .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
  },

  /**
   * Create a new proposal.
   */
  async createProposal(roomId, { title, description, type = 'general', targetRef = '' }) {
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await MatrixService.setState(roomId, EVT.GOV_PROPOSAL, proposalId, {
      proposalId,
      title,
      description,
      type,
      targetRef,
      status: 'submitted',
      positions: {},
      created: new Date().toISOString(),
      created_by: MatrixService.userId,
    });
    return proposalId;
  },

  /**
   * Update proposal status.
   */
  async updateProposalStatus(roomId, proposalId, status) {
    const current = await MatrixService.getState(roomId, EVT.GOV_PROPOSAL, proposalId) || {};
    await MatrixService.setState(roomId, EVT.GOV_PROPOSAL, proposalId, {
      ...current,
      status,
      status_updated: new Date().toISOString(),
      status_updated_by: MatrixService.userId,
    });
  },

  /**
   * Submit a consent position on a proposal.
   */
  async submitPosition(roomId, proposalId, position, notes = '') {
    const current = await MatrixService.getState(roomId, EVT.GOV_PROPOSAL, proposalId) || {};
    const positions = { ...(current.positions || {}) };
    positions[MatrixService.userId] = {
      position,
      notes,
      submitted: new Date().toISOString(),
    };

    await MatrixService.setState(roomId, EVT.GOV_PROPOSAL, proposalId, {
      ...current,
      positions,
    });

    // Check if consent is reached
    return this._evaluateConsent(roomId, { ...current, positions });
  },

  /**
   * Evaluate consent based on team's consent mode.
   */
  async _evaluateConsent(roomId, proposal) {
    const teamMeta = await MatrixService.getState(roomId, EVT.TEAM_META);
    const mode = teamMeta?.consent_mode || 'lead_decides';
    const members = await MatrixService.getState(roomId, EVT.TEAM_MEMBERS);
    const memberCount = members?.members?.length || 1;
    const positions = proposal.positions || {};
    const positionValues = Object.values(positions).map(p => p.position);

    // Check for blocks
    if (positionValues.includes('cannot_adopt')) {
      return { resolved: true, outcome: 'blocked' };
    }

    const adoptCount = positionValues.filter(p =>
      p === 'adopt_as_is' || p === 'adopt_with_extension'
    ).length;

    if (mode === 'lead_decides') {
      const leadPosition = positions[proposal.created_by];
      if (leadPosition?.position === 'adopt_as_is' || leadPosition?.position === 'adopt_with_extension') {
        return { resolved: true, outcome: 'adopted' };
      }
    } else if (mode === 'majority') {
      if (adoptCount > memberCount / 2) {
        return { resolved: true, outcome: 'adopted' };
      }
    } else if (mode === 'unanimous') {
      if (adoptCount === memberCount) {
        return { resolved: true, outcome: 'adopted' };
      }
    }

    return { resolved: false };
  },

  /**
   * Load governance rhythms.
   */
  async loadRhythms(roomId) {
    const events = await MatrixService.getAllState(roomId, EVT.GOV_RHYTHM);
    return events.map(e => ({ rhythmId: e.stateKey, ...e.content }));
  },

  /**
   * Set a governance rhythm.
   */
  async setRhythm(roomId, rhythmId, { name, frequency, description = '', nextDue = '' }) {
    await MatrixService.setState(roomId, EVT.GOV_RHYTHM, rhythmId, {
      rhythmId,
      name,
      frequency,
      description,
      nextDue,
      updated: new Date().toISOString(),
    });
  },
};
