/**
 * ClaimEngine — pure functions for claim stack state reconstruction.
 *
 * State is computed by replaying an append-only event stream.
 * Nothing is overwritten. Phases emerge from operations.
 *
 * All functions are stateless — no side effects, no I/O.
 */

import { OP, PHASES, MODE_PRIORITY } from './operators.js';

// ── Claim factory ───────────────────────────────────────────────────

let _claimSeq = 0;

export function makeClaimId(fieldKey) {
  return `${fieldKey}_${++_claimSeq}_${Date.now().toString(36)}`;
}

export function makeClaim({ id, value, agent, role, mode, phase, supersedes, timestamp, note, eventId, operator }) {
  return Object.freeze({
    id:         id || makeClaimId('c'),
    value:      value ?? '',
    agent:      agent ?? '',
    role:       role ?? '',
    mode:       mode ?? 'declared',
    phase:      phase ?? PHASES.SETTLED,
    supersedes: supersedes ?? null,
    timestamp:  timestamp ?? new Date().toISOString(),
    note:       note ?? null,
    eventId:    eventId ?? '',
    operator:   operator ?? OP.INS,
  });
}

// ── replayTo ────────────────────────────────────────────────────────
// Pure function. Takes event array + target date.
// Returns Map<fieldKey, { claims: Claim[], supFields: Set, heldFields: Set }>

export function replayTo(events, targetDate = null) {
  const stacks = new Map();   // fieldKey → { claims: [], supFields: Set, heldFields: Set, conLinks: Map }
  const targetTs = targetDate ? new Date(targetDate).getTime() : Infinity;

  // Sort chronologically
  const sorted = [...events].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const event of sorted) {
    if (new Date(event.date).getTime() > targetTs) break;

    const ops = event.ops || [];
    for (const op of ops) {
      processOp(stacks, op, event);
    }
  }

  // Compute phases for all stacks
  const result = new Map();
  for (const [fieldKey, stack] of stacks) {
    const resolved = resolveStack(stack);
    result.set(fieldKey, resolved);
  }

  return result;
}

function ensureStack(stacks, fieldKey) {
  if (!stacks.has(fieldKey)) {
    stacks.set(fieldKey, {
      claims: [],
      supFields: new Set(),
      heldFields: new Set(),
      conLinks: new Map(),     // claimId → supersedes claimId
      contestedPairs: [],      // [ [claimIdA, claimIdB], ... ]
    });
  }
  return stacks.get(fieldKey);
}

