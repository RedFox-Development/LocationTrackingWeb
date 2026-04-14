import { useEffect, useState } from 'react'
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

  // Fetch teams with polling for real-time updates
  const { data: teamsData, loading: teamsLoading } = useQuery(GET_TEAMS, {
    variables: { eventId: currentEvent?.id },
    skip: !currentEvent?.id,
    pollInterval: 5000, // Poll every 5 seconds for real-time updates
    fetchPolicy: 'network-only',
  })

  // Parse geofences from event data
  let geofences = []
  try {
    if (currentEvent?.geofence_data) {
      geofences = JSON.parse(currentEvent.geofence_data)
      if (!Array.isArray(geofences)) {
        geofences = [geofences]
      }
    }
  } catch (err) {
    console.warn('[FieldModePage] Failed to parse geofence_data:', err)
  }

  if (isLoading || teamsLoading) {
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
      />
    </div>
  )
}

export default FieldModePage
