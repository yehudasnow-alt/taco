import { useState, useRef, useEffect } from 'react';
import { searchAirports } from '../hooks/useAirports';
import { useRouteStore } from '../store/routeStore';
import styles from './AirportSearch.module.css';

export default function AirportSearch({ placeholder = 'Search airports...', onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setResults(val.length >= 2 ? searchAirports(val) : []);
  };

  const handleSelect = (airport) => {
    onSelect(airport);
    setQuery('');
    setResults([]);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#4a9eff', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {query && (
          <button className={styles.clear} onClick={() => { setQuery(''); setResults([]); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map(airport => (
            <button
              key={airport.iata}
              className={styles.result}
              onMouseDown={() => handleSelect(airport)}
            >
              <span className={styles.iata}>{airport.iata}</span>
              <div className={styles.info}>
                <span className={styles.name}>{airport.name}</span>
                <span className={styles.location}>{airport.city}, {airport.country}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
