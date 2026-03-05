/**
 * EO (Epistemic Operators) — the nine-operator vocabulary.
 *
 * Three triads:
 *   Identity  (NUL · DES · INS)  — What exists?
 *   Structure (SEG · CON · SYN)  — How do things relate?
 *   Time      (ALT · SUP · REC)  — How do things change?
 *
 * Every claim in the system carries the operator that produced it.
 * This module is the canonical reference for operators, modes, and phases.
 */

// ── Operator names ──────────────────────────────────────────────────

export const OP = Object.freeze({
  NUL: 'NUL',
  DES: 'DES',
  INS: 'INS',
  SEG: 'SEG',
  CON: 'CON',
  SYN: 'SYN',
  ALT: 'ALT',
  SUP: 'SUP',
  REC: 'REC',
});

// ── Operator metadata (Greek letter, verb, description, color) ──────

export const OP_META = Object.freeze({
  NUL: { greek: 'ν', verb: 'Nullify',     desc: 'Brings the record out of void. Precondition for all subsequent operators.', color: 'red' },
  DES: { greek: 'θ', verb: 'Designate',   desc: 'First designation of a field. Draws the distinction that makes the field exist.', color: 'teal' },
  INS: { greek: 'α', verb: 'Instantiate',  desc: 'Inserts a claim into the stack.', color: 'green' },
  SEG: { greek: 'κ', verb: 'Segment',     desc: 'Draws a cut between claim types before a consequential move.', color: 'orange' },
  CON: { greek: 'ε', verb: 'Connect',     desc: 'Establishes supersession and provenance links.', color: 'blue' },
  SYN: { greek: 'η', verb: 'Synthesize',  desc: 'Collapses a SUP state to a single value. Requires explicit resolution strategy.', color: 'purple' },
  ALT: { greek: 'δ', verb: 'Alternate',   desc: 'Clean frame switch. One claim legitimately supersedes another.', color: 'gold' },
  SUP: { greek: 'ψ', verb: 'Superpose',   desc: 'Holds coexisting incompatible claims. Fires when ALT is not warranted.', color: 'pink' },
  REC: { greek: 'Ω', verb: 'Reconfigure', desc: 'Reframes the ground structure of the case itself.', color: 'teal' },
});

// ── Triads ──────────────────────────────────────────────────────────

export const OPERATOR_TRIADS = Object.freeze({
  identity:  { label: 'Identity',  desc: 'What exists?',           ops: [OP.NUL, OP.DES, OP.INS], color: 'teal' },
  structure: { label: 'Structure', desc: 'How do things relate?',  ops: [OP.SEG, OP.CON, OP.SYN], color: 'blue' },
  time:      { label: 'Time',     desc: 'How do things change?',  ops: [OP.ALT, OP.SUP, OP.REC], color: 'purple' },
});

export function getTriad(opName) {
  for (const [, triad] of Object.entries(OPERATOR_TRIADS)) {
    if (triad.ops.includes(opName)) return triad;
  }
  return null;
}

// ── Epistemic Modes ─────────────────────────────────────────────────
// Distance between agent and fact. Resolution priority: measured > observed > declared > inferred > aggregated

export const MODES = Object.freeze(['measured', 'observed', 'declared', 'inferred', 'aggregated']);

export const MODE_PRIORITY = Object.freeze({
  measured:   5,
  observed:   4,
  declared:   3,
  inferred:   2,
  aggregated: 1,
});

export const MODE_LABELS = Object.freeze({
  measured:   'Verified',
  observed:   'Seen',
  declared:   'Self-reported',
  inferred:   'Inferred',
  aggregated: 'Aggregated',
});

// Plain-language prompts for observation panel
export const MODE_PROMPTS = Object.freeze({
  observed:  'I saw / heard it',
  declared:  'Client told me',
  measured:  'Document / system',
  inferred:  "I'm inferring",
});

// ── Claim Phases ────────────────────────────────────────────────────

export const PHASES = Object.freeze({
  SETTLED:    'settled',
  HELD:       'held',
  CONTESTED:  'contested',
  SUPERSEDED: 'superseded',
});

export const PHASE_COLORS = Object.freeze({
  settled:    'green',
  held:       'orange',
  contested:  'red',
  superseded: 'tx-3',
});

// ── Event type namespace ────────────────────────────────────────────

export const EVT = Object.freeze({
  CLAIM_EVENT:  'io.khora.claim.event',
  CLAIM_STACK:  'io.khora.claim.stack',
  CLAIM_ACCESS: 'io.khora.claim.access',
  IDENTITY:     'io.khora.identity',
  BRIDGE_META:  'io.khora.bridge.meta',
  BRIDGE_REFS:  'io.khora.bridge.refs',
});
