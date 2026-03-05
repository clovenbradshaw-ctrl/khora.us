import { useState, useMemo } from 'react';
import Icon from './common/Icon.jsx';
import FieldCard from './FieldCard.jsx';
import { SECTIONS } from '../schema/fields.js';

/**
 * Search — searches field labels and claim values.
 * Returns matching FieldCard components with Update action.
 *
 * @param {Map} stacks - fieldKey → stack
 * @param {boolean} transparencyMode
 * @param {function} onObserve
 */
export default function Search({ stacks, transparencyMode = false, onObserve }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim() || !stacks) return [];

    const q = query.toLowerCase();
    const matches = [];

    for (const section of SECTIONS) {
      for (const field of section.fields) {
        const stack = stacks.get(field.key);
        const labelMatch = field.label.toLowerCase().includes(q);
        const valueMatch = stack?.claims?.some(c =>
          c.value?.toLowerCase().includes(q)
        );

        if (labelMatch || valueMatch) {
          matches.push({ fieldKey: field.key, stack: stack || { claims: [], conLinks: {} } });
        }
      }
    }

    return matches;
  }, [query, stacks]);

  return (
    <div>
      <div className="search-bar" style={{ marginBottom: 12 }}>
        <Icon name="search" size={14} color="var(--tx-3)" className="search-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fields and values..."
          style={{ width: '100%', paddingLeft: 36 }}
        />
      </div>

      {query.trim() && (
        <div className="stack">
          {results.length > 0 ? (
            results.map(({ fieldKey, stack }) => (
              <FieldCard
                key={fieldKey}
                fieldKey={fieldKey}
                stack={stack}
                transparencyMode={transparencyMode}
                onObserve={onObserve}
              />
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--tx-3)', textAlign: 'center', padding: 20 }}>
              No results for &quot;{query}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
