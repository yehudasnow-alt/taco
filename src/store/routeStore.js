import { create } from 'zustand';

export const useRouteStore = create((set, get) => ({
  // Selected route stops: array of airport objects
  stops: [],
  // Hovered airport on globe
  hoveredAirport: null,
  // Active search panel
  activeSearch: null, // 'add' | null
  // UI state
  sidebarOpen: true,

  addStop: (airport) => {
    const { stops } = get();
    // Prevent duplicates consecutively
    if (stops.length > 0 && stops[stops.length - 1].iata === airport.iata) return;
    set({ stops: [...stops, airport], activeSearch: null });
  },

  removeStop: (index) => {
    const { stops } = get();
    set({ stops: stops.filter((_, i) => i !== index) });
  },

  moveStop: (from, to) => {
    const { stops } = get();
    const updated = [...stops];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    set({ stops: updated });
  },

  clearRoute: () => set({ stops: [] }),

  setHoveredAirport: (airport) => set({ hoveredAirport: airport }),

  setActiveSearch: (v) => set({ activeSearch: v }),

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
}));
