import { useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import { fmtDuration } from '../utils/routeFinder';
import AirportPicker from './AirportPicker';
import styles from './SearchPanel.module.css';

const STOP_CHOICES = [
  { value: 0,     label: 'Direct' },
  { value: 1,     label: '1 stop' },
  { value: 2,     label: '2 stops' },
  { value: 'any', label: 'Any' },
];

function RouteOptionRow({ route, isSelected, onClick }) {
  const stopsText = route.stopCount === 0
    ? 'Non-stop'
    : `${route.stopCount} stop${route.stopCount > 1 ? 's' : ''}`;
  return (
    <button
      type="button"
      className={`${styles.routeRow} ${isSelected ? styles.routeRowSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.routeDot} style={{ background: route.color }} />
      <div className={styles.routeBody}>
        <div className={styles.routeHead}>
          <span className={styles.routeLabel}>{route.label}</span>
          <span className={styles.routePrice}>${route.price}</span>
        </div>
        <div className={styles.routeMeta}>
          <span>{stopsText}</span>
          <span className={styles.routeMetaDot}>·</span>
          <span>{fmtDuration(route.durationHours)}</span>
          <span className={styles.routeMetaDot}>·</span>
          <span>{Math.round(route.distanceKm).toLocaleString()} km</span>
        </div>
      </div>
    </button>
  );
}

function ManualStopRow({ stop, onRemove }) {
  return (
    <div className={styles.manualStopRow}>
      <div className={styles.manualStopDot} />
      <div className={styles.manualStopBody}>
        <span className={styles.manualStopIata}>{stop.iata}</span>
        <span className={styles.manualStopMeta}>{stop.city || stop.name}</span>
      </div>
      <button
        type="button"
        className={styles.manualStopRemove}
        onClick={onRemove}
        aria-label={`Remove ${stop.iata}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function SearchPanel() {
  const {
    origin, destination, intermediates,
    departureDate, returnDate, tripType, maxStops,
    routeOptions, selectedRouteId,
    setOrigin, setDestination, removeIntermediate,
    setDepartureDate, setReturnDate, setTripType, setMaxStops,
    selectRoute, swapOriginDestination, clearAll,
  } = useRouteStore();

  const [searching, setSearching] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const hasRoute = !!(origin || destination);

  const handleSearchFlights = () => {
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      const sel = routeOptions.find(r => r.id === selectedRouteId) || routeOptions[0];
      const routeStr = sel
        ? sel.stops.map(s => s.iata).join(' → ') + `  ($${sel.price})`
        : [origin, ...intermediates, destination].filter(Boolean).map(s => s.iata).join(' → ');
      // eslint-disable-next-line no-alert
      alert(
        'Flight search is coming soon!\n\n' +
        'Route: ' + routeStr + '\n' +
        'Date: '  + (departureDate || 'not set') + (returnDate ? ' / ' + returnDate : '') + '\n' +
        'Type: '  + tripType + '\n\n' +
        'This will connect to the Duffel API to find real flights across airlines.'
      );
    }, 600);
  };

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" strokeWidth="2">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2l-1.4 1.4L9 10 6 13H2l-1 2 3.5.5.5 3.5 2-1v-4l3-3 3.6 5.6z" />
          </svg>
          <span className={styles.logoText}>Taco</span>
        </div>
        {hasRoute && (
          <button className={styles.clearBtn} onClick={clearAll}>Reset</button>
        )}
      </header>

      <div className={styles.scrollArea}>
        {/* From / To picker pair with swap */}
        <div className={styles.endpoints}>
          <AirportPicker
            value={origin}
            onChange={setOrigin}
            fieldKey="origin"
            label="From"
            placeholder="Where from?"
            icon="🛫"
          />
          <button
            type="button"
            className={styles.swapBtn}
            onClick={swapOriginDestination}
            disabled={!origin && !destination}
            aria-label="Swap"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 10h12M7 10l3-3M7 10l3 3M17 14H5M17 14l-3-3M17 14l-3 3" />
            </svg>
          </button>
          <AirportPicker
            value={destination}
            onChange={setDestination}
            fieldKey="destination"
            label="To"
            placeholder="Where to?"
            icon="🛬"
          />
        </div>

        {/* Trip type toggle */}
        <div className={styles.tripTypeRow}>
          <button
            type="button"
            className={`${styles.tripBtn} ${tripType === 'oneway' ? styles.tripBtnActive : ''}`}
            onClick={() => setTripType('oneway')}
          >One way</button>
          <button
            type="button"
            className={`${styles.tripBtn} ${tripType === 'roundtrip' ? styles.tripBtnActive : ''}`}
            onClick={() => setTripType('roundtrip')}
          >Round trip</button>
        </div>

        {/* Dates */}
        <div className={styles.dateRow}>
          <div className={styles.dateField}>
            <label>Departure</label>
            <input
              type="date"
              value={departureDate || ''}
              min={today}
              onChange={(e) => setDepartureDate(e.target.value)}
            />
          </div>
          {tripType === 'roundtrip' && (
            <div className={styles.dateField}>
              <label>Return</label>
              <input
                type="date"
                value={returnDate || ''}
                min={departureDate || today}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Stops selector */}
        <div className={styles.stopsRow}>
          <label className={styles.stopsLabel}>Stops</label>
          <div className={styles.stopsChips}>
            {STOP_CHOICES.map(c => (
              <button
                key={String(c.value)}
                type="button"
                className={`${styles.chip} ${maxStops === c.value ? styles.chipActive : ''}`}
                onClick={() => setMaxStops(c.value)}
              >{c.label}</button>
            ))}
          </div>
        </div>

        {/* Manual intermediate stops (if any) */}
        {intermediates.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Forced stops</div>
            {intermediates.map((s, i) => (
              <ManualStopRow
                key={`${s.iata}-${i}`}
                stop={s}
                onRemove={() => removeIntermediate(i)}
              />
            ))}
            <div className={styles.manualHint}>
              The algorithm is paused — clear forced stops to see automatic routes.
            </div>
          </div>
        )}

        {/* Route options (algorithmic) */}
        {intermediates.length === 0 && routeOptions.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {routeOptions.length} route{routeOptions.length > 1 ? 's' : ''}
            </div>
            <div className={styles.routeList}>
              {routeOptions.map(r => (
                <RouteOptionRow
                  key={r.id}
                  route={r}
                  isSelected={r.id === selectedRouteId}
                  onClick={() => selectRoute(r.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!origin && !destination && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Plan a trip</div>
            <div className={styles.emptyText}>
              Pick an airport from the search box or click anywhere on the globe.
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      {origin && destination && (
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
        </div>
      )}
    </aside>
  );
}
