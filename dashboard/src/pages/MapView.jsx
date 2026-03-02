import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, useMap } from 'react-leaflet';
import { FaExpand, FaCompress, FaMapMarkerAlt } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import TripPopup from '../components/TripPopup.jsx';
import ExportModal from '../components/ExportModal.jsx';
import useDashboardStore from '../store/dashboardStore.js';
import { getSpatialData } from '../services/apiClient.js';
import { getTravelModeColor, calculateBbox, TRAVEL_MODE_COLORS } from '../utils/mapUtils.js';

const KERALA_CENTER = [10.067, 76.345];
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Fit map to trip bounds when trips are loaded
function BoundsUpdater({ bbox }) {
  const map = useMap();
  useEffect(() => {
    if (bbox) {
      map.fitBounds(bbox, { padding: [30, 30] });
    }
  }, [bbox, map]);
  return null;
}

// Legend component rendered inside map
function MapLegend() {
  return (
    <div className="absolute bottom-8 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 border border-gray-200 dark:border-gray-700">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Travel Mode</p>
      {Object.entries(TRAVEL_MODE_COLORS)
        .filter(([key]) => key !== 'default')
        .map(([mode, color]) => (
          <div key={mode} className="flex items-center gap-2 mb-1">
            <span className="w-5 h-2 rounded-full inline-block" style={{ background: color }} />
            <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{mode}</span>
          </div>
        ))}
    </div>
  );
}

export default function MapView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const mapWrapRef = useRef(null);

  const trips = useDashboardStore((s) => s.trips);
  const setTrips = useDashboardStore((s) => s.setTrips);
  const selectedMode = useDashboardStore((s) => s.selectedMode);
  const filters = useDashboardStore((s) => s.getActiveFilters)();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSpatialData(filters)
      .then((data) => {
        if (!cancelled) {
          setTrips(Array.isArray(data) ? data : data.trips || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedTrips = selectedMode
    ? trips.filter((t) => (t.travel_mode || '').toLowerCase() === selectedMode)
    : trips;

  const bbox = calculateBbox(displayedTrips);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapWrapRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return (
    <div className={`relative ${fullscreen ? 'fixed inset-0 z-[9998]' : ''}`} ref={mapWrapRef}>
      {/* Top info bar */}
      <div className="absolute top-4 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-xl shadow-md px-3 py-2 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <FaMapMarkerAlt className="text-gov-secondary" size={14} />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {loading ? 'Loading trips…' : `${displayedTrips.length} trip${displayedTrips.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
        title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {fullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
      </button>

      {loading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 z-[999] flex items-center justify-center">
          <LoadingSpinner message="Fetching trip data from NATPAC API..." />
        </div>
      )}

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 shadow-lg max-w-sm text-center">
          <strong>Failed to load trips:</strong> {error}
        </div>
      )}

      <MapContainer
        center={KERALA_CENTER}
        zoom={8}
        scrollWheelZoom
        className="leaflet-container"
        zoomControl={false}
      >
        <TileLayer
          url={TILE_URL}
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {bbox && <BoundsUpdater bbox={bbox} />}

        {displayedTrips.map((trip) => {
          const coords = trip.coordinates || trip.geometry?.coordinates || [];
          if (coords.length < 2) return null;
          // GeoJSON coords are [lng, lat]; Leaflet wants [lat, lng]
          const positions = coords.map(([lng, lat]) => [lat, lng]);
          const color = getTravelModeColor(trip.travel_mode);

          return (
            <Polyline
              key={trip.trip_id}
              positions={positions}
              pathOptions={{
                color,
                weight: selectedTrip?.trip_id === trip.trip_id ? 5 : 3,
                opacity: selectedMode && (trip.travel_mode || '').toLowerCase() !== selectedMode ? 0.2 : 0.85,
              }}
              eventHandlers={{ click: () => setSelectedTrip(trip) }}
            >
              <Popup>
                <TripPopup trip={trip} onClose={() => setSelectedTrip(null)} />
              </Popup>
            </Polyline>
          );
        })}

        <MapLegend />
      </MapContainer>

      <ExportModal />
    </div>
  );
}
