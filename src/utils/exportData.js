import JSZip from 'jszip'
import { graphqlClient } from '../api/graphql/graphqlClient'
import { EXPORT_EVENT_DATA } from '../api/graphql/event'
import { parseDataUri } from './dataUri'

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
        coordinates: [loc.longitude, loc.latitude]
      },
      properties: {
        team: teamName,
        timestamp: loc.timestamp,
        accuracy: loc.accuracy
      }
    }))
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
  // Fetch data from API using GraphQL client
  const { data } = await graphqlClient.query({
    query: EXPORT_EVENT_DATA,
    variables: {
      eventId,
      keycode,
      startDate: startDate ? formatDateForFilename(startDate) : undefined,
      endDate: endDate ? formatDateForFilename(endDate) : undefined
    },
    fetchPolicy: 'no-cache'
  })

  const exportData = data.exportEventData
  const zip = new JSZip()

  // Add metadata.json
  const metadata = {
    event: {
      id: exportData.event.id,
      name: exportData.event.name,
      organizationName: exportData.event.organization_name,
      expirationDate: exportData.event.expiration_date
    },
    exportDate: new Date().toISOString(),
    dateRange: {
      start: startDate ? startDate.toISOString() : 'all',
      end: endDate ? endDate.toISOString() : 'all'
    },
    teamCount: exportData.teams.length,
    totalLocations: exportData.teams.reduce((sum, team) => sum + (team.locations ? team.locations.length : 0), 0)
  }
  zip.file('metadata.json', JSON.stringify(metadata, null, 2))

  // Add event image if available
  if (exportData.event.image_data && exportData.event.image_mime_type) {
    const parsed = parseDataUri(exportData.event.image_data)
    if (parsed) {
      const imageBytes = base64ToBytes(parsed.base64Data)
      const extension = exportData.event.image_mime_type.split('/')[1] || 'jpg'
      zip.file(`event-image.${extension}`, imageBytes, { binary: true })
    }
  }

  // Add event logo if available
  if (exportData.event.logo_data && exportData.event.logo_mime_type) {
    const parsed = parseDataUri(exportData.event.logo_data)
    if (parsed) {
      const logoBytes = base64ToBytes(parsed.base64Data)
      const extension = exportData.event.logo_mime_type.split('/')[1] || 'png'
      zip.file(`event-logo.${extension}`, logoBytes, { binary: true })
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

  // Create a folder for each team with locations
  const teamsFolder = zip.folder('teams')
  for (const team of exportData.teams) {
    if (team.locations && team.locations.length > 0) {
      const teamFolder = teamsFolder.folder(team.name.replace(/[^a-z0-9]/gi, '_'))
      
      // Add GeoJSON file
      const geojson = locationsToGeoJSON(team.locations, team.name)
      teamFolder.file('locations.geojson', JSON.stringify(geojson, null, 2))
      
      // Add CSV file for spreadsheet compatibility
      const csvHeader = 'latitude,longitude,timestamp,accuracy\n'
      const csvRows = team.locations.map(loc => 
        `${loc.latitude},${loc.longitude},${loc.timestamp},${loc.accuracy}`
      ).join('\n')
      teamFolder.file('locations.csv', csvHeader + csvRows)
    }
  }

  // Generate ZIP file
  return await zip.generateAsync({ type: 'blob' })
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
