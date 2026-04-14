import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { GET_TEAMS } from '../api/graphql/team'
import FieldDashboard from '../components/FieldDashboard'
import '../UI/style/field-mode.css'

/**
 * FieldModePage - Mobile-optimized interface for field organizers
 * Real-time team monitoring, geofence alerts, waypoint tracking
 */
function FieldModePage() {
  const navigate = useNavigate()
  const [currentEvent, setCurrentEvent] = useState(null)
  const [currentWaypoints, setCurrentWaypoints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [geofences, setGeofences] = useState([])

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

  // Fetch teams with polling for real-time updates
  const { data: teamsData, loading: teamsLoading, error: teamsError, networkStatus } = useQuery(GET_TEAMS, {
    variables: { eventId: currentEvent?.id },
    skip: !currentEvent?.id,
    pollInterval: 10000, // Poll every 10 seconds (faster updates)
    fetchPolicy: 'cache-and-network', // Use cache immediately, then update in background
    notifyOnNetworkStatusChange: true,
  })

  useEffect(() => {
    if (teamsError) {
      console.error('[FieldModePage] Teams query error:', teamsError)
    }
    const status = networkStatus === 1 ? 'loading' : networkStatus === 4 ? 'polling' : 'idle'
    console.log('[FieldModePage] Teams data received:', teamsData?.teams?.length || 0, 'teams, status:', status)
  }, [teamsData, teamsError, networkStatus])

  // Only show loading on initial load or actual errors, not during polling
  const isInitialLoading = isLoading || (teamsLoading && networkStatus === 1)

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
        teams={teamsData?.teams || []}
        waypoints={currentWaypoints}
        geofences={geofences}
        isUpdating={networkStatus === 4}
      />
    </div>
  )
}

export default FieldModePage
