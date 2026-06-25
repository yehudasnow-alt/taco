import { useState, useRef, useEffect } from 'react';
import { searchAirports } from '../hooks/useAirports';
import { useRouteStore } from '../store/routeStore';
import styles from './SearchPanel.module.css';

// Single-field airport picker. The store's `activeField` decides which input
// the globe should fill — focusing here marks this picker as active.
export default function AirportPicker({
  value, onChange, fieldKey, placeholder, label, icon,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const setActiveField = useRouteStore(s => s.setActiveField);
  const activeField    = useRouteStore(s => s.activeField);
  const isActive = activeField === fieldKey;

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setResults(searchAirports(query));
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (a) => {
    onChange(a);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={styles.pickerWrap}>
      <label className={styles.pickerLabel}>{label}</label>
      <div
        className={`${styles.pickerField} ${isActive ? styles.pickerFieldActive : ''}`}
        onClick={() => setActiveField(fieldKey)}
      >
        <span className={styles.pickerIcon}>{icon}</span>
        {value ? (
          <div className={styles.pickerValue}>
            <span className={styles.pickerIata}>{value.iata}</span>
            <span className={styles.pickerCity}>{value.city || value.name}</span>
            <button
              type="button"
              className={styles.pickerClear}
              onClick={(e) => { e.stopPropagation(); onChange(null); setActiveField(fieldKey); }}
              aria-label="Clear"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <input
            type="text"
            className={styles.pickerInput}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { setActiveField(fieldKey); setOpen(true); }}
          />
        )}
      </div>
      {open && results.length > 0 && !value && (
        <div className={styles.pickerDropdown}>
          {results.map(a => (
            <button
              key={a.iata}
              type="button"
              className={styles.pickerOption}
              onClick={() => pick(a)}
            >
              <span className={styles.optIata}>{a.iata}</span>
              <span className={styles.optName}>{a.name}</span>
              <span className={styles.optMeta}>{a.city}, {a.country}</span>
            </button>
          ))}
        </div>
      )}
      {isActive && !value && (
        <div className={styles.pickerHint}>or click on the globe →</div>
      )}
    </div>
  );
}
