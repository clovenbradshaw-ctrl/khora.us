import { describe, it, expect } from 'vitest';
import { replayTo, inferOperator, resolvePhase, buildClaimEvent, getActiveClaims, getSupersessionChain } from './claims.js';
import { OP, PHASES } from './operators.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeEvent(ops, overrides = {}) {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    date: overrides.date || new Date().toISOString(),
    label: overrides.label || 'test event',
    agent: overrides.agent || '@worker:srv',
    agentRole: overrides.agentRole || 'Caseworker',
    ops,
  };
}

// ── replayTo ────────────────────────────────────────────────────────

describe('replayTo', () => {
  it('returns empty map for empty event stream', () => {
    const result = replayTo([]);
    expect(result.size).toBe(0);
  });

  it('DES + INS → settled claim', () => {
    const events = [makeEvent([
      { op: 'DES', field: 'housing', claimId: 'h1', value: 'Emergency Shelter', agent: '@jreyes:srv', role: 'Intake', mode: 'declared', note: 'Client self-reported.' },
      { op: 'INS', field: 'housing', claimId: 'h1' },
    ])];

    const result = replayTo(events);
    expect(result.has('housing')).toBe(true);

    const stack = result.get('housing');
    expect(stack.claims).toHaveLength(1);
    expect(stack.claims[0].value).toBe('Emergency Shelter');
    expect(stack.claims[0].phase).toBe('settled');
    expect(stack.claims[0].operator).toBe('DES');
    expect(stack.claims[0].mode).toBe('declared');
  });

  it('ALT → prior claim superseded, new claim settled', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'housing', claimId: 'h1', value: 'Emergency Shelter', mode: 'declared' },
        { op: 'INS', field: 'housing', claimId: 'h1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'SEG', field: 'housing', note: 'Cut between declared and inferred.' },
        { op: 'ALT', field: 'housing', claimId: 'h2', value: 'Transitionally Housed', mode: 'inferred', supersedes: 'h1' },
        { op: 'CON', field: 'housing', claimId: 'h2', supersedes: 'h1', note: 'h2 → h1' },
      ], { date: '2025-02-01T00:00:00Z' }),
    ];

    const result = replayTo(events);
    const stack = result.get('housing');

    expect(stack.claims).toHaveLength(2);
    expect(stack.claims[0].value).toBe('Transitionally Housed');
    expect(stack.claims[0].phase).toBe('settled');
    expect(stack.claims[0].operator).toBe('ALT');
    expect(stack.claims[1].phase).toBe('superseded');
  });

  it('SUP → contested state', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'safety', claimId: 's1', value: 'No concerns', agent: '@worker:srv', mode: 'observed' },
        { op: 'INS', field: 'safety', claimId: 's1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'SEG', field: 'safety', note: 'Cut before superposition.' },
        { op: 'SUP', field: 'safety', claimId: 's2', value: 'Possible concern', agent: '@supervisor:srv', mode: 'inferred', contestNote: 'Different agents, different modes.' },
      ], { date: '2025-02-01T00:00:00Z', agent: '@supervisor:srv' }),
    ];

    const result = replayTo(events);
    const stack = result.get('safety');

    expect(stack.isContested).toBe(true);
    const active = getActiveClaims(stack);
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active.some(c => c.phase === 'contested')).toBe(true);
  });

  it('SUP with heldNote → held state', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'income', claimId: 'i1', value: '$1200', mode: 'declared' },
        { op: 'INS', field: 'income', claimId: 'i1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'SEG', field: 'income', note: 'Cut before hold.' },
        { op: 'SUP', field: 'income', claimId: 'i2', value: '$1200', mode: 'declared', heldNote: 'Held open — waiting for verification.' },
      ], { date: '2025-02-01T00:00:00Z' }),
    ];

    const result = replayTo(events);
    const stack = result.get('income');

    expect(stack.isHeld).toBe(true);
    expect(stack.claims[0].phase).toBe('held');
  });

  it('respects targetDate — ignores events after target', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'housing', claimId: 'h1', value: 'Shelter', mode: 'declared' },
        { op: 'INS', field: 'housing', claimId: 'h1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'ALT', field: 'housing', claimId: 'h2', value: 'Housed', mode: 'measured', supersedes: 'h1' },
      ], { date: '2025-06-01T00:00:00Z' }),
    ];

    const result = replayTo(events, '2025-03-01T00:00:00Z');
    const stack = result.get('housing');

    expect(stack.claims).toHaveLength(1);
    expect(stack.claims[0].value).toBe('Shelter');
  });

  it('SYN collapses SUP state', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'safety', claimId: 's1', value: 'No concerns', mode: 'observed' },
        { op: 'INS', field: 'safety', claimId: 's1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'SUP', field: 'safety', claimId: 's2', value: 'Possible concern', mode: 'inferred', contestNote: 'Contested.' },
      ], { date: '2025-02-01T00:00:00Z' }),
      makeEvent([
        { op: 'SYN', field: 'safety', claimId: 's3', value: 'Minor concern noted', mode: 'aggregated', note: 'Collapsed after review.' },
      ], { date: '2025-03-01T00:00:00Z' }),
    ];

    const result = replayTo(events);
    const stack = result.get('safety');

    expect(stack.isContested).toBe(false);
    expect(stack.claims[0].value).toBe('Minor concern noted');
    expect(stack.claims[0].phase).toBe('settled');
    expect(stack.claims[0].operator).toBe('SYN');
  });

  it('CON records supersession links', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'housing', claimId: 'h1', value: 'Shelter', mode: 'declared' },
        { op: 'INS', field: 'housing', claimId: 'h1' },
      ], { date: '2025-01-01T00:00:00Z' }),
      makeEvent([
        { op: 'ALT', field: 'housing', claimId: 'h2', value: 'Housed', mode: 'measured', supersedes: 'h1' },
        { op: 'CON', field: 'housing', claimId: 'h2', supersedes: 'h1' },
      ], { date: '2025-02-01T00:00:00Z' }),
    ];

    const result = replayTo(events);
    const stack = result.get('housing');
    expect(stack.conLinks).toEqual({ h2: 'h1' });
  });

  it('handles multiple fields independently', () => {
    const events = [
      makeEvent([
        { op: 'DES', field: 'housing', claimId: 'h1', value: 'Shelter', mode: 'declared' },
        { op: 'INS', field: 'housing', claimId: 'h1' },
        { op: 'DES', field: 'income', claimId: 'i1', value: '$500', mode: 'declared' },
        { op: 'INS', field: 'income', claimId: 'i1' },
      ]),
    ];

    const result = replayTo(events);
    expect(result.size).toBe(2);
    expect(result.get('housing').claims[0].value).toBe('Shelter');
    expect(result.get('income').claims[0].value).toBe('$500');
  });
});

