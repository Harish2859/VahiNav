import { useState, useEffect } from 'react';
import { FaDownload, FaUser, FaSearch } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import useDashboardStore from '../store/dashboardStore.js';
import { getTripChains } from '../services/apiClient.js';
import { getTravelModeColor, formatDistance, formatDuration, parseTimestamp } from '../utils/mapUtils.js';

// Demo users for the selector
const DEMO_USERS = [
  'User_Alpha_1',
  'User_Alpha_2',
  'User_Alpha_3',
  'User_Beta_1',
  'User_Beta_2',
];

const MODE_ICONS = { car: '🚗', bus: '🚌', auto: '🛺', walk: '🚶', bicycle: '🚲' };

function modeIcon(mode) {
  return MODE_ICONS[(mode || '').toLowerCase()] || '🚍';
}

export default function TripChainReconstruction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chains, setChains] = useState(null);
  const [search, setSearch] = useState('');

  const selectedUser = useDashboardStore((s) => s.selectedUser);
  const setSelectedUser = useDashboardStore((s) => s.setSelectedUser);

  const filteredUsers = DEMO_USERS.filter((u) =>
    u.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!selectedUser) return;
    setLoading(true);
    setError(null);
    setChains(null);
    getTripChains(selectedUser)
      .then((data) => { setChains(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [selectedUser]);

  const handleExportChain = () => {
    if (!chains) return;
    const json = JSON.stringify({ user: selectedUser, chain: chains }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip_chain_${selectedUser}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tripList = chains?.trips || chains || [];
  const modeCount = new Set(tripList.map((t) => (t.travel_mode || '').toLowerCase()).filter(Boolean)).size;

  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Trip Chain Reconstruction</h1>
        {chains && tripList.length > 0 && (
          <button onClick={handleExportChain} className="btn-secondary flex items-center gap-2 text-sm self-start">
            <FaDownload size={12} />
            Export Chain JSON
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* User selector */}
        <div className="md:col-span-1">
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <FaUser size={12} /> Select User
            </h2>
            <div className="relative">
              <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              {filteredUsers.map((user) => (
                <button
                  key={user}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedUser === user
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {user}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="md:col-span-3">
          {!selectedUser && (
            <div className="card flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
              <FaUser size={32} className="opacity-30" />
              <p className="text-sm">Select a user to view their trip chain</p>
            </div>
          )}

          {selectedUser && loading && <LoadingSpinner message={`Loading trip chain for ${selectedUser}…`} />}

          {selectedUser && error && (
            <div className="card border border-red-200 dark:border-red-800">
              <p className="text-red-500 text-sm mb-1">Failed to load trip chain</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          )}

          {selectedUser && !loading && !error && chains && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="card">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">User: </span>
                    <strong className="text-gray-800 dark:text-gray-100">{selectedUser}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Trips today: </span>
                    <strong className="text-gov-secondary">{tripList.length}</strong>
                  </div>
                  {modeCount > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Modes used: </span>
                      <strong className="text-gov-secondary">{modeCount}</strong>
                    </div>
                  )}
                </div>
                {modeCount >= 2 && (
                  <p className="text-xs text-gov-accent mt-2">
                    💡 This user uses {modeCount} different modes per day — multi-modal commuter.
                  </p>
                )}
              </div>

              {/* Timeline */}
              {tripList.length === 0 ? (
                <div className="card text-center text-sm text-gray-400 py-8">
                  No trip chains found for this user.
                </div>
              ) : (
                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
                    Daily Travel Timeline
                  </h2>
                  <div className="relative">
                    {tripList.map((trip, idx) => {
                      const color = getTravelModeColor(trip.travel_mode);
                      return (
                        <div key={trip.trip_id || idx} className="timeline-item">
                          <div
                            className="timeline-dot"
                            style={{ background: color }}
                          />
                          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                                  {parseTimestamp(trip.start_time)}
                                </div>
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                  {trip.start_location || `Stop ${idx + 1}`}
                                  {' '}→{' '}
                                  {trip.end_location || `Stop ${idx + 2}`}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                  <span>{formatDistance(trip.distance_meters)}</span>
                                  <span>·</span>
                                  <span>{formatDuration(trip.duration_seconds)}</span>
                                  {trip.purpose && <><span>·</span><span>{trip.purpose}</span></>}
                                </div>
                              </div>
                              <span
                                className="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full text-white"
                                style={{ background: color }}
                                title={trip.travel_mode}
                              >
                                {modeIcon(trip.travel_mode)} {trip.travel_mode || '?'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Final destination */}
                    <div className="pl-8">
                      <div className="absolute left-0 top-auto w-5 h-5 rounded-full bg-gray-400 border-2 border-white dark:border-gray-800" />
                      <div className="text-xs text-gray-400">
                        {tripList[tripList.length - 1]?.end_time
                          ? parseTimestamp(tripList[tripList.length - 1].end_time)
                          : 'End of day'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                        {tripList[tripList.length - 1]?.end_location || 'Final destination'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
