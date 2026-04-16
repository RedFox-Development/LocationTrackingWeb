import JSZip from 'jszip'
import { graphqlClient } from '../api/graphql/graphqlClient'
import { EXPORT_EVENT_DATA } from '../api/graphql/event'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'

/**
 * Formats a date for filename use (YYYY-MM-DD)
 */
const formatDateForFilename = (date) => {
  return date.toISOString().split('T')[0]
}
const base64ToBytes = (base64) => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

const getBinaryBase64 = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') return null
  if (rawValue.startsWith('data:')) {
    const parts = rawValue.split(',')
    return parts.length === 2 ? parts[1] : null
  }
  return rawValue
}

/**
 * Converts location updates to GeoJSON format
 */
const locationsToGeoJSON = (locations, teamName) => {
  return {
    type: 'FeatureCollection',
    features: locations.map(loc => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [loc.lon, loc.lat]
      },
      properties: {
        team: teamName,
        timestamp: loc.timestamp,
      }
    }))
  }
}

const geofenceToGeoJSON = (geofence) => {
  if (!Array.isArray(geofence) || geofence.length < 3) {
    return null
  }

  const ring = geofence.map(([lat, lon]) => [lon, lat])
  const [firstLon, firstLat] = ring[0]
  const [lastLon, lastLat] = ring[ring.length - 1]
  if (firstLon !== lastLon || firstLat !== lastLat) {
    ring.push([firstLon, firstLat])
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
        properties: {
          name: 'Event Geofence',
        },
      },
    ],
  }
}

const waypointsToGeoJSON = (waypoints) => {
  return {
    type: 'FeatureCollection',
    features: (waypoints || []).map((waypoint) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [waypoint.lon, waypoint.lat],
      },
      properties: {
        id: waypoint.id,
        name: waypoint.name,
        isRequired: Boolean(waypoint.is_required),
        createdAt: waypoint.created_at,
      },
    })),
  }
}

/**
 * Exports event data as a ZIP file
 * @param {string} eventId - Event ID
 * @param {string} keycode - Event keycode for authentication
 * @param {Date} startDate - Start date for location filtering (optional)
 * @param {Date} endDate - End date for location filtering (optional)
 * @returns {Promise<Blob>} ZIP file as a Blob
 */
