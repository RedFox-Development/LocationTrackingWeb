import { Fragment, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { GET_UPDATES } from '../../api/graphql/team'
import { GET_WAYPOINTS, GET_WAYPOINT_VISITS } from '../../api/graphql/waypoints'
import { getGeofence, isPointInPolygon, getPolygonBounds, getPointsBounds } from '../../utils/geofence'
import { hasManageAccess } from '../../utils/eventAccess'
import { createWaypointIcon } from '../../utils/waypointIcons'
import 'leaflet/dist/leaflet.css'
import { EventHeader } from '../../components/EventHeader'

const createTeamIcon = (color, isHistoryDot = false) => {
  if (isHistoryDot) {
    return L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11">
          <circle cx="12" cy="12" r="5" fill="${color}" opacity="0.75"/>
        </svg>
      `)}`,
      iconSize: [11, 11],
      iconAnchor: [5.5, 5.5],
      popupAnchor: [0, -5.5],
    })
  }

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="11" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="white"/>
      </svg>
    `)}`,
    iconSize: [24, 24],
    iconAnchor: [16, 24],
    popupAnchor: [0, -24],
  })
}

const normalizeTimestamp = (value) => {
  if (!value) return value
  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return new Date(Number(value)).toISOString()
  }
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

// Haversine distance in metres between two lat/lon points
const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Remove anomalous points from a chronologically-sorted location array using a
// sliding-window median filter. Each point is compared against the spatial
// median of its temporal neighbours; any point farther than maxDistMeters from
// that median is considered a jitter artefact and discarded.
// windowSize should be odd; maxDistMeters is the rejection threshold.
const applyMedianFilter = (sortedUpdates, windowSize = 7, maxDistMeters = 300) => {
  if (sortedUpdates.length < 3) return sortedUpdates
  const half = Math.floor(windowSize / 2)
  const filtered = []
  for (let i = 0; i < sortedUpdates.length; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(sortedUpdates.length - 1, i + half)
    const window = sortedUpdates.slice(lo, hi + 1)
    const sortedLats = window.map((p) => p.lat).sort((a, b) => a - b)
    const sortedLons = window.map((p) => p.lon).sort((a, b) => a - b)
    const mid = Math.floor(sortedLats.length / 2)
    const medLat = sortedLats[mid]
    const medLon = sortedLons[mid]
    if (haversineMeters(sortedUpdates[i].lat, sortedUpdates[i].lon, medLat, medLon) <= maxDistMeters) {
      filtered.push(sortedUpdates[i])
    }
  }
  return filtered.length > 0 ? filtered : sortedUpdates
}

const MAX_HISTORY_DOTS = 12800

