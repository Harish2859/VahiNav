import { useNavigate } from 'react-router-dom';
import { FaDownload, FaRoute } from 'react-icons/fa';
import { getTravelModeColor, formatDistance, formatDuration } from '../utils/mapUtils.js';

export default function TripPopup({ trip, onClose }) {
  const navigate = useNavigate();

  if (!trip) return null;

  const modeColor = getTravelModeColor(trip.travel_mode);
  const modeBg = `${modeColor}22`;

  const handleDownloadGeoJSON = () => {
    const geojson = {
      type: 'Feature',
      properties: {
        trip_id: trip.trip_id,
        travel_mode: trip.travel_mode,
        distance_meters: trip.distance_meters,
        duration_seconds: trip.duration_seconds,
        purpose: trip.purpose,
        companions: trip.companions,
      },
      geometry: {
        type: 'LineString',
        coordinates: trip.coordinates || [],
      },
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip_${trip.trip_id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-w-[220px] text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-800">Trip Details</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: modeBg, color: modeColor }}
        >
          {trip.travel_mode || 'Unknown'}
        </span>
      </div>

      <table className="w-full text-xs text-gray-600 mb-3">
        <tbody>
          <tr>
            <td className="pr-2 py-0.5 font-medium text-gray-500">Trip ID</td>
            <td className="font-mono">{trip.trip_id || '—'}</td>
          </tr>
          <tr>
            <td className="pr-2 py-0.5 font-medium text-gray-500">Distance</td>
            <td>{formatDistance(trip.distance_meters)}</td>
          </tr>
          <tr>
            <td className="pr-2 py-0.5 font-medium text-gray-500">Duration</td>
            <td>{formatDuration(trip.duration_seconds)}</td>
          </tr>
          {trip.purpose && (
            <tr>
              <td className="pr-2 py-0.5 font-medium text-gray-500">Purpose</td>
              <td>{trip.purpose}</td>
            </tr>
          )}
          {trip.companions != null && (
            <tr>
              <td className="pr-2 py-0.5 font-medium text-gray-500">Companions</td>
              <td>{trip.companions}</td>
            </tr>
          )}
          {trip.cost != null && (
            <tr>
              <td className="pr-2 py-0.5 font-medium text-gray-500">Cost</td>
              <td>₹{trip.cost}</td>
            </tr>
          )}
          {trip.start_location && (
            <tr>
              <td className="pr-2 py-0.5 font-medium text-gray-500">From</td>
              <td className="break-all">{trip.start_location}</td>
            </tr>
          )}
          {trip.end_location && (
            <tr>
              <td className="pr-2 py-0.5 font-medium text-gray-500">To</td>
              <td className="break-all">{trip.end_location}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/dashboard/trip-chains`)}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
        >
          <FaRoute size={10} />
          View Details
        </button>
        <button
          onClick={handleDownloadGeoJSON}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
        >
          <FaDownload size={10} />
          GeoJSON
        </button>
      </div>
    </div>
  );
}
