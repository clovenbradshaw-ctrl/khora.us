import { useState, useEffect, useCallback } from 'react';
import Icon from './common/Icon.jsx';

/**
 * ThemeToggle — light/dark theme switcher.
 * Persists to localStorage. Respects system preference on first visit.
 */
export default function ThemeToggle({ compact = false }) {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('khora:theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
    localStorage.setItem('khora:theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = useCallback(() => {
    document.documentElement.classList.add('theme-transition');
    setDark(d => !d);
    // Remove transition class after animation completes to avoid interfering with other transitions
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 350);
  }, []);

  if (compact) {
    return (
      <button className="btn-icon" onClick={toggle} title={dark ? 'Light mode' : 'Dark mode'}>
        <Icon name={dark ? 'sun' : 'moon'} size={16} color="var(--tx-2)" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        fontSize: 12,
        color: 'var(--tx-2)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={14} color="var(--tx-2)" />
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