function MapView({ event, teams }) {
  const apolloClient = useApolloClient()
  const [selectedTeams, setSelectedTeams] = useState([])
  const [showHistory, setShowHistory] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [mapCenter, setMapCenter] = useState([20, 0])
  const [mapZoom] = useState(5)
  const [geofence, setGeofence] = useState(null)
  const [showWaypointScoring, setShowWaypointScoring] = useState(true)
  const [waypointVisits, setWaypointVisits] = useState([])
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [_locationRenderVersion, setLocationRenderVersion] = useState(0)

  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const intervalRef = useRef(null)
  const geofenceRef = useRef(null)
  const teamLocationsRef = useRef({})
  const geofenceBreachesRef = useRef({})
  const teamFetchTimestampsRef = useRef({})
  const isFetchingRef = useRef(false)

  const teamLocations = teamLocationsRef.current
  const geofenceBreaches = geofenceBreachesRef.current
  const canManageEvent = hasManageAccess(event)

  const {
    data: waypointData,
    refetch: refetchWaypoints,
  } = useQuery(GET_WAYPOINTS, {
    variables: { eventId: event.id },
    fetchPolicy: 'network-only',
    pollInterval: 30000,
    skip: !event?.id,
  })

  const waypoints = useMemo(() => waypointData?.waypoints || [], [waypointData])

  const waypointVisitMapByTeam = useMemo(() => {
    const map = {}
    waypointVisits.forEach((visit) => {
      if (!map[visit.team_id]) {
        map[visit.team_id] = {}
      }
      map[visit.team_id][visit.waypoint_id] = visit.visited_at
    })
    return map
  }, [waypointVisits])

  const waypointVisitCounts = useMemo(() => {
    const counts = {}
    waypointVisits.forEach((visit) => {
      counts[visit.waypoint_id] = (counts[visit.waypoint_id] || 0) + 1
    })
    return counts
  }, [waypointVisits])

  const requiredWaypointIds = useMemo(
    () => waypoints.filter((waypoint) => waypoint.is_required).map((waypoint) => waypoint.id),
    [waypoints]
  )

  const teamScoreRows = useMemo(() => {
    if (!teams?.length) return []

    return teams
      .map((team) => {
        const visitMap = waypointVisitMapByTeam[team.id] || {}
        const requiredVisited = requiredWaypointIds.reduce(
          (count, waypointId) => count + (visitMap[waypointId] ? 1 : 0),
          0
        )
        const totalVisited = waypoints.reduce(
          (count, waypoint) => count + (visitMap[waypoint.id] ? 1 : 0),
          0
        )

        return {
          team,
          visitMap,
          requiredVisited,
          requiredTotal: requiredWaypointIds.length,
          totalVisited,
          totalWaypoints: waypoints.length,
        }
      })
      .sort((a, b) => b.requiredVisited - a.requiredVisited)
  }, [teams, waypointVisitMapByTeam, requiredWaypointIds, waypoints])

  const historyDots = useMemo(() => {
    if (!showHistory) return []

    const points = []

    Object.entries(teamLocations).forEach(([teamId, locationData]) => {
      if (!selectedTeams.includes(parseInt(teamId, 10))) return

      const { history, teamColor } = locationData
      if (!history || history.length <= 1) return

      history.slice(0, -1).forEach((loc, index) => {
        points.push({
          key: `history-${teamId}-${index}`,
          lat: loc.lat,
          lon: loc.lon,
          color: teamColor,
        })
      })
    })

    if (points.length <= MAX_HISTORY_DOTS) {
      return points
    }

    const stride = Math.ceil(points.length / MAX_HISTORY_DOTS)
    return points.filter((_, index) => index % stride === 0)
  }, [showHistory, teamLocations, selectedTeams])

  const resetMapView = () => {
    const activeGeofence = geofenceRef.current
    const hasGeofence = activeGeofence && activeGeofence.length >= 3
    const allLatLons = Object.values(teamLocationsRef.current).map((loc) => ({
      lat: loc.latest.lat,
      lon: loc.latest.lon,
    }))

    let activeBounds = null
    if (hasGeofence) {
      activeBounds = getPolygonBounds(activeGeofence)
    } else if (allLatLons.length > 0) {
      activeBounds = getPointsBounds(allLatLons)
    }

    if (activeBounds && mapRef.current) {
      const latRange = activeBounds.maxLat - activeBounds.minLat
      const lonRange = activeBounds.maxLon - activeBounds.minLon
      const latPadding = Math.max(latRange * 0.1, 0.001)
      const lonPadding = Math.max(lonRange * 0.1, 0.001)

      const paddedBounds = [
        [activeBounds.minLat - latPadding, activeBounds.minLon - lonPadding],
        [activeBounds.maxLat + latPadding, activeBounds.maxLon + lonPadding],
      ]

      const targetCenter = [
        (activeBounds.minLat + activeBounds.maxLat) / 2,
        (activeBounds.minLon + activeBounds.maxLon) / 2,
      ]

      setMapCenter(targetCenter)

      const leafletBounds = L.latLngBounds(paddedBounds)
      const targetZoom = mapRef.current.getBoundsZoom(leafletBounds, false, [50, 50])
      mapRef.current.setView(targetCenter, targetZoom)
    }
  }

  const fetchWaypointVisits = async () => {
    if (!event?.id) return

    try {
      const { data } = await apolloClient.query({
        query: GET_WAYPOINT_VISITS,
        variables: { eventId: event.id },
        fetchPolicy: 'network-only',
      })
      setWaypointVisits(data?.waypointVisits || [])
    } catch (error) {
      console.error('Error fetching waypoint visits:', error)
    }
  }

  const fetchLocationData = async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[MapView] Fetch already in progress, skipping this interval')
      return
    }

    if (!event || !teams || teams.length === 0) {
      console.log('[MapView] fetchLocationData skipped:', { event: !!event, teams: !!teams, teamsLength: teams?.length })
      return
    }

    isFetchingRef.current = true
    const activeGeofence = geofenceRef.current
    const now = Date.now()
    console.log('[MapView] fetchLocationData started at', new Date(now).toISOString())

    // Calculate limit based on update frequency with safe fallback
    const updateFrequencyMs = event?.update_frequency || 10000 // Default 10 seconds if not set
    const calculatedLimit = Math.round(3600 / (updateFrequencyMs / 1000) * 1.5)
    console.log('[MapView] Using update frequency:', updateFrequencyMs, 'ms, calculated limit:', calculatedLimit)

    try {
      const locationsPromises = teams.map(async (team) => {
        try {
          const { data } = await apolloClient.query({
            query: GET_UPDATES,
            variables: {
              event: event.name,
              team: team.name,
              limit: calculatedLimit,
            },
            fetchPolicy: 'network-only',
          })

          return {
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color || '#3b82f6',
            updates: data.updates || [],
          }
        } catch (error) {
          console.error(`Error fetching locations for team ${team.name}:`, error)
          return {
            teamId: team.id,
            teamName: team.name,
            teamColor: team.color || '#3b82f6',
            updates: [],
          }
        }
      })

      const results = await Promise.all(locationsPromises)
      console.log('[MapView] Got results for', results.length, 'teams')

      // Start with existing cached data - this preserves teams that didn't get fresh data this fetch
      const locations = { ...teamLocationsRef.current }
      const breaches = { ...geofenceBreachesRef.current }
      let hasLocationsChanged = false
      let hasBreachesChanged = false

      results.forEach((result) => {
        teamFetchTimestampsRef.current[result.teamId] = now
        console.log(`[MapView] Team ${result.teamName} has ${result.updates?.length || 0} location updates`)
        if (result.updates && result.updates.length > 0) {
          const sortedUpdates = [...result.updates].sort((a, b) => {
            const timeA = new Date(normalizeTimestamp(a.timestamp)).getTime()
            const timeB = new Date(normalizeTimestamp(b.timestamp)).getTime()
            return timeA - timeB
          })
          const filteredUpdates = applyMedianFilter(sortedUpdates)
          const latestUpdate = filteredUpdates[filteredUpdates.length - 1]

          const newLocationData = {
            latest: latestUpdate,
            history: filteredUpdates,
            teamName: result.teamName,
            teamColor: result.teamColor,
          }

          // Check if this team's data actually changed
          const prevEntry = locations[result.teamId]
          const prevLatest = prevEntry?.latest
          if (
            !prevEntry ||
            !prevLatest ||
            prevEntry.teamName !== result.teamName ||
            prevEntry.teamColor !== result.teamColor ||
            prevEntry.history?.length !== filteredUpdates.length ||
            prevLatest.lat !== latestUpdate.lat ||
            prevLatest.lon !== latestUpdate.lon ||
            normalizeTimestamp(prevLatest.timestamp) !== normalizeTimestamp(latestUpdate.timestamp)
          ) {
            locations[result.teamId] = newLocationData
            hasLocationsChanged = true
          }

          if (activeGeofence && activeGeofence.length >= 3) {
            const isInside = isPointInPolygon(latestUpdate.lat, latestUpdate.lon, activeGeofence)

            if (!isInside) {
              const newBreach = {
                teamName: result.teamName,
                lat: latestUpdate.lat,
                lon: latestUpdate.lon,
                timestamp: latestUpdate.timestamp,
              }
              const prevBreach = breaches[result.teamId]
              if (
                !prevBreach ||
                prevBreach.teamName !== result.teamName ||
                prevBreach.lat !== latestUpdate.lat ||
                prevBreach.lon !== latestUpdate.lon ||
                normalizeTimestamp(prevBreach.timestamp) !== normalizeTimestamp(latestUpdate.timestamp)
              ) {
                breaches[result.teamId] = newBreach
                hasBreachesChanged = true
              }
            } else if (breaches[result.teamId]) {
              // Team is now inside, remove the breach
              delete breaches[result.teamId]
              hasBreachesChanged = true
            }
          }
        }
      })

      // Update refs only if something actually changed
      if (hasLocationsChanged) {
        console.log('[MapView] Locations changed, updating ref')
        teamLocationsRef.current = locations
      }

      if (hasBreachesChanged) {
        console.log('[MapView] Breaches changed, updating ref')
        geofenceBreachesRef.current = breaches
      }

      if (hasLocationsChanged || hasBreachesChanged) {
        console.log('[MapView] Data changed, updating render version')
        setLocationRenderVersion((version) => version + 1)
      }

      if (canManageEvent) {
        await fetchWaypointVisits()
      } else if (waypointVisits.length > 0) {
        setWaypointVisits([])
      }
    } catch (error) {
      console.error('[MapView] Error in fetchLocationData:', error)
    } finally {
      isFetchingRef.current = false
      console.log('[MapView] fetchLocationData completed')
    }
  }

  useEffect(() => {
    if (!event || !teams) return

    setSelectedTeams(teams.map((team) => team.id))

    let loadedGeofence = null
    if (event?.geofence_data) {
      try {
        loadedGeofence = JSON.parse(event.geofence_data)
      } catch (error) {
        console.warn('Failed to parse geofence_data from event:', error)
        loadedGeofence = getGeofence(event.id)
      }
    } else {
      loadedGeofence = getGeofence(event.id)
    }

    setGeofence(loadedGeofence)
    geofenceRef.current = loadedGeofence

    fetchLocationData().then(() => {
      resetMapView()
    })

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLocationData, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, teams, autoRefresh, refreshInterval])

  const toggleTeamVisibility = (teamId) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    )
  }

  const refreshAll = async () => {
    await Promise.all([fetchLocationData(), refetchWaypoints()])
  }

  const toggleMapFullscreen = useCallback(async () => {
    const mapContainer = mapContainerRef.current
    if (!mapContainer) return

    try {
      if (document.fullscreenElement === mapContainer) {
        await document.exitFullscreen()
      } else {
        await mapContainer.requestFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen toggle failed:', error)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === mapContainerRef.current
      setIsMapFullscreen(isFullscreen)

      // Leaflet needs an explicit resize when container dimensions change.
      setTimeout(() => {
        mapRef.current?.invalidateSize?.()
      }, 0)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false
      const tag = target.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return Boolean(target.isContentEditable)
    }

    const handleKeydown = (event) => {
      if (event.defaultPrevented || event.repeat) return
      if (isEditableTarget(event.target)) return
      if (event.key?.toLowerCase() !== 'f') return

      event.preventDefault()
      toggleMapFullscreen()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [toggleMapFullscreen])

  const renderMap = () => {
    return (
      <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }} ref={mapRef} preferCanvas={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: 'white',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={resetMapView}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            Reset View
          </button>
        </div>

        {geofence && geofence.length >= 3 && (
          <Polygon positions={geofence} color="#2196f3" weight={3} opacity={0.6} fillColor="#2196f3" fillOpacity={0.1}>
            <Popup>
              <div className="geofence-popup">
                <strong>Event Geofence</strong>
                <p>{geofence.length} points</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {waypoints.map((waypoint) => {
          const visitedTeams = waypointVisitCounts[waypoint.id] || 0

          return (
            <Marker
              key={`waypoint-${waypoint.id}`}
              position={[waypoint.lat, waypoint.lon]}
              icon={createWaypointIcon(waypoint.type, waypoint.is_required, visibleTeams > 0)}
            >
              <Popup>
                <div>
                  <strong>{waypoint.name}</strong>
                  <p>Type: <span className='capitalize'>{waypoint.type}</span></p>
                  <p>{waypoint.is_required ? 'Required waypoint' : 'Optional waypoint'}</p>
                  {waypoint.pointValue > 0 && (
                    <p>Points: {waypoint.pointValue}</p>
                  )}
                  <p>
                    Visits: {visitedTeams}/{teams.length}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {Object.entries(teamLocations).map(([teamId, locationData]) => {
          if (!selectedTeams.includes(parseInt(teamId, 10))) return null

          const { latest, history, teamName, teamColor } = locationData
          const hasBreached = geofenceBreaches[teamId]

          return (
            <Fragment key={teamId}>
              {showHistory && history && history.length > 1 && (
                <Polyline
                  positions={history.map((loc) => [loc.lat, loc.lon])}
                  color={hasBreached ? '#ff6b6b' : teamColor}
                  weight={2}
                  opacity={0.5}
                  dashArray="5, 5"
                />
              )}

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
                          OUTSIDE GEOFENCE
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
            </Fragment>
          )
        })}

        {showHistory &&
          historyDots.map((dot) => (
            <CircleMarker
              key={dot.key}
              center={[dot.lat, dot.lon]}
              radius={3}
              pathOptions={{
                color: dot.color,
                fillColor: dot.color,
                fillOpacity: 0.65,
                opacity: 0.85,
                weight: 1,
              }}
            />
          ))}
      </MapContainer>
    )
  }

  if (!event) {
    return <div className="map-view">No event selected</div>
  }

  const teamsWithLocations = Object.keys(teamLocations).length
  const visibleTeams = selectedTeams.filter((id) => teamLocations[id])

  return (
    <div className="map-view">
      <EventHeader event={event} />

      {canManageEvent && Object.keys(geofenceBreaches).length > 0 && geofence && (
        <div
          className="geofence-alerts"
          style={{
            backgroundColor: '#fff3cd',
            borderLeft: '4px solid #ff6b6b',
            padding: '1rem',
            margin: '1rem',
            borderRadius: '0.25rem',
          }}
        >
          <strong>Geofence Breaches Detected:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
            {Object.values(geofenceBreaches).map((breach, index) => (
              <li key={index}>
                <strong>{breach.teamName}</strong> at [{breach.lat.toFixed(4)}, {breach.lon.toFixed(4)}]
                <br />
                <small>Last seen: {formatDateTime(breach.timestamp)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManageEvent && waypoints?.length > 0 && (
        <div className="waypoint-score-panel">
          <div className="waypoint-score-header">
            <div>
              <strong>Waypoint Scores</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Visit rule: 4 consecutive updates within 15m
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowWaypointScoring((value) => !value)}
            >
              {showWaypointScoring ? 'Hide' : 'Show'}
            </button>
          </div>

          {showWaypointScoring && (
            <div className="waypoint-score-table-wrap">
              <table className="waypoint-score-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    {waypoints.map((waypoint) => (
                      <th key={`head-${waypoint.id}`}>
                        {waypoint.name}
                        {waypoint.is_required && <span className="waypoint-required-tag">R</span>}
                      </th>
                    ))}
                    <th>Required</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {teamScoreRows.map(({ team, visitMap, requiredVisited, requiredTotal, totalVisited, totalWaypoints }) => (
                    <tr key={`score-row-${team.id}`}>
                      <td style={{ textAlign: 'left', fontWeight: 600 }}>{team.name}</td>
                      {waypoints.map((waypoint) => {
                        const visitedAt = visitMap[waypoint.id]
                        return (
                          <td key={`score-${team.id}-${waypoint.id}`} title={visitedAt ? formatDateTime(visitedAt) : 'Not visited'}>
                            {visitedAt ? (
                              <span className="waypoint-score-hit">✓</span>
                            ) : (
                              <span className="waypoint-score-miss">-</span>
                            )}
                          </td>
                        )
                      })}
                      <td>
                        {requiredVisited}/{requiredTotal}
                      </td>
                      <td>
                        {totalVisited}/{totalWaypoints}
                      </td>
                    </tr>
                  ))}
                  {teamScoreRows.length === 0 && (
                    <tr>
                      <td colSpan={waypoints.length + 3}>
                        <span className="empty-state">No teams available</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="map-controls">
        <div className="control-group">
          <label>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          {autoRefresh && (
            <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
              <option value={1000}>1 second</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={15000}>15 seconds</option>
              <option value={20000}>20 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
            </select>
          )}
        </div>

        <div className="control-group">
          <label>
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
            Show history trail
          </label>
        </div>

        <div className="control-group">
          {geofence && geofence.length >= 3 ? (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <strong>Geofence:</strong> Active ({geofence.length} points)
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
              <strong>Geofence:</strong> Not set
            </div>
          )}
        </div>

        <button onClick={refreshAll} className="btn-primary">
          Refresh Now
        </button>

        <button type="button" onClick={toggleMapFullscreen} className="btn-secondary">
          {isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        </button>
      </div>

      <div className="map-layout">
        <div className="teams-sidebar">
          <h3>
            Teams ({visibleTeams.length}/{teamsWithLocations})
          </h3>
          <div className="team-filters">
            {teams && teams.length > 0 ? (
              teams.map((team) => {
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
                        <small>Last seen: {formatTimestamp(location.latest.timestamp)}</small>
                        <small>Positions: {location.history?.length || 0}</small>
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

        <div
          ref={mapContainerRef}
          className={`map-container ${isMapFullscreen ? 'fullscreen' : ''}`.trim()}
        >
          {renderMap()}
        </div>
      </div>
    </div>
  )
}

export default MapView
