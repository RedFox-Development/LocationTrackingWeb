import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useApolloClient } from '@apollo/client/react'
import { GET_TEAMS, GET_UPDATES } from '../api/graphql/team'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import FieldDashboard from '../components/FieldDashboard'
import '../UI/style/field-mode.css'

/**
 * FieldModePage - Mobile-optimized interface for field organizers
 * Real-time team monitoring, geofence alerts, waypoint tracking
 * 
 * Query Strategy (Parity with MapView):
 * - Fetches teams separately (lightweight)
 * - Fetches location updates with calculated limit based on update frequency
 * - Shorter time window (1200s = 20 mins) vs desktop (3600s = 1 hour)
 */
function FieldModePage() {
  const navigate = useNavigate()
  const apolloClient = useApolloClient()
  const [currentEvent, setCurrentEvent] = useState(null)
  const [currentWaypoints, setCurrentWaypoints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [geofences, setGeofences] = useState([])
  const [teamsWithUpdates, setTeamsWithUpdates] = useState([])
  const isFetchingRef = useRef(false)
  const fetchIntervalRef = useRef(null)

  useEffect(() => {
    const eventData = localStorage.getItem('currentEvent')
    const waypointsData = localStorage.getItem('currentWaypoints')
    
    if (!eventData) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const event = JSON.parse(eventData)
      if (event?.access_level !== 'field') {
        console.warn('[FieldModePage] Not a field access session')
        navigate('/login', { replace: true })
        return
      }
      setCurrentEvent(event)
      if (waypointsData) {
        setCurrentWaypoints(JSON.parse(waypointsData))
      }
    } catch (err) {
      console.error('[FieldModePage] Failed to parse event:', err)
      navigate('/login', { replace: true })
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  // Parse geofences from event data
  useEffect(() => {
    if (!currentEvent) return
    
    let parsedGeofences = []
    try {
      if (currentEvent?.geofence_data) {
        console.log('[FieldModePage] Raw geofence_data:', currentEvent.geofence_data)
        parsedGeofences = JSON.parse(currentEvent.geofence_data)
        if (!Array.isArray(parsedGeofences)) {
          parsedGeofences = [parsedGeofences]
        }
        console.log('[FieldModePage] Parsed geofences:', parsedGeofences)
      } else {
        console.warn('[FieldModePage] No geofence_data found in event:', currentEvent)
      }
    } catch (err) {
      console.error('[FieldModePage] Failed to parse geofence_data:', err, 'Raw data:', currentEvent?.geofence_data)
    }
    setGeofences(parsedGeofences)
  }, [currentEvent?.geofence_data, currentEvent?.id])

  // Fetch teams for this event (poll every 60 seconds)
  const { data: teamsData, loading: teamsLoading, error: teamsError, refetch: refetchTeams } = useQuery(GET_TEAMS, {
    variables: { eventId: currentEvent?.id },
    skip: !currentEvent?.id,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    pollInterval: 60000, // Poll every 60 seconds for field operations
  })

  if (teamsError) {
    console.error('[FieldModePage] Teams query error:', teamsError?.message)
  }
  if (teamsData?.teams) {
    console.log('[FieldModePage] Teams fetched:', teamsData.teams.length, 'teams')
  }

  // Fetch waypoints for this event (poll every 5 minutes)
  const { data: waypointsData, error: waypointsError } = useQuery(GET_WAYPOINTS, {
    variables: { eventId: currentEvent?.id },
    skip: !currentEvent?.id,
    fetchPolicy: 'cache-and-network',
    pollInterval: 300000, // Poll every 5 minutes (300 seconds) for field operations
  })

  if (waypointsError) {
    console.error('[FieldModePage] Waypoints query error:', waypointsError?.message)
  }
  if (waypointsData?.waypoints) {
    console.log('[FieldModePage] Waypoints fetched:', waypointsData.waypoints.length, 'waypoints')
    setCurrentWaypoints(waypointsData.waypoints)
  }

  // Fetch location updates for all teams with optimized time window
  const fetchLocationUpdates = useCallback(async (teams) => {
    if (!teams || teams.length === 0 || !currentEvent) return

    if (isFetchingRef.current) {
      console.log('[FieldModePage] Already fetching, skipping...')
      return
    }

    isFetchingRef.current = true
    const now = Date.now()
    console.log('[FieldModePage] fetchLocationUpdates started at', new Date(now).toISOString())

    // Calculate limit for field operations: 900 seconds (15 minutes, reduced from 1200s for better performance)
    const updateFrequencyMs = currentEvent?.update_frequency || 10000
    const timeWindowSeconds = 900 // 15 minutes for field ops (faster polling)
    const calculatedLimit = Math.round(timeWindowSeconds / (updateFrequencyMs / 1000) * 1.5)
    console.log('[FieldModePage] Using update frequency:', updateFrequencyMs, 'ms, time window:', timeWindowSeconds, 's, calculated limit:', calculatedLimit)

    try {
      const locationsPromises = teams.map(async (team) => {
        try {
          const { data } = await apolloClient.query({
            query: GET_UPDATES,
            variables: {
              event: currentEvent.name,
              team: team.name,
              limit: calculatedLimit,
            },
            fetchPolicy: 'cache-first', // Use cache first to reduce server load
          })

          return {
            id: team.id,
            name: team.name,
            color: team.color,
            event_id: team.event_id,
            activated: team.activated,
            updates: data.updates || [],
          }
        } catch (error) {
          console.error(`[FieldModePage] Error fetching locations for team ${team.name}:`, error)
          return {
            id: team.id,
            name: team.name,
            color: team.color,
            event_id: team.event_id,
            activated: team.activated,
            updates: [],
          }
        }
      })

      const results = await Promise.all(locationsPromises)
      console.log('[FieldModePage] Got results for', results.length, 'teams')
      results.forEach(r => {
        console.log(`[FieldModePage] Team ${r.name} has ${r.updates?.length || 0} location updates`)
      })
      setTeamsWithUpdates(results)
    } catch (error) {
      console.error('[FieldModePage] Error in fetchLocationUpdates:', error)
    } finally {
      isFetchingRef.current = false
    }
  }, [currentEvent, apolloClient])

  // Trigger location update fetches when teams change
  useEffect(() => {
    if (!teamsData?.teams) {
      console.warn('[FieldModePage] No teams data available from query')
      // Even if teams query fails, we should render geofences and waypoints
      // Set empty teams array so FieldDashboard can still render map
      setTeamsWithUpdates([])
      return
    }
    fetchLocationUpdates(teamsData.teams)
  }, [teamsData?.teams, fetchLocationUpdates])

  // Set up polling for location updates (15 seconds instead of 10 to reduce server load)
  useEffect(() => {
    if (!teamsData?.teams || teamsData.teams.length === 0) return

    // Initial fetch
    fetchLocationUpdates(teamsData.teams)

    // Set up polling interval
    fetchIntervalRef.current = setInterval(() => {
      fetchLocationUpdates(teamsData.teams)
    }, 15000) // Poll every 15 seconds for field operations (reduced from 10s for better performance)

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
    }
  }, [teamsData?.teams, fetchLocationUpdates])

  // Debug logging
  useEffect(() => {
    if (teamsError) {
      console.error('[FieldModePage] Teams query error:', teamsError?.message)
    }
    console.log('[FieldModePage] Teams loaded:', teamsData?.teams?.length || 0, 'teams')
    console.log('[FieldModePage] Teams with updates:', teamsWithUpdates.length)
    if (teamsWithUpdates.length > 0) {
      console.log('[FieldModePage] First team:', teamsWithUpdates[0])
      console.log('[FieldModePage] First team updates:', teamsWithUpdates[0].updates?.length || 0, 'updates')
    }
  }, [teamsData, teamsWithUpdates, teamsError])

  // Only show loading on initial load
  const isInitialLoading = isLoading || teamsLoading

  if (isInitialLoading) {
    return (
      <div className="field-mode-loading">
        <div className="spinner"></div>
        <p>Loading field dashboard...</p>
      </div>
    )
  }

  if (!currentEvent) {
    return null // Redirect handled by useEffect
  }

  return (
    <div className="field-mode-page">
      <FieldDashboard
        event={currentEvent}
        teams={teamsWithUpdates}
        waypoints={currentWaypoints}
        geofences={geofences}
        isUpdating={isFetchingRef.current}
      />
    </div>
  )
}

export default FieldModePage
