import { useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import AirportSearch from './AirportSearch';
import styles from './RouteSidebar.module.css';

function StopCard({ stop, index, total, onRemove }) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;

  return (
    <div className={styles.stopCard}>
      <div className={styles.stopLine}>
        <div className={styles.stopDot} data-type={isFirst ? 'origin' : isLast ? 'dest' : 'mid'} />
        {index < total - 1 && <div className={styles.stopConnector} />}
      </div>
      <div className={styles.stopBody}>
        <div className={styles.stopHeader}>
          <span className={styles.stopIata}>{stop.iata}</span>
          <span className={styles.stopLabel}>
            {isFirst ? 'Origin' : isLast ? 'Destination' : `Stop ${index}`}
          </span>
          <button
            className={styles.removeBtn}
            onClick={() => onRemove(index)}
            aria-label={`Remove ${stop.iata}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.stopName}>{stop.name}</div>
        <div className={styles.stopCity}>{stop.city}, {stop.country}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
      <p className={styles.emptyTitle}>Build your route</p>
      <p className={styles.emptyText}>Search airports below or click dots on the globe to add stops</p>
    </div>
  );
}

export default function RouteSidebar() {
  const { stops, addStop, removeStop, clearRoute } = useRouteStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searching, setSearching] = useState(false);

  const totalDuration = stops.length > 1
    ? `${stops.length - 1} flight${stops.length > 2 ? 's' : ''}`
    : null;

  // Placeholder until Duffel integration lands. At minimum: give the user
  // feedback so the button doesn't feel broken.
  const handleSearchFlights = () => {
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      // eslint-disable-next-line no-alert
      alert(
        'Flight search is coming soon!\n\n' +
        'Route: ' + stops.map(s => s.iata).join(' → ') + '\n\n' +
        'This will connect to the Duffel API to find real flights across airlines.'
      );
    }, 600);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2l-1.4 1.4L9 10 6 13H2l-1 2 3.5.5.5 3.5 2-1v-4l3-3 3.6 5.6z" />
          </svg>
          <span className={styles.logoText}>Taco</span>
        </div>
        {stops.length > 0 && (
          <button className={styles.clearBtn} onClick={clearRoute}>Clear</button>
        )}
      </div>

      <div className={styles.routeInfo}>
        {stops.length > 1 && (
          <div className={styles.routeSummary}>
            <span className={styles.routeEndpoints}>
              {stops[0].iata} → {stops[stops.length - 1].iata}
            </span>
            <span className={styles.routeMeta}>{totalDuration}</span>
          </div>
        )}
      </div>

      <div className={styles.stops}>
        {stops.length === 0 && <EmptyState />}
        {stops.map((stop, i) => (
          <StopCard
            key={`${stop.iata}-${i}`}
            stop={stop}
            index={i}
            total={stops.length}
            onRemove={removeStop}
          />
        ))}
      </div>

      {/* Add stop */}
      <div className={styles.addSection}>
        {showSearch ? (
          <div className={styles.searchBox}>
            <AirportSearch
              placeholder="Search airport..."
              onSelect={(a) => { addStop(a); setShowSearch(false); }}
            />
            <button className={styles.cancelSearch} onClick={() => setShowSearch(false)}>Cancel</button>
          </div>
        ) : (
          <button
            className={styles.addBtn}
            onClick={() => setShowSearch(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {stops.length === 0 ? 'Add first stop' : 'Add stop'}
          </button>
        )}
      </div>

      {/* Search flights CTA */}
      {stops.length >= 2 && (
        <div className={styles.cta}>
          <button
            className={styles.searchBtn}
            onClick={handleSearchFlights}
            disabled={searching}
          >
            {searching ? (
              <>
                <span className={styles.spinner} />
                Searching…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                Search flights
              </>
            )}
          </button>
          <p className={styles.ctaHint}>
            We'll find the best combination across all airlines
          </p>
        </div>
      )}
    </aside>
  );
}
