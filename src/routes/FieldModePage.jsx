import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useApolloClient } from '@apollo/client/react'
import { GET_TEAMS_FIELD_OPS, GET_UPDATES } from '../api/graphql/team'
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

  // Fetch teams (lightweight - no updates)
  const { data: teamsData, loading: teamsLoading, error: teamsError, refetch: refetchTeams } = useQuery(GET_TEAMS_FIELD_OPS, {
    variables: { eventId: currentEvent?.id },
    skip: !currentEvent?.id,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })

  // Fetch location updates for all teams with optimized time window
  const fetchLocationUpdates = async (teams) => {
    if (!teams || teams.length === 0 || !currentEvent) return

    if (isFetchingRef.current) {
      console.log('[FieldModePage] Already fetching, skipping...')
      return
    }

    isFetchingRef.current = true
    const now = Date.now()
    console.log('[FieldModePage] fetchLocationUpdates started at', new Date(now).toISOString())

    // Calculate limit for field operations: 1200 seconds (shorter than desktop's 3600s)
    const updateFrequencyMs = currentEvent?.update_frequency || 10000
    const timeWindowSeconds = 1200 // 20 minutes for field ops
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
            fetchPolicy: 'network-only',
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
  }

  // Trigger location update fetches when teams change
  useEffect(() => {
    if (!teamsData?.teams) return
    fetchLocationUpdates(teamsData.teams)
  }, [teamsData?.teams?.map(t => t.id).join(',')])

  // Set up polling for location updates (10 seconds like MapView)
  useEffect(() => {
    if (!teamsData?.teams || teamsData.teams.length === 0) return

    // Initial fetch
    fetchLocationUpdates(teamsData.teams)

    // Set up polling interval
    fetchIntervalRef.current = setInterval(() => {
      fetchLocationUpdates(teamsData.teams)
    }, 10000) // Poll every 10 seconds for field operations

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current)
      }
    }
  }, [teamsData?.teams?.length, currentEvent?.name])

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
