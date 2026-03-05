import Icon from './common/Icon.jsx';
import { getField } from '../schema/fields.js';

/**
 * AttentionStrip — surfaces held/contested items and upcoming follow-ups.
 *
 * Leads the provider view. Plain language. One sentence per item.
 *
 * @param {object[]} items - attention items from useAttention hook
 * @param {function} onUpdate - callback to open observation panel for a field
 */
export default function AttentionStrip({ items = [], onUpdate }) {
  if (!items.length) return null;

  return (
    <div className="attention-strip">
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
        Attention
      </div>
      {items.map((item, i) => (
        <AttentionItem key={item.fieldKey + '-' + i} item={item} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function AttentionItem({ item, onUpdate }) {
  const { fieldKey, type, message, dueDate } = item;
  const field = getField(fieldKey);
  const label = field?.label || fieldKey;

  const dotColor = {
    contested: 'var(--red)',
    held:      'var(--orange)',
    due:       'var(--blue)',
  }[type] || 'var(--tx-3)';

  const iconName = {
    contested: 'alert-circle',
    held:      'alert-triangle',
    due:       'calendar',
  }[type] || 'info';

  const defaultMessage = {
    contested: `${label} — two conflicting records. Both kept.`,
    held:      `${label} — unresolved.${dueDate ? ` Follow up by ${formatDate(dueDate)}.` : ''}`,
    due:       `${label} — follow up due${dueDate ? ` ${daysUntil(dueDate)}` : ''}.`,
  }[type];

  return (
    <div className="attention-item">
      <div className="dot" style={{ background: dotColor }} />
      <Icon name={iconName} size={14} color={dotColor} />
      <span className="message">{message || defaultMessage}</span>
      {onUpdate && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onUpdate(fieldKey)}
        >
          Update
        </button>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const target = new Date(dateStr);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return `in ${diff} days`;
}
