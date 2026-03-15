import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LOGIN } from '../api/graphql/login'
import { GET_EVENT } from '../api/graphql/event'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import { graphqlClient } from '../api/graphql/graphqlClient'
import { hasManageAccess, mergeEventWithAuthFields } from '../utils/eventAccess'

function LoginPage() {
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [eventKeycode, setEventKeycode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBootstrappingEvent, setIsBootstrappingEvent] = useState(false)

  // Redirect if already logged in (check only on mount)
  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    if (!currentEvent) return

    try {
      const parsedEvent = JSON.parse(currentEvent)
      if (parsedEvent?.id && parsedEvent?.name && (parsedEvent?.keycode || parsedEvent?.view_keycode)) {
        console.log('[LoginPage] Already logged in, redirecting...')
        navigate(hasManageAccess(parsedEvent) ? '/event' : '/event/map', { replace: true })
        return
      }
    } catch (storageError) {
      console.warn('[LoginPage] Invalid stored event found, clearing it:', storageError)
    }

    localStorage.removeItem('currentEvent')
    localStorage.removeItem('currentTeams')
    localStorage.removeItem('currentWaypoints')
  }, [navigate])

  const handleLoginEvent = async (e) => {
    e.preventDefault()
    setLoginError('')
    
    if (!eventName.trim() || !eventKeycode.trim()) {
      setLoginError('Event name and keycode are required')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await graphqlClient.query({
        query: LOGIN,
        variables: {
          eventName: eventName.trim(),
          keycode: eventKeycode.trim(),
        },
        fetchPolicy: 'network-only',
      })

      const loginResult = result?.data?.login
      console.log('[LoginPage] Query result:', result)

      if (!loginResult?.success || !loginResult?.event) {
        setLoginError('Login failed. Please check your event name and keycode.')
        return
      }

      const loggedInEvent = {
        ...loginResult.event,
        access_level: loginResult.access_level || loginResult.event?.access_level || 'manage',
      }
      localStorage.setItem('currentEvent', JSON.stringify(loggedInEvent))
      localStorage.removeItem('currentTeams')
      localStorage.removeItem('currentWaypoints')

      try {
        setIsBootstrappingEvent(true)

        const [eventResult, teamsResult, waypointsResult] = await Promise.all([
          graphqlClient.query({
            query: GET_EVENT,
            variables: { id: loggedInEvent.id },
            fetchPolicy: 'network-only',
          }),
          graphqlClient.query({
            query: GET_TEAMS,
            variables: { eventId: loggedInEvent.id },
            fetchPolicy: 'network-only',
          }),
          graphqlClient.query({
            query: GET_WAYPOINTS,
            variables: { eventId: loggedInEvent.id },
            fetchPolicy: 'network-only',
          }),
        ])

        const fullEvent = mergeEventWithAuthFields(eventResult?.data?.event || null, loggedInEvent)
        const teams = teamsResult?.data?.teams || []
        const waypoints = waypointsResult?.data?.waypoints || []

        localStorage.setItem('currentEvent', JSON.stringify(fullEvent))
        localStorage.setItem('currentTeams', JSON.stringify(teams))
        localStorage.setItem('currentWaypoints', JSON.stringify(waypoints))
      } catch (bootstrapError) {
        console.error('[LoginPage] event bootstrap failed, continuing with minimal event data:', bootstrapError)
      } finally {
        setIsBootstrappingEvent(false)
      }

      navigate(hasManageAccess(loggedInEvent) ? '/event' : '/event/map', { replace: true })
    } catch (err) {
      console.error('[LoginPage] Query execution error:', err)
      setLoginError(err.message || 'Failed to execute login query')
      setIsBootstrappingEvent(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>Location Tracker</h1>
        <h2>Event Manager</h2>
        <p className="login-description">
          Login to your event to manage teams and locations
        </p>

        {loginError && (
          <div className="error-message">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLoginEvent} className="login-form">
          <div className="form-group">
            <label>Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
              placeholder="Enter event name"
            />
          </div>
          <div className="form-group">
            <label>Event Keycode</label>
            <input
              type="text"
              value={eventKeycode}
              onChange={(e) => setEventKeycode(e.target.value)}
              required
              placeholder="Enter keycode"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting || isBootstrappingEvent}>
            {isSubmitting ? 'Logging in...' : isBootstrappingEvent ? 'Loading event data...' : 'Login'}
          </button>
        </form>

        <div className="login-info">
          <p>Don't have an event yet?</p>
          <Link to="/setup" className="btn-secondary">
            Create New Event
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
