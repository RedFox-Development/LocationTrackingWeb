import { useEffect, useRef, useState } from 'react'

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
  console.log('[FieldMap] Geofences details:', geofences?.map(g => ({ lat: g.lat, lon: g.lon, radius: g.radius, name: g.name })))

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
  }, [])

  // Center map on geofences if available
  useEffect(() => {
    if (!mapRef.current || !geofences || geofences.length === 0) return

    // Calculate bounding box for all geofences
    let minLat = Infinity, maxLat = -Infinity
    let minLon = Infinity, maxLon = -Infinity
    let hasValidGeofence = false

    geofences.forEach((fence) => {
      if (fence.lat && fence.lon && fence.radius) {
        hasValidGeofence = true
        // Earth's radius in meters
        const earthRadius = 6371000
        // Radius in degrees
        const radiusInDegrees = (fence.radius / earthRadius) * (180 / Math.PI)

        minLat = Math.min(minLat, fence.lat - radiusInDegrees)
        maxLat = Math.max(maxLat, fence.lat + radiusInDegrees)
        minLon = Math.min(minLon, fence.lon - radiusInDegrees)
        maxLon = Math.max(maxLon, fence.lon + radiusInDegrees)
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

  // Use team updates from props instead of fetching separately
  useEffect(() => {
    if (!teams || teams.length === 0) {
      console.log('[FieldMap] No teams available')
      return
    }

    // Group positions by team ID from the updates already provided
    const positions = {}
    teams.forEach(team => {
      if (team.updates && Array.isArray(team.updates)) {
        positions[team.id] = team.updates.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        console.log(`[FieldMap] Team ${team.name}: ${positions[team.id].length} position updates`)
      } else {
        positions[team.id] = []
        console.warn(`[FieldMap] Team ${team.name} has no updates data`)
      }
    })
    
    console.log('[FieldMap] Updated teamPositions:', Object.keys(positions).length, 'teams')
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

    // Add team position markers
    teams.forEach((team) => {
      const positions = teamPositions[team.id] || []
      if (positions.length > 0) {
        const latest = positions[0]
        const color = team.color || '#3B82F6'

        // Add circle marker for current position
        window.L.circleMarker([latest.lat, latest.lon], {
          radius: 8,
          fillColor: color,
          color: selectedTeam?.id === team.id ? '#000' : 'white',
          weight: selectedTeam?.id === team.id ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.7,
        })
          .bindPopup(`${team.name}<br/>Latest: ${new Date(latest.timestamp).toLocaleTimeString()}`)
          .on('click', () => onTeamSelect(team))
          .addTo(mapRef.current)

        // Draw trail (last 10 points)
        const trail = positions.slice(0, 10).reverse().map(p => [p.lat, p.lon])
        if (trail.length > 1) {
          window.L.polyline(trail, {
            color: color,
            weight: 2,
            opacity: 0.5,
            dashArray: '5, 5',
          }).addTo(mapRef.current)
        }
      }
    })

    // Add geofence circles
    if (geofences && Array.isArray(geofences)) {
      console.log('[FieldMap] Rendering', geofences.length, 'geofences')
      geofences.forEach((fence, idx) => {
        if (fence.lat && fence.lon && fence.radius) {
          console.log(`[FieldMap] Rendering geofence ${idx}:`, { lat: fence.lat, lon: fence.lon, radius: fence.radius })
          window.L.circle([fence.lat, fence.lon], {
            radius: fence.radius,
            color: '#EF4444',
            weight: 2,
            opacity: 0.5,
            fillOpacity: 0.1,
            interactive: false,
          }).addTo(mapRef.current)
        } else {
          console.warn(`[FieldMap] Geofence ${idx} missing required fields:`, fence)
        }
      })
    } else {
      console.warn('[FieldMap] Geofences not available or not an array:', geofences)
    }

    // Add waypoint markers
    if (waypoints && Array.isArray(waypoints)) {
      waypoints.forEach((wp) => {
        if (wp.lat && wp.lon) {
          window.L.circleMarker([wp.lat, wp.lon], {
            radius: 5,
            fillColor: '#FFB800',
            color: '#8B7000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          })
            .bindPopup(`${wp.name}${wp.is_required ? ' (Required)' : ''}`)
            .addTo(mapRef.current)
        }
      })
    }
  }, [teams, teamPositions, geofences, waypoints, selectedTeam?.id, onTeamSelect])

  return (
    <div className="field-map" ref={mapContainerRef}>
      {Object.keys(teamPositions).length === 0 && (
        <div className="map-loading">
          <p>Loading team locations...</p>
        </div>
      )}
    </div>
  )
}

export default FieldMap
