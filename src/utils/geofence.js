/**
 * Geofencing utilities
 * Handles geofence creation, validation, and point-in-polygon checks
 */

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {number} lat - Latitude of point
 * @param {number} lon - Longitude of point
 * @param {Array<Array<number>>} polygon - Array of [lat, lon] coordinates defining the polygon
 * @returns {boolean} - True if point is inside polygon
 */
export const isPointInPolygon = (lat, lon, polygon) => {
  if (!polygon || polygon.length < 3) return false

  let inside = false
  let p1lat = polygon[0][0],
    p1lon = polygon[0][1]

  for (let i = 1; i <= polygon.length; i++) {
    const p2lat = polygon[i % polygon.length][0]
    const p2lon = polygon[i % polygon.length][1]

    if (lon > Math.min(p1lon, p2lon)) {
      if (lon <= Math.max(p1lon, p2lon)) {
        if (lat <= Math.max(p1lat, p2lat)) {
          if (p1lon !== p2lon) {
            const xinters =
              ((lon - p1lon) * (p2lat - p1lat)) / (p2lon - p1lon) + p1lat
            if (p1lat === p2lat || lat <= xinters) {
              inside = !inside
            }
          }
        }
      }
    }
    p1lat = p2lat
    p1lon = p2lon
  }

  return inside
}

/**
 * Calculate bounding box from polygon coordinates
 * @param {Array<Array<number>>} polygon - Array of [lat, lon] coordinates
 * @returns {Object} - {minLat, maxLat, minLon, maxLon}
 */
export const getPolygonBounds = (polygon) => {
  if (!polygon || polygon.length === 0) {
    return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 }
  }

  let minLat = polygon[0][0]
  let maxLat = polygon[0][0]
  let minLon = polygon[0][1]
  let maxLon = polygon[0][1]

  polygon.forEach(([lat, lon]) => {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
  })

  return { minLat, maxLat, minLon, maxLon }
}

/**
 * Calculate bounding box from multiple points (team locations)
 * @param {Array<Object>} points - Array of {lat, lon} objects
 * @returns {Object} - {minLat, maxLat, minLon, maxLon}
 */
export const getPointsBounds = (points) => {
  if (!points || points.length === 0) {
    return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 }
  }

  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLon = points[0].lon
  let maxLon = points[0].lon

  points.forEach(({ lat, lon }) => {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
  })

  return { minLat, maxLat, minLon, maxLon }
}

/**
 * Combine multiple bounding boxes
 * @param {Array<Object>} bounds - Array of {minLat, maxLat, minLon, maxLon}
 * @returns {Object} - Combined bounding box
 */
export const combineBounds = (boundsArray) => {
  if (!boundsArray || boundsArray.length === 0) {
    return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 }
  }

  let minLat = boundsArray[0].minLat
  let maxLat = boundsArray[0].maxLat
  let minLon = boundsArray[0].minLon
  let maxLon = boundsArray[0].maxLon

  boundsArray.forEach((bounds) => {
    minLat = Math.min(minLat, bounds.minLat)
    maxLat = Math.max(maxLat, bounds.maxLat)
    minLon = Math.min(minLon, bounds.minLon)
    maxLon = Math.max(maxLon, bounds.maxLon)
  })

  return { minLat, maxLat, minLon, maxLon }
}

/**
 * Get geofence from localStorage
 * @param {number} eventId - Event ID
 * @returns {Array<Array<number>>|null} - Geofence polygon or null
 */
export const getGeofence = (eventId) => {
  try {
    const geofenceData = localStorage.getItem(`geofence_${eventId}`)
    return geofenceData ? JSON.parse(geofenceData) : null
  } catch (error) {
    console.error('Error reading geofence:', error)
    return null
  }
}

/**
 * Save geofence to localStorage
 * @param {number} eventId - Event ID
 * @param {Array<Array<number>>} polygon - Geofence polygon coordinates
 */
export const saveGeofence = (eventId, polygon) => {
  try {
    localStorage.setItem(`geofence_${eventId}`, JSON.stringify(polygon))
    console.log('[Geofence] Saved geofence for event', eventId, polygon)
  } catch (error) {
    console.error('Error saving geofence:', error)
  }
}

/**
 * Delete geofence from localStorage
 * @param {number} eventId - Event ID
 */
export const deleteGeofence = (eventId) => {
  try {
    localStorage.removeItem(`geofence_${eventId}`)
    console.log('[Geofence] Deleted geofence for event', eventId)
  } catch (error) {
    console.error('Error deleting geofence:', error)
  }
}
