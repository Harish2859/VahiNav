export const TRAVEL_MODE_COLORS = {
  car: '#FF5252',
  bus: '#2E88F0',
  auto: '#FF9800',
  walk: '#4CAF50',
  bicycle: '#9C27B0',
  default: '#607D8B',
};

/**
 * Returns the hex color for a given travel mode.
 * @param {string} mode
 * @returns {string} hex color
 */
export function getTravelModeColor(mode) {
  return TRAVEL_MODE_COLORS[(mode || '').toLowerCase()] || TRAVEL_MODE_COLORS.default;
}

/**
 * Formats distance from meters to human-readable string.
 * @param {number} meters
 * @returns {string} e.g. "5.2 km" or "450 m"
 */
export function formatDistance(meters) {
  if (meters == null) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Formats duration from seconds to human-readable string.
 * @param {number} seconds
 * @returns {string} e.g. "15 min" or "1 hr 5 min"
 */
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

/**
 * Parses an ISO-8601 timestamp to a formatted string.
 * @param {string} iso8601
 * @returns {string} e.g. "2026-03-02 10:30 AM"
 */
export function parseTimestamp(iso8601) {
  if (!iso8601) return '—';
  const d = new Date(iso8601);
  if (isNaN(d)) return iso8601;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculates bounding box for an array of trips (each with a coordinates array).
 * @param {Array} trips - array of trip objects with coordinates [[lng,lat],...]
 * @returns {[[number,number],[number,number]]} [[minLat,minLng],[maxLat,maxLng]]
 */
export function calculateBbox(trips) {
  if (!trips || trips.length === 0) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;

  trips.forEach((trip) => {
    const coords = trip.coordinates || trip.geometry?.coordinates || [];
    coords.forEach(([lng, lat]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  });

  if (!isFinite(minLat)) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}
