import L from 'leaflet'

/**
 * Create a custom Leaflet icon for a team
 * Shows team initials or name in a colored circle marker
 * @param {string} teamName - Name of the team
 * @param {string} color - HEX color code for the team
 * @param {boolean} isSelected - Whether the team is currently selected
 * @returns {L.Icon}
 */
/**
 * Darken a hex color by a percentage
 * @param {string} hexColor - HEX color code
 * @param {number} percent - Darkening factor (0-1)
 * @returns {string} - Darkened HEX color
 */
const darkenColor = (hexColor, percent = 0.2) => {
  const rgb = parseInt(hexColor.slice(1), 16);
  let r = (rgb >> 16) & 255;
  let g = (rgb >> 8) & 255;
  let b = rgb & 255;

  r = Math.floor(r * (1 - percent));
  g = Math.floor(g * (1 - percent));
  b = Math.floor(b * (1 - percent));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Create a custom Leaflet icon for a team
 * Trigonal trapezohedron with dynamic coloring:
 * - Top face: team color (slightly darker)
 * - Right face: team color
 * - Left face: dynamic based on geofence status and update age
 * @param {string} teamName - Name of the team
 * @param {string} color - HEX color code for the team
 * @param {boolean} isSelected - Whether the team is currently selected
 * @param {boolean} isGeofenceBreach - Whether team is outside geofence
 * @param {Date|string} lastUpdateTime - Timestamp of last location update
 * @returns {L.Icon}
 */
export const createTeamIcon = (
  teamName = 'Team',
  color = '#3B82F6',
  isSelected = false,
  isGeofenceBreach = false,
  lastUpdateTime = null
) => {
  // Determine left face color based on geofence status and update age
  let leftFaceColor = '#22c55e'; // Default: green (inside geofence, recent)

  if (isGeofenceBreach) {
    leftFaceColor = '#ef4444'; // Red: outside geofence
  } else if (lastUpdateTime) {
    const updateDate = new Date(lastUpdateTime);
    const now = new Date();
    const minutesOld = (now.getTime() - updateDate.getTime()) / (1000 * 60);

    if (minutesOld > 10) {
      leftFaceColor = '#eab308'; // Yellow: inside but stale (>10 minutes)
    }
  }

  // Top and right faces use team color
  const topRightColor = color;
  const topRightDarkColor = darkenColor(color, 0.15);

  const borderColor = isSelected ? '#000000' : darkenColor(color, 0.7);
  const borderWidth = isSelected ? '1' : '0.5';

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="48" height="56">
      <!-- Trigonal trapezohedron standing on tip -->
      <!-- Front face (pointing down to location) -->
      <polygon points="24,50 8,20 40,20" fill="${leftFaceColor}" stroke="${borderColor}" stroke-width="${borderWidth}" opacity="0.95"/>
      
      <!-- Left face (dynamic color based on geofence status) -->
      <polygon points="24,50 8,20 14,6 24,2" fill="${leftFaceColor}" stroke="${borderColor}" stroke-width="${borderWidth}" opacity="0.95"/>
      
      <!-- Right face (team color) -->
      <polygon points="24,50 40,20 34,6 24,2" fill="${topRightColor}" stroke="${borderColor}" stroke-width="${borderWidth}" opacity="0.95"/>
      
      <!-- Top facet (team color, slightly darker) -->
      <polygon points="14,6 24,2 34,6 24,10" fill="${topRightDarkColor}" stroke="${borderColor}" stroke-width="${borderWidth}" opacity="0.9"/>
    </svg>
  `

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgMarkup)}`,
    iconSize: [48, 56],
    iconAnchor: [24, 50],
    popupAnchor: [0, -50],
    className: 'team-marker',
  })
}

/**
 * Create a trail/polyline color that matches the team color
 * @param {string} color - HEX color code for the team
 * @returns {object} - Polyline styling options
 */
export const getTeamTrailStyle = (color = '#3B82F6') => {
  return {
    color: color,
    weight: 2,
    opacity: 0.6,
    dashArray: '5, 5',
    lineCap: 'round',
    lineJoin: 'round',
  }
}

/**
 * Get consistent team marker styling
 * Ensures all team elements (marker, trail, popup) use the same color
 * @param {string} color - HEX color code for the team
 * @param {boolean} isSelected - Whether the team is selected
 * @returns {object} - Complete styling configuration
 */
export const getTeamMarkerStyle = (color = '#3B82F6', isSelected = false) => {
  return {
    fillColor: color,
    borderColor: isSelected ? '#000000' : color,
    borderWeight: isSelected ? 3 : 2,
    fillOpacity: isSelected ? 1 : 0.8,
    textColor: getContrastColor(color),
  }
}

/**
 * Calculate contrast text color based on background
 * @param {string} hexColor - HEX color code
 * @returns {string} - '#000000' for light backgrounds, '#FFFFFF' for dark
 */
const getContrastColor = (hexColor) => {
  const rgb = parseInt(hexColor.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#000000' : '#FFFFFF';
}

/**
 * Get styling for history trail dots
 * @param {string} color - HEX color code for the team
 * @returns {object} - CircleMarker styling options
 */
export const getHistoryDotStyle = (color = '#3B82F6') => {
  return {
    color: color,
    fillColor: color,
    fillOpacity: 0.65,
    opacity: 0.85,
    weight: 1,
    radius: 3,
  }
}