// ── inferOperator ───────────────────────────────────────────────────

describe('inferOperator', () => {
  it('returns DES + INS for empty stack', () => {
    const ops = inferOperator('housing', null, {
      value: 'Shelter', agent: '@worker:srv', role: 'Intake', mode: 'declared',
    });

    expect(ops).toHaveLength(2);
    expect(ops[0].op).toBe('DES');
    expect(ops[1].op).toBe('INS');
    expect(ops[0].value).toBe('Shelter');
  });

  it('returns SEG + ALT for same agent with higher mode', () => {
    const currentStack = {
      claims: [{ id: 'h1', agent: '@worker:srv', mode: 'declared', phase: 'settled' }],
    };

    const ops = inferOperator('housing', currentStack, {
      value: 'Housed', agent: '@worker:srv', role: 'Caseworker', mode: 'measured',
    });

    expect(ops[0].op).toBe('SEG');
    expect(ops[1].op).toBe('ALT');
    expect(ops[1].supersedes).toBe('h1');
  });

  it('returns SEG + SUP for different agent', () => {
    const currentStack = {
      claims: [{ id: 'h1', agent: '@worker:srv', mode: 'observed', phase: 'settled' }],
    };

    const ops = inferOperator('housing', currentStack, {
      value: 'Concern', agent: '@supervisor:srv', role: 'Supervisor', mode: 'inferred',
    });

    expect(ops[0].op).toBe('SEG');
    expect(ops[1].op).toBe('SUP');
    expect(ops[1].contestNote).toContain('Different agents');
  });

  it('returns SEG + SUP for same agent with lower mode', () => {
    const currentStack = {
      claims: [{ id: 'h1', agent: '@worker:srv', mode: 'measured', phase: 'settled' }],
    };

    const ops = inferOperator('housing', currentStack, {
      value: 'Maybe', agent: '@worker:srv', role: 'Caseworker', mode: 'inferred',
    });

    expect(ops[0].op).toBe('SEG');
    expect(ops[1].op).toBe('SUP');
  });

  it('returns SEG + SUP with heldNote when held=true', () => {
    const currentStack = {
      claims: [{ id: 'h1', agent: '@worker:srv', mode: 'declared', phase: 'settled' }],
    };

    const ops = inferOperator('housing', currentStack, {
      value: 'Unknown', agent: '@worker:srv', role: 'Caseworker', mode: 'declared', note: 'Checking next week.',
    }, true);

    expect(ops[0].op).toBe('SEG');
    expect(ops[1].op).toBe('SUP');
    expect(ops[1].heldNote).toBeTruthy();
  });
});

// ── resolvePhase ────────────────────────────────────────────────────

describe('resolvePhase', () => {
  it('returns null for empty stack', () => {
    expect(resolvePhase(null)).toBeNull();
    expect(resolvePhase({ claims: [] })).toBeNull();
  });

  it('returns settled for simple stack', () => {
    const events = [makeEvent([
      { op: 'DES', field: 'housing', claimId: 'h1', value: 'Shelter', mode: 'declared' },
      { op: 'INS', field: 'housing', claimId: 'h1' },
    ])];
    const result = replayTo(events);
    expect(resolvePhase(result.get('housing'))).toBe('settled');
  });
});

// ── buildClaimEvent ─────────────────────────────────────────────────

describe('buildClaimEvent', () => {
  it('constructs valid event payload', () => {
    const ops = [{ op: 'DES', field: 'housing', claimId: 'h1', value: 'Shelter' }];
    const event = buildClaimEvent('@worker:srv', 'Intake', ops, 'Housing designation');

    expect(event.id).toBeTruthy();
    expect(event.date).toBeTruthy();
    expect(event.agent).toBe('@worker:srv');
    expect(event.agentRole).toBe('Intake');
    expect(event.ops).toBe(ops);
    expect(event.label).toBe('Housing designation');
  });
});

// ── getSupersessionChain ────────────────────────────────────────────

describe('getSupersessionChain', () => {
  it('returns chain from newest to oldest', () => {
    const stack = {
      claims: [
        { id: 'h3', supersedes: 'h2' },
        { id: 'h2', supersedes: 'h1' },
        { id: 'h1', supersedes: null },
      ],
    };

    const chain = getSupersessionChain(stack, 'h3');
    expect(chain).toEqual(['h3', 'h2', 'h1']);
  });
});
