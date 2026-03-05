/**
 * AccessControl — field-level access grants for the two-domain model.
 *
 * Subject controls access, not visibility:
 * - Subject domain (vault room): claims the individual can see
 * - Provider domain (bridge room): provider-internal claims
 *
 * Access grants are stored as io.khora.claim.access state events
 * in the vault room, keyed by provider user ID.
 */

import { EVT } from '../engine/operators.js';
import { MatrixService } from '../matrix/service.js';

export const AccessControl = {
  /**
   * Get all field access grants for a vault room.
   * Returns Map<fieldKey, Set<providerUserId>>.
   */
  async getGrants(vaultRoomId) {
    const grants = new Map();

    if (!MatrixService.client) return grants;

    const room = MatrixService.client.getRoom(vaultRoomId);
    if (!room) return grants;

    // Read all io.khora.claim.access state events (keyed by provider userId)
    const stateEvents = room.currentState.getStateEvents(EVT.CLAIM_ACCESS);
    if (!stateEvents) return grants;

    const events = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
    for (const ev of events) {
      const content = ev.getContent();
      const providerUserId = ev.getStateKey();
      const fields = content?.fields || [];

      for (const fieldKey of fields) {
        if (!grants.has(fieldKey)) {
          grants.set(fieldKey, new Set());
        }
        grants.get(fieldKey).add(providerUserId);
      }
    }

    return grants;
  },

  /**
   * Get grants as a simpler structure: Map<providerUserId, Set<fieldKey>>.
   */
  async getGrantsByProvider(vaultRoomId) {
    const providerGrants = new Map();

    if (!MatrixService.client) return providerGrants;

    const room = MatrixService.client.getRoom(vaultRoomId);
    if (!room) return providerGrants;

    const stateEvents = room.currentState.getStateEvents(EVT.CLAIM_ACCESS);
    if (!stateEvents) return providerGrants;

    const events = Array.isArray(stateEvents) ? stateEvents : [stateEvents];
    for (const ev of events) {
      const content = ev.getContent();
      const providerUserId = ev.getStateKey();
      providerGrants.set(providerUserId, new Set(content?.fields || []));
    }

    return providerGrants;
  },

  /**
   * Set field access for a specific provider.
   * @param {boolean} granted - true to grant, false to revoke
   */
  async setFieldAccess(vaultRoomId, fieldKey, providerUserId, granted) {
    // Read current grants for this provider
    const current = await MatrixService.getState(vaultRoomId, EVT.CLAIM_ACCESS, providerUserId);
    const fields = new Set(current?.fields || []);

    if (granted) {
      fields.add(fieldKey);
    } else {
      fields.delete(fieldKey);
    }

    return await MatrixService.setState(vaultRoomId, EVT.CLAIM_ACCESS, providerUserId, {
      fields: [...fields],
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Bulk set field access for a provider.
   */
  async setFieldAccessBulk(vaultRoomId, providerUserId, fieldKeys) {
    return await MatrixService.setState(vaultRoomId, EVT.CLAIM_ACCESS, providerUserId, {
      fields: fieldKeys,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Filter claim stacks to only include fields a provider is authorized to access.
   * @param {Map<fieldKey, stack>} stacks - full claim stacks
   * @param {string} providerUserId
   * @param {Map<fieldKey, Set<providerUserId>>} grants
   * @returns {Map<fieldKey, stack>} filtered stacks
   */
  filterClaimsForProvider(stacks, providerUserId, grants) {
    const filtered = new Map();

    for (const [fieldKey, stack] of stacks) {
      const authorizedProviders = grants.get(fieldKey);
      if (authorizedProviders && authorizedProviders.has(providerUserId)) {
        filtered.set(fieldKey, stack);
      }
    }

    return filtered;
  },

  /**
   * Mark a profile as claimable by the real individual.
   * The creator sets this when they create a profile on someone's behalf.
   */
  async markClaimable(vaultRoomId) {
    return await MatrixService.setState(vaultRoomId, EVT.ACCOUNT_CLAIM, '', {
      claimable: true,
      claimedBy: null,
      createdBy: MatrixService.userId,
      markedAt: new Date().toISOString(),
    });
  },

  /**
   * Get the claim status for a vault room.
   */
  async getClaimStatus(vaultRoomId) {
    return await MatrixService.getState(vaultRoomId, EVT.ACCOUNT_CLAIM) || {
      claimable: false,
      claimedBy: null,
    };
  },

  /**
   * Claim an account — transfers ownership to the claimant.
   * The claimant gets PL 100 (sovereign), original creator gets PL 50 (provider).
   */
  async claimAccount(vaultRoomId) {
    const claimStatus = await this.getClaimStatus(vaultRoomId);
    if (!claimStatus.claimable) {
      throw new Error('This profile is not claimable');
    }
    if (claimStatus.claimedBy) {
      throw new Error('This profile has already been claimed');
    }

    const claimantId = MatrixService.userId;
    const creatorId = claimStatus.createdBy;

    // Transfer power levels: claimant gets 100, creator demoted to 50
    await MatrixService.setPowerLevels(vaultRoomId, {
      [claimantId]: 100,
      [creatorId]: 50,
    });

    // Update claim state
    return await MatrixService.setState(vaultRoomId, EVT.ACCOUNT_CLAIM, '', {
      claimable: false,
      claimedBy: claimantId,
      claimedAt: new Date().toISOString(),
      createdBy: creatorId,
    });
  },

  /**
   * Hard revoke — tombstone bridge, remove all grants for provider.
   */
  async revokeProvider(vaultRoomId, bridgeRoomId, providerUserId) {
    // Remove all field grants
    await MatrixService.setState(vaultRoomId, EVT.CLAIM_ACCESS, providerUserId, {
      fields: [],
      revoked: true,
      revokedAt: new Date().toISOString(),
    });

    // Tombstone the bridge room if we have permission
    try {
      await MatrixService.setState(bridgeRoomId, 'm.room.tombstone', '', {
        body: 'Access revoked by subject.',
        replacement_room: '',
      });
    } catch {
      // May not have permission — that's ok, grant removal is the primary action
    }
  },
};
