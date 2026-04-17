import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import { GET_EVENT } from '../api/graphql/event'
import FieldDashboard from '../components/FieldDashboard'
import '../UI/style/field-mode.css'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'
import { preloadEventDataBundle } from '../utils/eventBootstrap'
import {
  getEventRefreshQueryOptions,
  getTeamsRefreshQueryOptions,
  getWaypointsRefreshQueryOptions,
  persistEventSnapshot,
  persistTeamsSnapshot,
  persistWaypointsSnapshot,
  readLocalJson,
} from '../utils/dataRefreshOrchestrator'

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
    const loadFieldData = async () => {
      const eventData = readLocalJson('currentEvent')
      const waypointsData = readLocalJson('currentWaypoints')
      const teamsData = readLocalJson('currentTeams')

      if (!eventData) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const event = eventData
        if (event?.access_level !== 'field') {
          console.warn('[FieldModePage] Not a field access session')
          navigate('/login', { replace: true })
          return
        }

        setCurrentEvent(event)

        if (waypointsData) {
          setCurrentWaypoints(Array.isArray(waypointsData) ? waypointsData : [])
        }

        const cachedTeams = Array.isArray(teamsData) ? teamsData : []
        if (cachedTeams.length > 0) {
          setTeamsWithUpdates(trimTeamsToLimit(cachedTeams, getTeamUpdateLimit(event?.update_frequency, event?.access_level || 'field')))
        }

        // On browser reload ensure event, teams and waypoints are restored to localStorage.
        if (!waypointsData || cachedTeams.length === 0) {
          const bundle = await preloadEventDataBundle(event.id)
          if (bundle?.event) {
            setCurrentEvent((current) => ({
              ...(current || event),
              ...bundle.event,
              access_level: event.access_level,
            }))
          }
          if (Array.isArray(bundle?.teams)) {
            const bundleTeams = trimTeamsToLimit(bundle.teams, getTeamUpdateLimit(event?.update_frequency, event?.access_level || 'field'))
            setTeamsWithUpdates(bundleTeams)
            persistTeamsSnapshot(bundleTeams, getTeamUpdateLimit(event?.update_frequency, event?.access_level || 'field'))
          }
          if (Array.isArray(bundle?.waypoints)) {
            setCurrentWaypoints(bundle.waypoints)
          }
        }
      } catch (err) {
        console.error('[FieldModePage] Failed to parse/load event bundle:', err)
        navigate('/login', { replace: true })
      } finally {
        setIsLoading(false)
      }
    }

    loadFieldData()
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

  const { data: latestEventData } = useQuery(GET_EVENT, getEventRefreshQueryOptions(currentEvent?.id))

  useEffect(() => {
    const storedTeamsData = readLocalJson('currentTeams')
    if (!storedTeamsData) return

    try {
      const parsedTeams = storedTeamsData
      if (Array.isArray(parsedTeams)) {
        const trimmedTeams = trimTeamsToLimit(parsedTeams, locationLimit)
        setTeamsWithUpdates(trimmedTeams)
        persistTeamsSnapshot(trimmedTeams, locationLimit)
      }
    } catch (error) {
      console.error('[FieldModePage] Failed to parse currentTeams:', error)
    }
  }, [locationLimit])

  // Fetch teams for this event, including bounded nested updates.
  const {
    data: teamsData,
    loading: teamsLoading,
    error: teamsError,
  } = useQuery(GET_TEAMS, getTeamsRefreshQueryOptions(currentEvent?.id, locationLimit))

  if (teamsError) {
    console.error('[FieldModePage] Teams query error:', teamsError?.message)
  }
  if (teamsData?.teams) {
    console.log('[FieldModePage] Teams fetched:', teamsData.teams.length, 'teams')
  }

  useEffect(() => {
    if (!teamsData?.teams) return

    const normalizedTeams = persistTeamsSnapshot(teamsData.teams, locationLimit)
    setTeamsWithUpdates(normalizedTeams)
  }, [teamsData?.teams, locationLimit])

  useEffect(() => {
    if (!latestEventData?.event) return

    const updatedEvent = {
      ...currentEvent,
      ...latestEventData.event,
      access_level: currentEvent?.access_level || 'field',
    }

    setCurrentEvent((prev) => {
      if (!prev) return prev

      if (
        prev.update_frequency === updatedEvent.update_frequency &&
        prev.geofence_data === updatedEvent.geofence_data
      ) {
        return prev
      }

      persistEventSnapshot(updatedEvent)
      return updatedEvent
    })
  }, [latestEventData])

  useEffect(() => {
    if (!teamsWithUpdates || teamsWithUpdates.length === 0) return

    const trimmedTeams = trimTeamsToLimit(teamsWithUpdates, locationLimit)
    if (JSON.stringify(trimmedTeams) === JSON.stringify(teamsWithUpdates)) {
      return
    }

    setTeamsWithUpdates(trimmedTeams)
    persistTeamsSnapshot(trimmedTeams, locationLimit)
  }, [teamsWithUpdates, locationLimit])

  // Fetch waypoints for this event (poll every 5 minutes)
  const { data: waypointsData, error: waypointsError } = useQuery(GET_WAYPOINTS, getWaypointsRefreshQueryOptions(currentEvent?.id))

  if (waypointsError) {
    console.error('[FieldModePage] Waypoints query error:', waypointsError?.message)
  }

  useEffect(() => {
    if (!waypointsData?.waypoints) return

    console.log('[FieldModePage] Waypoints fetched:', waypointsData.waypoints.length, 'waypoints')
    const normalizedWaypoints = persistWaypointsSnapshot(waypointsData.waypoints)
    setCurrentWaypoints(normalizedWaypoints)
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
