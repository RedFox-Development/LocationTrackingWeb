import { useState, useEffect, useRef } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon } from 'react-leaflet'
import L from 'leaflet'
import { GET_UPDATES } from '../../api/graphql/team'
import { getGeofence, isPointInPolygon, getPolygonBounds, getPointsBounds, combineBounds } from '../../utils/geofence'
import 'leaflet/dist/leaflet.css'
import { EventHeader } from '../../components/EventHeader'

// Custom icon colors for team markers
const createTeamIcon = (color, isHistoryDot = false) => {
  if (isHistoryDot) {
    // Small dot for history locations (1/3 size)
    return L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11">
          <circle cx="12" cy="12" r="5" fill="${color}" opacity="0.7"/>
        </svg>
      `)}`,
      iconSize: [11, 11],
      iconAnchor: [5.5, 5.5],
      popupAnchor: [0, -5.5],
    })
  }
  
  // Full-size marker for latest location
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="11" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="white"/>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

const normalizeTimestamp = (value) => {
  if (!value) return value
  let normalized = value
  normalized = normalized.replace(/\.(\d{3})\d+Z$/, '.$1Z')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized = `${normalized}Z`
  }
  return normalized
}

const formatTimestamp = (value) => {
  if (!value) return 'Unknown'
  const parsed = new Date(normalizeTimestamp(value))
  if (Number.isNaN(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleTimeString()
}

const formatDateTime = (value) => {
  if (!value) return 'Unknown'
  const parsed = new Date(normalizeTimestamp(value))
  if (Number.isNaN(parsed.getTime())) return 'Unknown'
  return parsed.toLocaleString()
}

function MapView({ event, teams }) {
  const [teamLocations, setTeamLocations] = useState({})
  const [selectedTeams, setSelectedTeams] = useState([])
  const [showHistory, setShowHistory] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [mapCenter, setMapCenter] = useState([20, 0])
  const [mapZoom, setMapZoom] = useState(5)
  const [geofence, setGeofence] = useState(null)
  const [geofenceBreaches, setGeofenceBreaches] = useState({})
  const mapRef = useRef(null)
  const intervalRef = useRef(null)

  // Apollo lazy queries for team locations
  const [getUpdates] = useLazyQuery(GET_UPDATES)

  const fetchLocationData = async () => {
    if (!event || !teams || teams.length === 0) return

    try {
      const locationsPromises = teams.map(async (team) => {
        try {
          const { data } = await getUpdates({
            variables: {
              team: team.name,
              limit: 5000
            }
          })
          
          return {
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color || '#3b82f6',
            updates: data.updates || []
          }
        } catch (error) {
          console.error(`Error fetching locations for team ${team.name}:`, error)
          return {
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color || '#3b82f6',
            updates: []
          }
        }
      })

      const results = await Promise.all(locationsPromises)
      
      const locations = {}
      const breaches = {}
      
      results.forEach(result => {
        if (result.updates && result.updates.length > 0) {
          locations[result.teamId] = {
            latest: result.updates[result.updates.length - 1],
            history: result.updates,
            teamName: result.teamName,
            teamColor: result.teamColor
          }

          // Check geofence breach
          if (geofence && geofence.length >= 3) {
            const latest = result.updates[result.updates.length - 1]
            const isInside = isPointInPolygon(latest.lat, latest.lon, geofence)
            
            if (!isInside) {
              breaches[result.teamId] = {
                teamName: result.teamName,
                lat: latest.lat,
                lon: latest.lon,
                timestamp: latest.timestamp
              }
              console.warn(`[Geofence] Team "${result.teamName}" is OUTSIDE geofence at [${latest.lat}, ${latest.lon}]`)
            }
          }
        }
      })
      
      setTeamLocations(locations)
      setGeofenceBreaches(breaches)
      
      // Calculate map bounds to fit both geofence and team locations
      const boundsArray = []
      
      if (geofence && geofence.length > 0) {
        boundsArray.push(getPolygonBounds(geofence))
      }
      
      const allLatLons = Object.values(locations).map(loc => ({ 
        lat: loc.latest.lat, 
        lon: loc.latest.lon 
      }))
      
      if (allLatLons.length > 0) {
        boundsArray.push(getPointsBounds(allLatLons))
      }
      
      // Set map bounds to show all relevant data
      if (boundsArray.length > 0) {
        const combinedBounds = combineBounds(boundsArray)
        
        // Add padding (10% of range)
        const latRange = combinedBounds.maxLat - combinedBounds.minLat
        const lonRange = combinedBounds.maxLon - combinedBounds.minLon
        const latPadding = latRange * 0.1
        const lonPadding = lonRange * 0.1
        
        const paddedBounds = [
          [combinedBounds.minLat - latPadding, combinedBounds.minLon - lonPadding],
          [combinedBounds.maxLat + latPadding, combinedBounds.maxLon + lonPadding]
        ]
        
        setMapCenter([
          (combinedBounds.minLat + combinedBounds.maxLat) / 2,
          (combinedBounds.minLon + combinedBounds.maxLon) / 2
        ])
        
        // Fit bounds with animation
        if (mapRef.current) {
          setTimeout(() => {
            mapRef.current.fitBounds(paddedBounds, { padding: [50, 50] })
          }, 100)
        }
      }
    } catch (error) {
      console.error('Error fetching location data:', error)
    }
  }

  useEffect(() => {
    if (!event || !teams) return

    setSelectedTeams(teams.map(t => t.id))
    
    // Load geofence from event object (API) first, then fall back to localStorage
    let loadedGeofence = null
    if (event?.geofence_data) {
      try {
        loadedGeofence = JSON.parse(event.geofence_data)
      } catch (e) {
        console.warn('Failed to parse geofence_data from event:', e)
        loadedGeofence = getGeofence(event.id)
      }
    } else {
      loadedGeofence = getGeofence(event.id)
    }
    setGeofence(loadedGeofence)
    
    fetchLocationData()

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLocationData, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, autoRefresh, refreshInterval])

  const toggleTeamVisibility = (teamId) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    )
  }

  const renderMap = () => {
    return (
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Render geofence polygon */}
        {geofence && geofence.length >= 3 && (
          <Polygon
            positions={geofence}
            color="#2196f3"
            weight={3}
            opacity={0.6}
            fillColor="#2196f3"
            fillOpacity={0.1}
          >
            <Popup>
              <div className="geofence-popup">
                <strong>Event Geofence</strong>
                <p>{geofence.length} points</p>
              </div>
            </Popup>
          </Polygon>
        )}
        
        {/* Render team locations and history trails */}
        {Object.entries(teamLocations).map(([teamId, locationData]) => {
          if (!selectedTeams.includes(parseInt(teamId))) return null
          
          const { latest, history, teamName, teamColor } = locationData
          const hasBreached = geofenceBreaches[teamId]
          
          return (
            <div key={teamId}>
              {/* History trail polyline */}
              {showHistory && history && history.length > 1 && (
                <Polyline
                  positions={history.map(loc => [loc.lat, loc.lon])}
                  color={hasBreached ? '#ff6b6b' : teamColor}
                  weight={2}
                  opacity={0.5}
                  dashArray="5, 5"
                />
              )}
              
              {/* History location dots (past positions) */}
              {showHistory && history && history.length > 1 && (
                history.slice(0, -1).map((loc, idx) => (
                  <Marker
                    key={`history-${teamId}-${idx}`}
                    position={[loc.lat, loc.lon]}
                    icon={createTeamIcon(teamColor, true)}
                  />
                ))
              )}
              
              {/* Latest position marker */}
              {latest && (
                <Marker
                  position={[latest.lat, latest.lon]}
                  icon={createTeamIcon(hasBreached ? '#ff6b6b' : teamColor)}
                >
                  <Popup>
                    <div className="marker-popup">
                      <strong>{teamName}</strong>
                      {hasBreached && (
                        <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>
                          ⚠️ OUTSIDE GEOFENCE
                        </p>
                      )}
                      <p>
                        <strong>Location:</strong> {latest.lat.toFixed(4)}, {latest.lon.toFixed(4)}
                      </p>
                      <p>
                        <strong>Last Updated:</strong> {formatDateTime(latest.timestamp)}
                      </p>
                      <p>
                        <strong>Positions Recorded:</strong> {history.length}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          )
        })}
      </MapContainer>
    )
  }

  if (!event) {
    return <div className="map-view">No event selected</div>
  }

  // Count active teams with locations
  const teamsWithLocations = Object.keys(teamLocations).length
  const visibleTeams = selectedTeams.filter(id => teamLocations[id])

  return (
    <div className="map-view">
      <EventHeader event={event} />

      {/* Geofence Breach Alerts */}
      {Object.keys(geofenceBreaches).length > 0 && geofence && (
        <div className="geofence-alerts" style={{
          backgroundColor: '#fff3cd',
          borderLeft: '4px solid #ff6b6b',
          padding: '1rem',
          margin: '1rem',
          borderRadius: '0.25rem'
        }}>
          <strong>⚠️ Geofence Breaches Detected:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
            {Object.values(geofenceBreaches).map((breach, idx) => (
              <li key={idx}>
                <strong>{breach.teamName}</strong> at [{breach.lat.toFixed(4)}, {breach.lon.toFixed(4)}] 
                <br />
                <small>Last seen: {formatDateTime(breach.timestamp)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="map-controls">
        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={1000}>1 second</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          )}
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            Show history trail
          </label>
        </div>

        <div className="control-group">
          {geofence && geofence.length >= 3 ? (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong>📍 Geofence:</strong> Active ({geofence.length} points)
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
              <strong>📍 Geofence:</strong> Not set
            </div>
          )}
        </div>

        <button onClick={fetchLocationData} className="btn-primary">
          Refresh Now
        </button>
      </div>

      <div className="map-layout">
        <div className="teams-sidebar">
          <h3>Teams ({visibleTeams.length}/{teamsWithLocations})</h3>
          <div className="team-filters">
            {teams && teams.length > 0 ? (
              teams.map(team => {
                const isVisible = selectedTeams.includes(team.id)
                const location = teamLocations[team.id]
                
                return (
                  <div key={team.id} className={`team-filter ${isVisible ? 'active' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleTeamVisibility(team.id)}
                      />
                      <span className="team-color" style={{ backgroundColor: team.color || '#3b82f6' }}></span>
                      <span className="team-name">{team.name}</span>
                    </label>
                    {location && location.latest && (
                      <div className="team-status">
                        <small>
                          Last seen: {formatTimestamp(location.latest.timestamp)}
                        </small>
                        <small>
                          Positions: {location.history?.length || 0}
                        </small>
                      </div>
                    )}
                    {!location && (
                      <div className="team-status">
                        <small className="no-data">No location data yet</small>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="empty-state">No teams available</p>
            )}
          </div>
        </div>

        <div className="map-container">
          {renderMap()}
        </div>
      </div>
    </div>
  )
}

export default MapView
