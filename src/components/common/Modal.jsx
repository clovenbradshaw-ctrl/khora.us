import { useEffect, useCallback } from 'react';
import Icon from './Icon.jsx';

/**
 * Modal / bottom-sheet wrapper.
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {boolean} fullscreen
 */
export default function Modal({ open, onClose, title, fullscreen = false, children }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <div className={`modal-content ${fullscreen ? 'modal-fullscreen' : ''}`}>
        {title && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-0)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-0)', flex: 1 }}>
              {title}
            </span>
            <button className="btn-icon" onClick={onClose}>
              <Icon name="x" size={16} color="var(--tx-2)" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