function processOp(stacks, op, event) {
  const field = op.field;

  switch (op.op) {
    case OP.NUL:
      // Case creation marker — no field state change
      break;

    case OP.DES: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      if (op.claimId && op.value !== undefined) {
        stack.claims.push({
          id:         op.claimId,
          value:      op.value,
          agent:      op.agent || event.agent,
          role:       op.role || event.agentRole || '',
          mode:       op.mode || 'declared',
          supersedes: null,
          timestamp:  event.date,
          note:       op.note || null,
          eventId:    event.id,
          operator:   OP.DES,
        });
      }
      break;
    }

    case OP.INS: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      if (op.claimId) {
        // If INS carries value data, build/update the claim
        if (op.value !== undefined) {
          const existing = stack.claims.find(c => c.id === op.claimId);
          if (!existing) {
            stack.claims.push({
              id:         op.claimId,
              value:      op.value,
              agent:      op.agent || event.agent,
              role:       op.role || event.agentRole || '',
              mode:       op.mode || 'declared',
              supersedes: op.supersedes || null,
              timestamp:  event.date,
              note:       op.note || null,
              eventId:    event.id,
              operator:   OP.INS,
            });
          }
        }
        // INS pushes claimId to front of stack (newest first)
        const idx = stack.claims.findIndex(c => c.id === op.claimId);
        if (idx > 0) {
          const [claim] = stack.claims.splice(idx, 1);
          stack.claims.unshift(claim);
        }
      }
      break;
    }

    case OP.ALT: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      // Mark all prior active (non-superseded) claims as superseded
      for (const claim of stack.claims) {
        if (claim._phase !== PHASES.SUPERSEDED) {
          claim._phase = PHASES.SUPERSEDED;
        }
      }
      // Push new claim
      if (op.claimId) {
        stack.claims.unshift({
          id:         op.claimId,
          value:      op.value ?? '',
          agent:      op.agent || event.agent,
          role:       op.role || event.agentRole || '',
          mode:       op.mode || 'declared',
          supersedes: op.supersedes || null,
          timestamp:  event.date,
          note:       op.note || null,
          eventId:    event.id,
          operator:   OP.ALT,
        });
      }
      // Remove from SUP/held if ALT resolves it
      stack.supFields.delete(field);
      stack.heldFields.delete(field);
      break;
    }

    case OP.SUP: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      if (op.heldNote) {
        // Held — intentional uncertainty
        stack.heldFields.add(field);
      } else if (op.contestNote || op.note) {
        // Contested — two claims from different agents
        stack.supFields.add(field);
      } else {
        // Default SUP behavior — superposition
        stack.supFields.add(field);
      }
      // If SUP carries a new claim, add it
      if (op.claimId && op.value !== undefined) {
        stack.claims.unshift({
          id:         op.claimId,
          value:      op.value,
          agent:      op.agent || event.agent,
          role:       op.role || event.agentRole || '',
          mode:       op.mode || 'declared',
          supersedes: op.supersedes || null,
          timestamp:  event.date,
          note:       op.note || op.heldNote || op.contestNote || null,
          eventId:    event.id,
          operator:   OP.SUP,
        });
      }
      break;
    }

    case OP.CON: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      // Record supersession link
      if (op.claimId && op.supersedes) {
        stack.conLinks.set(op.claimId, op.supersedes);
      }
      break;
    }

    case OP.SEG:
      // No direct state change — creates precondition for next op
      break;

    case OP.SYN: {
      if (!field) break;
      const stack = ensureStack(stacks, field);
      // Collapse SUP state — resolve to single value
      stack.supFields.delete(field);
      stack.heldFields.delete(field);
      if (op.claimId && op.value !== undefined) {
        // Mark all prior as superseded
        for (const claim of stack.claims) {
          claim._phase = PHASES.SUPERSEDED;
        }
        stack.claims.unshift({
          id:         op.claimId,
          value:      op.value,
          agent:      op.agent || event.agent,
          role:       op.role || event.agentRole || '',
          mode:       op.mode || 'aggregated',
          supersedes: op.supersedes || null,
          timestamp:  event.date,
          note:       op.note || null,
          eventId:    event.id,
          operator:   OP.SYN,
        });
      }
      break;
    }

    case OP.REC:
      // Case-level reframe — TBD
      break;

    default:
      break;
  }
}

// ── Phase resolution ────────────────────────────────────────────────
// Phases are computed, never stored.

function resolveStack(stack) {
  const { claims, supFields, heldFields, conLinks } = stack;
  const resolved = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = { ...claims[i] };
    delete claim._phase;

    if (claims[i]._phase === PHASES.SUPERSEDED) {
      claim.phase = PHASES.SUPERSEDED;
    } else if (heldFields.size > 0) {
      claim.phase = i === 0 ? PHASES.HELD : PHASES.SUPERSEDED;
    } else if (supFields.size > 0) {
      // In SUP state, top N non-superseded claims are contested
      if (claims[i]._phase !== PHASES.SUPERSEDED) {
        claim.phase = PHASES.CONTESTED;
      } else {
        claim.phase = PHASES.SUPERSEDED;
      }
    } else {
      claim.phase = i === 0 ? PHASES.SETTLED : PHASES.SUPERSEDED;
    }

    resolved.push(Object.freeze(claim));
  }

  return Object.freeze({
    claims: resolved,
    isHeld: heldFields.size > 0,
    isContested: supFields.size > 0,
    conLinks: Object.fromEntries(conLinks),
  });
}

// ── resolvePhase (public) ───────────────────────────────────────────
// Returns the phase for the top claim of a field stack.

export function resolvePhase(fieldStack) {
  if (!fieldStack || !fieldStack.claims || fieldStack.claims.length === 0) {
    return null;
  }
  return fieldStack.claims[0].phase;
}

// ── inferOperator ───────────────────────────────────────────────────
// Given current stack state and a new observation, returns the ops array
// that should be emitted. Worker never chooses operator — system infers it.

