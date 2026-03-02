import { create } from 'zustand';

const useDashboardStore = create((set, get) => ({
  // Trip data
  trips: [],
  setTrips: (trips) => set({ trips }),

  // Active filters
  filters: {
    dateFrom: '',
    dateTo: '',
    timeOfDay: [],
    districts: [],
    purposes: [],
  },
  setFilter: (filterType, value) =>
    set((state) => ({
      filters: { ...state.filters, [filterType]: value },
    })),
  clearFilters: () =>
    set({
      filters: {
        dateFrom: '',
        dateTo: '',
        timeOfDay: [],
        districts: [],
        purposes: [],
      },
    }),

  // Selected travel mode (for highlighting)
  selectedMode: null,
  setSelectedMode: (mode) => set({ selectedMode: mode }),

  // Selected user for trip chain view
  selectedUser: '',
  setSelectedUser: (userId) => set({ selectedUser: userId }),

  // Modal split data
  modalSplitData: null,
  setModalSplitData: (data) => set({ modalSplitData: data }),

  // Export modal visibility
  exportModalOpen: false,
  setExportModalOpen: (open) => set({ exportModalOpen: open }),

  // Getters
  getActiveFilters: () => {
    const { filters } = get();
    const params = {};
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.timeOfDay.length) params.time_of_day = filters.timeOfDay.join(',');
    if (filters.districts.length) params.district = filters.districts.join(',');
    if (filters.purposes.length) params.purpose = filters.purposes.join(',');
    return params;
  },
}));

export default useDashboardStore;
