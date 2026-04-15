import L from 'leaflet'

/**
 * Create a Leaflet icon for a waypoint based on type and visited status
 * @param {string} type - 'START', 'CHECKPOINT', or 'END'
 * @param {boolean} isRequired - Whether the waypoint is required
 * @param {boolean} isVisited - Whether the waypoint has been visited at least by one team
 * @returns {L.Icon}
 */
export const createWaypointIcon = (type = 'CHECKPOINT', isRequired = false, isVisited = false) => {
  // Determine colors based on status
  const fillColor = isVisited ? '#16a34a' : isRequired ? '#dc2626' : '#d8b803'
  const strokeColor = isRequired ? '#7f1d1d' : isVisited ? '#166534' : '#d8b803'

  // Normalize type to uppercase for comparison
  const normalizedType = String(type || 'CHECKPOINT').toUpperCase()

  // Determine marker shape based on waypoint type
  let shapeMarkup = ''
  let iconAnchorY = 20
  
  if (normalizedType === 'START') {
    // Down-pointing triangle
    shapeMarkup = `<path d="M12 2 L22 20 L2 20 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" fill-opacity="0.2"/>`

  } else if (normalizedType === 'END') {
    // Diamond shape
    shapeMarkup = `<path d="M12 2 L22 12 L12 22 L2 12 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" fill-opacity="0.2"/>`
  } else {
    // Default: Checkpoint - circle (traditional marker shape)
    shapeMarkup = `<circle cx="12" cy="12" r="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" fill-opacity="0.2"/>`
  }

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">${shapeMarkup}</svg>`

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svgMarkup)}`,
    iconSize: [24, 24],
    iconAnchor: [14, iconAnchorY],
    popupAnchor: [0, -iconAnchorY],
  })
}
