import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import FieldDashboard from '../components/FieldDashboard'
import '../UI/style/field-mode.css'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'

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
  const [currentEvent, setCurrentEvent] = useState(null)
  const [currentWaypoints, setCurrentWaypoints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [geofences, setGeofences] = useState([])
  const [teamsWithUpdates, setTeamsWithUpdates] = useState([])

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

  const updateFrequencyMs = currentEvent?.update_frequency || 10000
  const locationLimit = getTeamUpdateLimit(updateFrequencyMs, currentEvent?.access_level || 'field')

  useEffect(() => {
    const storedTeamsData = localStorage.getItem('currentTeams')
    if (!storedTeamsData) return

    try {
      const parsedTeams = JSON.parse(storedTeamsData)
      if (Array.isArray(parsedTeams) && parsedTeams.length > 0) {
        const trimmedTeams = trimTeamsToLimit(parsedTeams, locationLimit)
        setTeamsWithUpdates(trimmedTeams)
        localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
      }
    } catch (error) {
      console.error('[FieldModePage] Failed to parse currentTeams:', error)
    }
  }, [locationLimit])

  // Fetch teams for this event, including bounded nested updates (poll every 15 seconds)
  const { data: teamsData, loading: teamsLoading, error: teamsError } = useQuery(GET_TEAMS, {
    variables: { eventId: currentEvent?.id, limit: locationLimit },
    skip: !currentEvent?.id,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    pollInterval: 30000, // Poll every 30 seconds for field operations
  })

  if (teamsError) {
    console.error('[FieldModePage] Teams query error:', teamsError?.message)
  }
  if (teamsData?.teams) {
    console.log('[FieldModePage] Teams fetched:', teamsData.teams.length, 'teams')
  }

  useEffect(() => {
    if (!teamsData?.teams) return

    const trimmedTeams = trimTeamsToLimit(teamsData.teams, locationLimit)

    setTeamsWithUpdates(trimmedTeams)
    localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
  }, [teamsData?.teams, locationLimit])

  useEffect(() => {
    if (!teamsWithUpdates || teamsWithUpdates.length === 0) return

    const trimmedTeams = trimTeamsToLimit(teamsWithUpdates, locationLimit)
    if (JSON.stringify(trimmedTeams) === JSON.stringify(teamsWithUpdates)) {
      return
    }

    setTeamsWithUpdates(trimmedTeams)
    localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
  }, [teamsWithUpdates, locationLimit])

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

  useEffect(() => {
    if (!waypointsData?.waypoints) return

    console.log('[FieldModePage] Waypoints fetched:', waypointsData.waypoints.length, 'waypoints')
    setCurrentWaypoints(waypointsData.waypoints)
  }, [waypointsData?.waypoints])

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
  const isInitialLoading = isLoading || (teamsLoading && teamsWithUpdates.length === 0)

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
        isUpdating={teamsLoading}
      />
    </div>
  )
}

export default FieldModePage
