import { OP_META, PHASE_COLORS, MODE_LABELS, getTriad } from '../../engine/operators.js';

/**
 * Phase badge — settled / held / contested / superseded.
 */
export function PhaseBadge({ phase }) {
  if (!phase) return null;
  const color = PHASE_COLORS[phase] || 'gray';
  return <span className={`tag tag-${color}`}>{phase}</span>;
}

/**
 * Mode badge — plain language labels.
 */
export function ModeBadge({ mode }) {
  if (!mode) return null;
  const colorMap = {
    measured: 'teal',
    observed: 'blue',
    declared: 'gold',
    inferred: 'purple',
    aggregated: 'pink',
  };
  const label = MODE_LABELS[mode] || mode;
  const color = colorMap[mode] || 'gray';
  return <span className={`tag tag-${color}`}>{label}</span>;
}

/**
 * Operator badge — shows operator code + Greek letter with triad color.
 * Only visible in transparency/audit mode.
 */
export function OperatorBadge({ operator, showGreek = true, showDesc = false }) {
  if (!operator) return null;
  const meta = OP_META[operator];
  if (!meta) return <span className="tag tag-gray">{operator}</span>;

  const triad = getTriad(operator);
  const color = meta.color || triad?.color || 'gray';

  return (
    <span className={`audit-op-tag tag tag-${color}`} title={meta.desc}>
      {operator}
      {showGreek && <span style={{ opacity: 0.7, marginLeft: 2 }}>{meta.greek}</span>}
      {showDesc && <span style={{ fontWeight: 400, marginLeft: 4, fontFamily: 'var(--font)' }}>{meta.verb}</span>}
    </span>
  );
}

/**
 * Layer badge — given / framework / meant.
 */
export function LayerBadge({ layer }) {
  if (!layer) return null;
  const colors = { given: 'teal', framework: 'blue', meant: 'gold' };
  return <span className={`tag tag-${colors[layer] || 'gray'}`}>{layer}</span>;
}