export const exportEventAsZip = async (eventId, keycode, startDate, endDate) => {
  try {
    console.log('[exportData] Starting export with:', { eventId, keycode: '***', startDate, endDate })
    
    // Fetch data from API using GraphQL client
    const result = await graphqlClient.query({
      query: EXPORT_EVENT_DATA,
      variables: {
        eventId,
        keycode,
        startDate: startDate ? formatDateForFilename(startDate) : undefined,
        endDate: endDate ? formatDateForFilename(endDate) : undefined
      },
      fetchPolicy: 'no-cache'
    })

    console.log('[exportData] Query result:', result)
    
    if (!result?.data?.exportEventData) {
      throw new Error('No export data returned from server')
    }

    const exportData = result.data.exportEventData
    console.log('[exportData] Export data received, teams:', exportData.teams?.length, 'waypoints:', exportData.waypoints?.length)
    
    // Log location counts for each team
    if (exportData.teams && exportData.teams.length > 0) {
      console.log('[exportData] Team location data:')
      exportData.teams.forEach(team => {
        const locCount = team.locations ? team.locations.length : 0
        console.log(`  - ${team.name}: ${locCount} locations`)
      })
    }

    let waypoints = []
    try {
      const { data: waypointData } = await graphqlClient.query({
        query: GET_WAYPOINTS,
        variables: { eventId },
        fetchPolicy: 'no-cache',
      })
      waypoints = waypointData?.waypoints || []
      console.log('[exportData] Waypoints loaded:', waypoints.length)
    } catch (error) {
      console.warn('[exportData] Failed to load waypoints for export:', error)
    }

    const zip = new JSZip()

    // Add metadata.json
    const metadata = {
      event: {
        id: exportData.event.id,
        name: exportData.event.name,
        organizationName: exportData.event.organization_name,
        expirationDate: exportData.event.expiration_date,
        geofencePointCount: (() => {
          try {
            const parsed = JSON.parse(exportData.event.geofence_data || 'null')
            return Array.isArray(parsed) ? parsed.length : 0
          } catch {
            return 0
          }
        })(),
      },
    exportDate: new Date().toISOString(),
    dateRange: {
      start: startDate ? startDate.toISOString() : 'all',
      end: endDate ? endDate.toISOString() : 'all'
    },
    teamCount: exportData.teams.length,
    waypointCount: waypoints.length,
    totalLocations: exportData.teams.reduce((sum, team) => sum + (team.locations ? team.locations.length : 0), 0)
  }
  zip.file('metadata.json', JSON.stringify(metadata, null, 2))

  const basicEventInfo = {
    id: exportData.event.id,
    name: exportData.event.name,
    organization_name: exportData.event.organization_name,
    expiration_date: exportData.event.expiration_date,
    geofence_data: exportData.event.geofence_data,
    startDate: exportData.startDate,
    endDate: exportData.endDate,
  }
  zip.file('event.json', JSON.stringify(basicEventInfo, null, 2))

  // Add event image if available
  if (exportData.event.image_data && exportData.event.image_mime_type) {
    const imageBase64 = getBinaryBase64(exportData.event.image_data)
    if (imageBase64) {
      const imageBytes = base64ToBytes(imageBase64)
      const extension = exportData.event.image_mime_type.split('/')[1] || 'jpg'
      zip.file(`event-image.${extension}`, imageBytes, { binary: true })
    }
  }

  // Add event logo if available
  if (exportData.event.logo_data && exportData.event.logo_mime_type) {
    const logoBase64 = getBinaryBase64(exportData.event.logo_data)
    if (logoBase64) {
      const logoBytes = base64ToBytes(logoBase64)
      const extension = exportData.event.logo_mime_type.split('/')[1] || 'png'
      zip.file(`event-logo.${extension}`, logoBytes, { binary: true })
    }
  }

  let parsedGeofence = null
  try {
    parsedGeofence = exportData.event.geofence_data ? JSON.parse(exportData.event.geofence_data) : null
  } catch {
    parsedGeofence = null
  }

  if (parsedGeofence) {
    zip.file('geofence.json', JSON.stringify(parsedGeofence, null, 2))
    const geofenceGeoJson = geofenceToGeoJSON(parsedGeofence)
    if (geofenceGeoJson) {
      zip.file('geofence.geojson', JSON.stringify(geofenceGeoJson, null, 2))
    }
  }

  if (waypoints.length > 0) {
    zip.file('waypoints.json', JSON.stringify(waypoints, null, 2))
    zip.file('waypoints.geojson', JSON.stringify(waypointsToGeoJSON(waypoints), null, 2))
  }

  // Add analytics if available
  if (exportData.analytics) {
    const analyticsData = {
      team_metrics: exportData.analytics.team_metrics || [],
      heatmap: exportData.analytics.heatmap || {},
      dwell_points_summary: (() => {
        try {
          const dwellPoints = JSON.parse(exportData.analytics.dwell_points_by_team || '{}')
          return dwellPoints
        } catch {
          return {}
        }
      })(),
    }
    zip.file('analytics/event-analytics.json', JSON.stringify(analyticsData, null, 2))
    
    // Save team metrics as CSV
    if (exportData.analytics.team_metrics && exportData.analytics.team_metrics.length > 0) {
      const csvHeader = 'Team ID,Team Name,Total Updates,Distance (m),Duration (s),Avg Speed (m/s),Max Speed (m/s),Entropy,Sinuosity\n'
      const csvRows = exportData.analytics.team_metrics.map(metric =>
        `${metric.team_id},"${metric.team_name}",${metric.total_updates},${metric.distance_traveled_meters},${metric.duration_seconds},${metric.avg_speed_mps},${metric.max_speed_mps},${metric.kinematic_entropy},${metric.path_sinuosity}`
      ).join('\n')
      zip.file('analytics/team-metrics.csv', csvHeader + csvRows)
    }
  }

  // Add teams.json with summary
  const teamsSummary = exportData.teams.map(team => ({
    id: team.id,
    name: team.name,
    color: team.color,
    locationCount: team.locations ? team.locations.length : 0,
    expirationDate: team.expiration_date
  }))
  zip.file('teams.json', JSON.stringify(teamsSummary, null, 2))

  // Create a folder for each team
  const teamsFolder = zip.folder('teams')
  for (const team of exportData.teams) {
    const teamFolder = teamsFolder.folder(team.name.replace(/[^a-z0-9]/gi, '_'))
    
    // Add team metadata
    teamFolder.file('team-info.json', JSON.stringify({
      id: team.id,
      name: team.name,
      color: team.color,
      locationCount: team.locations ? team.locations.length : 0
    }, null, 2))
    
    // Add location files if team has data
    if (team.locations && team.locations.length > 0) {
      // Add GeoJSON file
      const geojson = locationsToGeoJSON(team.locations, team.name)
      teamFolder.file('locations.geojson', JSON.stringify(geojson, null, 2))
      
      // Add CSV file for spreadsheet compatibility
      const csvHeader = 'latitude,longitude,timestamp\n'
      const csvRows = team.locations.map(loc => 
        `${loc.lat},${loc.lon},${loc.timestamp}`
      ).join('\n')
      teamFolder.file('locations.csv', csvHeader + csvRows)
    } else {
      // Add empty files for teams with no location data
      teamFolder.file('locations.geojson', JSON.stringify({
        type: 'FeatureCollection',
        features: []
      }, null, 2))
      
      const csvHeader = 'latitude,longitude,timestamp\n'
      teamFolder.file('locations.csv', csvHeader)
    }
  }

  // Generate ZIP file
  const blob = await zip.generateAsync({ type: 'blob' })
  console.log('[exportData] ZIP file generated successfully, size:', blob.size, 'bytes')
  return blob
  } catch (error) {
    console.error('[exportData] Export failed:', error)
    console.error('[exportData] Error details:', {
      message: error?.message,
      networkError: error?.networkError,
      graphQLErrors: error?.graphQLErrors,
    })
    throw new Error(`Export failed: ${error?.message || error?.graphQLErrors?.[0]?.message || 'Unknown error'}`)
  }
}

/**
 * Downloads a blob as a file
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Exports event data and triggers download
 */
export const exportAndDownload = async (eventId, eventName, keycode, startDate, endDate) => {
  const zipBlob = await exportEventAsZip(eventId, keycode, startDate, endDate)
  
  const dateStr = formatDateForFilename(new Date())
  const filename = `${eventName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.zip`
  
  downloadBlob(zipBlob, filename)
}
