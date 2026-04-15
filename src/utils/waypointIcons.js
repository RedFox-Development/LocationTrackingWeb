import L from 'leaflet'

/**
 * Create a Leaflet icon for a waypoint based on type and visited status
 * @param {string} type - 'START', 'CHECKPOINT', or 'END' (uppercase, from database)
 * @param {boolean} isRequired - Whether the waypoint is required
 * @param {boolean} isVisited - Whether the waypoint has been visited by at least one team
 * @returns {L.Icon} - A Leaflet icon object suitable for use with Marker components
 */
export const createWaypointIcon = (type = 'CHECKPOINT', isRequired = false, isVisited = false) => {
  // Determine colors based on status
  const fillColor = isVisited ? '#16a34a' : isRequired ? '#dc2626' : '#9ca3af'
  const strokeColor = isRequired ? '#7f1d1d' : '#4b5563'
  const innerColor = isRequired ? '#fff' : isVisited ? '#14532d' : '#374151'

  // Normalize type to uppercase for comparison
  const normalizedType = String(type || 'CHECKPOINT').toUpperCase()

  // Determine marker shape based on waypoint type
  let shapeMarkup = ''
  let iconAnchorY = 28
  
  if (normalizedType === 'START') {
    // Triangle pointing down
    shapeMarkup = `<path d="M12 2 L22 20 L2 20 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2"/><circle cx="12" cy="12" r="2.5" fill="${innerColor}"/>`
    iconAnchorY = 20
  } else if (normalizedType === 'END') {
    // Diamond shape
    shapeMarkup = `<path d="M12 2 L22 12 L12 22 L2 12 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2"/><circle cx="12" cy="12" r="2.5" fill="${innerColor}"/>`
    iconAnchorY = 22
  } else {
    // Default: Checkpoint - circle (traditional marker shape)
    shapeMarkup = `<path d="M12 2C8.13 2 5 5.13 5 9c0 4.61 5.07 10.83 6.02 11.96a1.26 1.26 0 0 0 1.96 0C13.93 19.83 19 13.61 19 9c0-3.87-3.13-7-7-7z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2"/><circle cx="12" cy="9" r="3" fill="${innerColor}"/>`
  }

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">${shapeMarkup}</svg>`

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgMarkup)}`,
    iconSize: [28, 28],
    iconAnchor: [14, iconAnchorY],
    popupAnchor: [0, -iconAnchorY],
  })
}