export function inferOperator(field, currentStack, newClaim, held = false) {
  const ops = [];
  const activeClaims = currentStack?.claims?.filter(c => c.phase !== PHASES.SUPERSEDED) || [];

  // No prior claims → DES then INS
  if (!currentStack || currentStack.claims.length === 0) {
    const claimId = makeClaimId(field);
    ops.push({
      op: OP.DES,
      field,
      claimId,
      value:  newClaim.value,
      agent:  newClaim.agent,
      role:   newClaim.role,
      mode:   newClaim.mode,
      note:   newClaim.note,
    });
    ops.push({
      op: OP.INS,
      field,
      claimId,
    });
    return ops;
  }

  const topClaim = activeClaims[0] || currentStack.claims[0];

  // Worker selected "hold open" → SEG then SUP with heldNote
  if (held) {
    const claimId = makeClaimId(field);
    ops.push({ op: OP.SEG, field, note: `Cut before hold on ${field}.` });
    ops.push({
      op: OP.SUP,
      field,
      claimId,
      value:    newClaim.value,
      agent:    newClaim.agent,
      role:     newClaim.role,
      mode:     newClaim.mode,
      heldNote: newClaim.note || 'Held open — intentional uncertainty.',
    });
    return ops;
  }

  const sameAgent = topClaim.agent === newClaim.agent;
  const newPriority = MODE_PRIORITY[newClaim.mode] || 0;
  const currentPriority = MODE_PRIORITY[topClaim.mode] || 0;

  // Same agent, mode ≥ current → SEG then ALT (clean supersession)
  if (sameAgent && newPriority >= currentPriority) {
    const claimId = makeClaimId(field);
    ops.push({ op: OP.SEG, field, note: `Cut between ${topClaim.mode} and ${newClaim.mode}.` });
    ops.push({
      op: OP.ALT,
      field,
      claimId,
      value:      newClaim.value,
      agent:      newClaim.agent,
      role:       newClaim.role,
      mode:       newClaim.mode,
      supersedes: topClaim.id,
      note:       newClaim.note,
    });
    ops.push({
      op: OP.CON,
      field,
      claimId,
      supersedes: topClaim.id,
      note: `Supersession link: ${claimId} → ${topClaim.id}.`,
    });
    return ops;
  }

  // Different agent OR same agent with mode < current → SEG then SUP
  const claimId = makeClaimId(field);
  const reason = !sameAgent
    ? 'Different agents — holding both claims.'
    : `Same agent, lower epistemic mode (${newClaim.mode} < ${topClaim.mode}) — holding both.`;

  ops.push({ op: OP.SEG, field, note: `Cut before superposition on ${field}.` });
  ops.push({
    op: OP.SUP,
    field,
    claimId,
    value:       newClaim.value,
    agent:       newClaim.agent,
    role:        newClaim.role,
    mode:        newClaim.mode,
    contestNote: reason,
    note:        newClaim.note,
  });

  return ops;
}

// ── buildClaimEvent ─────────────────────────────────────────────────
// Constructs a full io.khora.claim.event payload.

export function buildClaimEvent(agent, agentRole, ops, label = '') {
  return {
    id:        `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    date:      new Date().toISOString(),
    label:     label || `${ops.length} operation${ops.length !== 1 ? 's' : ''}`,
    agent,
    agentRole,
    ops,
  };
}

// ── getActiveClaims ─────────────────────────────────────────────────
// Returns non-superseded claims from a stack.

export function getActiveClaims(fieldStack) {
  if (!fieldStack || !fieldStack.claims) return [];
  return fieldStack.claims.filter(c => c.phase !== PHASES.SUPERSEDED);
}

// ── getSupersessionChain ────────────────────────────────────────────
// Returns ordered chain of claim IDs from newest to oldest via supersedes links.

export function getSupersessionChain(fieldStack, claimId) {
  if (!fieldStack) return [claimId];
  const chain = [claimId];
  const claimMap = new Map(fieldStack.claims.map(c => [c.id, c]));
  let current = claimMap.get(claimId);
  while (current?.supersedes) {
    chain.push(current.supersedes);
    current = claimMap.get(current.supersedes);
  }
  return chain;
}
