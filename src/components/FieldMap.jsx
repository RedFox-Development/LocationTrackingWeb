/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react'
import { createWaypointIcon } from '../utils/waypointIcons'
import { createTeamIcon, getTeamTrailStyle } from '../utils/teamIcons'
import { isPointInPolygon } from '../utils/geofence'

/**
 * FieldMap - Interactive map showing team locations and geofence boundaries
 * Displays team positions with geofence overlays and waypoint markers
 */
function FieldMap({ event, teams = [], waypoints = [], geofences = [], selectedTeam, onTeamSelect }) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapCenter, setMapCenter] = useState({ lat: 40, lng: -100 })
  const [mapZoom, setMapZoom] = useState(4)
  const [teamPositions, setTeamPositions] = useState({})

  console.log('[FieldMap] Received props - teams:', teams.length, 'geofences:', geofences?.length, 'waypoints:', waypoints?.length)
  console.log('[FieldMap] Geofences data:', geofences)

  // Initialize map with Leaflet
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L && mapContainerRef.current && !mapRef.current) {
      mapRef.current = window.L.map(mapContainerRef.current).setView(
        [mapCenter.lat, mapCenter.lng],
        mapZoom
      )
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current)
    }
  }, [mapCenter.lat, mapCenter.lng, mapZoom])

  // Center map on geofences if available
  useEffect(() => {
    if (!mapRef.current || !geofences || geofences.length === 0) return

    // Normalize geofences to array of polygons
    let polygons = []
    if (Array.isArray(geofences)) {
      // Check if this is a single polygon or array of polygons
      if (geofences.length > 0) {
        if (Array.isArray(geofences[0]) && typeof geofences[0][0] === 'number') {
          // Single polygon: [[lat1, lon1], [lat2, lon2], ...]
          polygons = [geofences]
        } else if (Array.isArray(geofences[0]) && Array.isArray(geofences[0][0])) {
          // Multiple polygons: [[[lat1, lon1], [lat2, lon2], ...], [[lat3, lon3], ...]]
          polygons = geofences
        }
      }
    }

    if (polygons.length === 0) return

    // Calculate bounding box for all geofence polygons
    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity
    let hasValidGeofence = false

    polygons.forEach((polygon) => {
      if (Array.isArray(polygon)) {
        polygon.forEach(point => {
          if (Array.isArray(point) && point.length >= 2) {
            hasValidGeofence = true
            const [lat, lon] = point
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
            minLon = Math.min(minLon, lon)
            maxLon = Math.max(maxLon, lon)
          }
        })
      }
    })

    // If we have valid geofences, fit map to bounds
    if (hasValidGeofence && window.L) {
      const bounds = window.L.latLngBounds(
        [minLat, minLon],
        [maxLat, maxLon]
      )
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [geofences])

  // Reset map view to show all geofences and team positions
  const resetMapView = () => {
    if (!mapRef.current || !window.L) return

    // Normalize geofences to array of polygons
    let polygons = []
    if (Array.isArray(geofences) && geofences.length > 0) {
      if (Array.isArray(geofences[0]) && typeof geofences[0][0] === 'number') {
        polygons = [geofences]
      } else if (Array.isArray(geofences[0]) && Array.isArray(geofences[0][0])) {
        polygons = geofences
      }
    }

    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity
    let hasValidData = false

    // Get bounds from geofences
    polygons.forEach((polygon) => {
      if (Array.isArray(polygon)) {
        polygon.forEach(point => {
          if (Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number') {
            hasValidData = true
            const [lat, lon] = point
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
            minLon = Math.min(minLon, lon)
            maxLon = Math.max(maxLon, lon)
          }
        })
      }
    })

    // Get bounds from team positions
    Object.values(teamPositions).forEach(positions => {
      if (positions.length > 0) {
        const latest = positions[0]
        if (latest.lat && latest.lon) {
          hasValidData = true
          minLat = Math.min(minLat, latest.lat)
          maxLat = Math.max(maxLat, latest.lat)
          minLon = Math.min(minLon, latest.lon)
          maxLon = Math.max(maxLon, latest.lon)
        }
      }
    })

    // Fit map to bounds if we have valid data
    if (hasValidData) {
      const latRange = maxLat - minLat
      const lonRange = maxLon - minLon
      const latPadding = Math.max(latRange * 0.1, 0.001)
      const lonPadding = Math.max(lonRange * 0.1, 0.001)

      const bounds = window.L.latLngBounds(
        [minLat - latPadding, minLon - lonPadding],
        [maxLat + latPadding, maxLon + lonPadding]
      )
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  // Use team updates from props instead of fetching separately
  useEffect(() => {
    if (!teams || teams.length === 0) {
      console.log('[FieldMap] No teams available')
      return
    }

    // Group positions by team ID from the updates already provided
    const positions = {}
    teams.forEach(team => {
      if (team.updates && Array.isArray(team.updates) && team.updates.length > 0) {
        positions[team.id] = [...team.updates].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        console.log(`[FieldMap] Team ${team.name}: ${positions[team.id].length} position updates`)
      } else {
        positions[team.id] = []
        console.warn(`[FieldMap] Team ${team.name} has no updates data`)
      }
    })
    
    console.log('[FieldMap] Updated teamPositions:', Object.keys(positions).length, 'teams')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamPositions(positions)
  }, [teams])

  // Update map markers
  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing markers, polylines, and circles
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof window.L.Marker ||
          layer instanceof window.L.Polyline ||
          layer instanceof window.L.Circle ||
          layer instanceof window.L.CircleMarker) {
        mapRef.current.removeLayer(layer)
      }
    })

    // Add geofence polygons
    if (geofences && Array.isArray(geofences) && geofences.length > 0) {
      // Normalize geofences to array of polygons
      let polygons = []
      if (Array.isArray(geofences[0]) && typeof geofences[0][0] === 'number') {
        // Single polygon: [[lat1, lon1], [lat2, lon2], ...]
        polygons = [geofences]
      } else if (Array.isArray(geofences[0]) && Array.isArray(geofences[0][0])) {
        // Multiple polygons: [[[lat1, lon1], [lat2, lon2], ...], [[lat3, lon3], ...]]
        polygons = geofences
      }
      
      console.log('[FieldMap] Rendering', polygons.length, 'geofence polygon(s)')
      
      polygons.forEach((polygon, idx) => {
        const points = polygon.filter(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
        if (points.length >= 3) {
          console.log(`[FieldMap] Rendering polygon ${idx} with ${points.length} points`)
          window.L.polyline(points, {
            color: '#995511',
            weight: 2,
            opacity: 0.7,
            fill: true,
            fillColor: '#995511',
            fillOpacity: 0.1,
            interactive: true,
          })
            .bindPopup(`Geofence ${idx + 1}`)
            .addTo(mapRef.current)
        } else {
          console.warn(`[FieldMap] Polygon ${idx} has only ${points.length} valid points (need 3+)`)
        }
      })
    } else {
      if (geofences && Array.isArray(geofences) && geofences.length === 0) {
        console.log('[FieldMap] No geofences to render (empty array)')
      } else {
        console.warn('[FieldMap] Geofences not available or not an array:', geofences)
      }
    }

    // Add waypoint markers
    if (waypoints && Array.isArray(waypoints)) {
      waypoints.forEach((wp) => {
        if (wp.lat && wp.lon) {
          const icon = createWaypointIcon(wp.type, wp.is_required, false)
          let popupText = `<strong>${wp.name}</strong><br/>Type: <span style="text-transform: capitalize;">${wp.type}</span>`
          if (wp.pointValue > 0) {
            popupText += `<br/>Points: ${wp.pointValue}`
          }
          if (wp.is_required) {
            popupText += '<br/><span style="color: #dc2626; font-weight: bold;">Required</span>'
          }
          
          window.L.marker([wp.lat, wp.lon], { icon })
            .bindPopup(popupText)
            .addTo(mapRef.current)
        }
      })
    }

    // Add team position markers
    teams.forEach((team) => {
      const positions = teamPositions[team.id] || []
      if (positions.length > 0) {
        const latest = positions[0]
        const color = team.color || '#3B82F6'
        const isSelected = selectedTeam?.id === team.id

        // Check if team is inside geofence
        let isOutsideGeofence = false
        if (geofences && Array.isArray(geofences)) {
          let polygons = []
          if (geofences.length > 0) {
            if (Array.isArray(geofences[0]) && typeof geofences[0][0] === 'number') {
              polygons = [geofences]
            } else if (Array.isArray(geofences[0]) && Array.isArray(geofences[0][0])) {
              polygons = geofences
            }
          }

          // Team is outside if there's a geofence and the position is not in any of them
          if (polygons.length > 0) {
            isOutsideGeofence = !polygons.some(polygon => 
              isPointInPolygon(latest.lat, latest.lon, polygon)
            )
          }
        }

        // Create custom team icon with dynamic coloring
        const icon = createTeamIcon(team.name, color, isSelected, isOutsideGeofence, latest.timestamp)

        // Add team marker
        window.L.marker([latest.lat, latest.lon], { icon })
          .bindPopup(`<strong>${team.name}</strong><br/>Latest: ${new Date(latest.timestamp).toLocaleTimeString()}`)
          .on('click', () => onTeamSelect(team))
          .addTo(mapRef.current)

        // Draw trail (last 10 points) with team color
        const trail = positions.slice(0, 10).reverse().map(p => [p.lat, p.lon])
        if (trail.length > 1) {
          const trailStyle = getTeamTrailStyle(color)
          window.L.polyline(trail, trailStyle).addTo(mapRef.current)
        }
      }
    })
  }, [teams, teamPositions, geofences, waypoints, selectedTeam?.id, onTeamSelect])

  return (
    <div className="field-map" ref={mapContainerRef}>
      {Object.keys(teamPositions).length === 0 && (
        <div className="map-loading">
          <p>Loading team locations...</p>
        </div>
      )}
      <button
        onClick={resetMapView}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 500,
          padding: '0.5rem 1rem',
          backgroundColor: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
        }}
        title="Reset map view to show all geofences and team positions"
      >
        Reset
      </button>
    </div>
  )
}

export default FieldMap
