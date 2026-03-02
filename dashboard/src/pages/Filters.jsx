import { useState } from 'react';
import { FaFilter, FaTimes, FaDownload } from 'react-icons/fa';
import useDashboardStore from '../store/dashboardStore.js';
import ExportModal from '../components/ExportModal.jsx';

const DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha',
  'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad',
  'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
];

const PURPOSES = [
  'Work', 'Shopping', 'Leisure', 'Medical', 'Education', 'Social', 'Other',
];

const TIME_SLOTS = [
  { value: 'morning_peak', label: 'Morning Peak (8–10 AM)' },
  { value: 'evening_peak', label: 'Evening Peak (6–8 PM)' },
  { value: 'off_peak', label: 'Off-Peak (Other hours)' },
];

function MultiSelect({ options, selected, onChange, label }) {
  const toggle = (val) => {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    );
  };
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          const isSelected = selected.includes(val);
          return (
            <button
              key={val}
              type="button"
              onClick={() => toggle(val)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Filters() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const clearFilters = useDashboardStore((s) => s.clearFilters);
  const setExportModalOpen = useDashboardStore((s) => s.setExportModalOpen);
  const setTrips = useDashboardStore((s) => s.setTrips);

  // Local draft state (only applied on "Apply")
  const [draft, setDraft] = useState({ ...filters });
  const [applied, setApplied] = useState(false);

  const setDraftField = (key, val) => setDraft((d) => ({ ...d, [key]: val }));

  const handleApply = () => {
    Object.entries(draft).forEach(([k, v]) => setFilter(k, v));
    setApplied(true);
    // Signal to map to re-fetch (map watches filters from store)
    setTrips([]); // clear existing trips so map refetches
  };

  const handleClear = () => {
    clearFilters();
    setDraft({ dateFrom: '', dateTo: '', timeOfDay: [], districts: [], purposes: [] });
    setApplied(false);
    setTrips([]);
  };

  const activeCount = [
    draft.dateFrom,
    draft.dateTo,
    ...draft.timeOfDay,
    ...draft.districts,
    ...draft.purposes,
  ].filter(Boolean).length;

  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Filters & Export</h1>
          {activeCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full px-2 py-0.5">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={() => setExportModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm self-start"
        >
          <FaDownload size={12} />
          Export Data
        </button>
      </div>

      <div className="card space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <FaFilter size={12} />
          Filter Trip Data
        </div>

        {/* Date range */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range</p>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
              <input
                type="date"
                value={draft.dateFrom}
                onChange={(e) => setDraftField('dateFrom', e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
              <input
                type="date"
                value={draft.dateTo}
                onChange={(e) => setDraftField('dateTo', e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Time of day */}
        <MultiSelect
          label="Time of Day"
          options={TIME_SLOTS}
          selected={draft.timeOfDay}
          onChange={(v) => setDraftField('timeOfDay', v)}
        />

        {/* Districts */}
        <MultiSelect
          label="District"
          options={DISTRICTS}
          selected={draft.districts}
          onChange={(v) => setDraftField('districts', v)}
        />

        {/* Trip purpose */}
        <MultiSelect
          label="Trip Purpose"
          options={PURPOSES}
          selected={draft.purposes}
          onChange={(v) => setDraftField('purposes', v)}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleApply} className="btn-primary flex items-center gap-2">
            <FaFilter size={12} />
            Apply Filters
          </button>
          <button onClick={handleClear} className="btn-secondary flex items-center gap-2">
            <FaTimes size={12} />
            Clear All
          </button>
        </div>

        {applied && (
          <p className="text-xs text-green-600 dark:text-green-400">
            ✓ Filters applied. Navigate to Map or Analytics to see updated results.
          </p>
        )}
      </div>

      <ExportModal />
    </div>
  );
}
