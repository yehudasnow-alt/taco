import { create } from 'zustand';

// Active route configuration — what the user is currently planning.
// Search params drive the algorithm; route options is what the algorithm returns.
export const useRouteStore = create((set, get) => ({
  // Endpoints + manual stops
  origin:       null,
  destination:  null,
  intermediates: [], // user-forced stops between origin & destination

  // Search inputs
  departureDate: null,
  returnDate:    null,
  tripType:      'oneway', // 'oneway' | 'roundtrip'
  maxStops:      1,        // 0 | 1 | 2 | 'any'

  // Algorithm output
  routeOptions:    [],
  selectedRouteId: null,

  // UI
  hoveredAirport: null,
  activeField:    'origin', // which input gets filled by a globe click: 'origin' | 'destination' | null

  setOrigin:        (a) => set((s) => ({ origin: a,      activeField: a && !s.destination ? 'destination' : null })),
  setDestination:   (a) => set(()   => ({ destination: a, activeField: null })),
  addIntermediate:  (a) => set((s)  => ({ intermediates: [...s.intermediates, a] })),
  removeIntermediate: (i) => set((s) => ({ intermediates: s.intermediates.filter((_, idx) => idx !== i) })),

  setDepartureDate: (d) => set({ departureDate: d }),
  setReturnDate:    (d) => set({ returnDate: d }),
  setTripType:      (t) => set({ tripType: t, returnDate: t === 'oneway' ? null : get().returnDate }),
  setMaxStops:      (n) => set({ maxStops: n }),

  setRouteOptions: (opts) => set({ routeOptions: opts }),
  selectRoute:     (id)   => set({ selectedRouteId: id }),

  setHoveredAirport: (a) => set({ hoveredAirport: a }),
  setActiveField:    (f) => set({ activeField: f }),

  // Smart click handler used by the globe.
  // Fills whichever input is "active"; if neither is, fills the first empty.
  // If both are filled, treats the click as adding an intermediate.
  pickAirport: (a) => {
    const { origin, destination, activeField } = get();
    if (activeField === 'origin') {
      set({ origin: a, activeField: destination ? null : 'destination' });
    } else if (activeField === 'destination') {
      set({ destination: a, activeField: null });
    } else if (!origin) {
      set({ origin: a, activeField: 'destination' });
    } else if (!destination) {
      set({ destination: a, activeField: null });
    } else {
      set((s) => ({ intermediates: [...s.intermediates, a] }));
    }
  },

  swapOriginDestination: () => set((s) => ({
    origin: s.destination, destination: s.origin,
  })),

  clearAll: () => set({
    origin: null, destination: null, intermediates: [],
    routeOptions: [], selectedRouteId: null,
    departureDate: null, returnDate: null,
    activeField: 'origin',
  }),
}));

// Derived: which IATAs should be visually highlighted as "selected" on the globe.
// Uses the currently-selected route's stops, or falls back to manual stops.
export function selectedStopIatas(state) {
  const sel = state.routeOptions.find(r => r.id === state.selectedRouteId);
  if (sel) return sel.stops.map(s => s.iata);
  const manual = [state.origin, ...state.intermediates, state.destination].filter(Boolean);
  return manual.map(s => s.iata);
}
