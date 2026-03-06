import { useState, useMemo } from 'react';
import Icon from './common/Icon.jsx';
import { OperatorBadge } from './common/Badge.jsx';
import { MODE_PROMPTS, OP_META } from '../engine/operators.js';
import { inferOperator } from '../engine/claims.js';
import { getField } from '../schema/fields.js';

/**
 * ObservationPanel — modal form for recording a new observation.
 *
 * Shows current claim as context.
 * Worker enters value, selects mode (plain language), optional note.
 * "Hold open" toggle for intentional uncertainty.
 * System infers operator — worker never chooses it directly.
 *
 * Transparency footer: shows what operator will fire before save.
 *
 * @param {string} fieldKey
 * @param {object} currentStack - current claim stack for context
 * @param {string} agent - current user's Matrix ID
 * @param {string} agentRole - current user's role
 * @param {boolean} transparencyMode
 * @param {function} onSave - (fieldKey, newClaim, ops) => void
 * @param {function} onClose
 */
export default function ObservationPanel({
  fieldKey,
  currentStack,
  agent,
  agentRole = '',
  transparencyMode = false,
  onSave,
  onClose,
}) {
  const fieldDef = getField(fieldKey);
  const topClaim = currentStack?.claims?.find(c => c.phase !== 'superseded');

  const [value, setValue] = useState(topClaim?.value ?? '');
  const [mode, setMode] = useState(topClaim?.mode ?? null);
  const [note, setNote] = useState('');
  const [held, setHeld] = useState(false);

  // Infer what operator will fire
  const previewOps = useMemo(() => {
    if (!mode || !value) return null;
    return inferOperator(fieldKey, currentStack, {
      value, agent, role: agentRole, mode, note: note || null,
    }, held);
  }, [fieldKey, currentStack, value, agent, agentRole, mode, note, held]);

  const handleSave = () => {
    if (!mode || !value) return;
    const newClaim = { value, agent, role: agentRole, mode, note: note || null };
    const ops = inferOperator(fieldKey, currentStack, newClaim, held);
    onSave?.(fieldKey, newClaim, ops);
    onClose?.();
  };

  const renderInput = () => {
    const type = fieldDef?.type || 'text';

    if (type === 'select' && fieldDef?.options) {
      return (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="">Select...</option>
          {fieldDef.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (type === 'text_long') {
      return (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'vertical' }}
          placeholder="Describe the current situation..."
        />
      );
    }

    if (type === 'boolean') {
      return (
        <select value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%' }}>
          <option value="">Select...</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }

    return (
      <input
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ width: '100%' }}
        placeholder="Enter value..."
      />
    );
  };

  return (
    <div className="obs-panel">
      {/* Context — current claim */}
      {topClaim && (
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-3)',
          borderRadius: 'var(--r-sm)',
          marginBottom: 16,
          fontSize: 12,
        }}>
          <div style={{ color: 'var(--tx-3)', marginBottom: 4 }}>Current record:</div>
          <div style={{ color: 'var(--tx-1)', fontWeight: 500 }}>{topClaim.value}</div>
          <div style={{ color: 'var(--tx-3)', fontSize: 10.5, marginTop: 2 }}>
            {formatAgent(topClaim.agent)} · {topClaim.mode}
          </div>
        </div>
      )}

      {/* Value input */}
      <div className="field-group">
        <label>What&apos;s the current situation?</label>
        {renderInput()}
      </div>

      {/* Mode selector */}
      <div className="field-group">
        <label>How do you know this?</label>
        <div className="mode-options">
          {Object.entries(MODE_PROMPTS).map(([modeKey, prompt]) => (
            <button
              type="button"
              key={modeKey}
              className={`mode-option ${mode === modeKey ? 'selected' : ''}`}
              onClick={() => setMode(modeKey)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="field-group">
        <label>Notes or caveats (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'vertical' }}
          placeholder="Anything that couldn't be verified, context, caveats..."
        />
      </div>

      {/* Hold open toggle */}
      <div className="field-group">
        <label
          className="hold-toggle"
          onClick={() => setHeld(!held)}
        >
          <input type="checkbox" checked={held} onChange={() => setHeld(!held)} />
          <div>
            <div className="label">Hold open</div>
            <div className="desc">
              Records this as uncertain. Won&apos;t override other accounts. You&apos;ll be reminded to follow up.
            </div>
          </div>
        </label>
      </div>

      {/* Transparency footer — operator preview */}
      {transparencyMode && previewOps && (
        <div className="op-preview" style={{ marginBottom: 12 }}>
          <Icon name="code" size={12} color="var(--tx-3)" />
          <span>This will fire:</span>
          {previewOps.map((op, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {i > 0 && <span className="op-arrow">→</span>}
              <OperatorBadge operator={op.op} showDesc />
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!value || !mode}
          style={{ opacity: (!value || !mode) ? 0.5 : 1 }}
        >
          Save Observation
        </button>
      </div>
    </div>
  );
}

function formatAgent(agent) {
  if (!agent) return 'Unknown';
  if (agent.startsWith('@')) return agent.split(':')[0].slice(1);
  return agent;
}
