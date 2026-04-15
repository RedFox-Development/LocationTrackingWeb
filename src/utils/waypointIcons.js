import 'leaflet-svg-shape-markers'

/**
 * Create a Leaflet icon for a waypoint based on type and visited status
 * @param {string} type - 'START', 'CHECKPOINT', or 'END'
 * @param {boolean} isRequired - Whether the waypoint is required
 * @param {boolean} isVisited - Whether the waypoint has been visited at least by one team
 * @returns {L.shapeMarker}
 */
export const createWaypointIcon = (type = 'CHECKPOINT', isRequired = false, isVisited = false) => {
  let fillColor = isVisited ? '#16a34a' : isRequired ? '#dc2626' : '#d8b803'
  let strokeColor = isRequired ? '#dc2626' : '#d8b803'

  return L.shapeMarker({
    shape: type === 'START' ? 'triangle-down' : type === 'END' ? 'diamond' : 'circle',
    radius: 5,
    fillColor: fillColor,
    color: strokeColor,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.2,
    padding: [5, 5],
  })
}
