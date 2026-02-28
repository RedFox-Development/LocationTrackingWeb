import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLazyQuery } from '@apollo/client/react'
import { LOGIN } from '../api/graphql/login'
import { GET_TEAMS } from '../api/graphql/team'

function LoginPage() {
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [eventKeycode, setEventKeycode] = useState('')
  const [loginError, setLoginError] = useState('')
  
  const [loginQuery, { loading, data, error }] = useLazyQuery(LOGIN, {
    fetchPolicy: 'network-only',
  })

  const [getTeams] = useLazyQuery(GET_TEAMS, {
    fetchPolicy: 'network-only',
    onCompleted: (teamsData) => {
      if (teamsData?.teams) {
        console.log('[LoginPage] Initial teams data fetched:', teamsData.teams)
        localStorage.setItem('currentTeams', JSON.stringify(teamsData.teams))
      }
    }
  })

  // Watch for data changes and handle navigation
  useEffect(() => {
    if (data) {
      console.log('[LoginPage] useEffect - Data received:', JSON.stringify(data, null, 2))
      console.log('[LoginPage] useEffect - data.login:', data?.login)
      console.log('[LoginPage] useEffect - data.login.success:', data?.login?.success)
      
      if (data?.login?.success) {
        console.log('[LoginPage] useEffect - Success is true, storing data...')
        // Store event data in localStorage
        localStorage.setItem('currentEvent', JSON.stringify(data.login.event))
        
        console.log('[LoginPage] useEffect - Data stored in localStorage')
        console.log('[LoginPage] useEffect - Fetching teams...')
        
        // Fetch teams immediately after login
        getTeams({ variables: { eventId: data.login.event.id } })
        
        console.log('[LoginPage] useEffect - Calling navigate to /event')
        // Redirect to event page
        navigate('/event', { replace: true })
        console.log('[LoginPage] useEffect - Navigate called')
      } else {
        console.log('[LoginPage] useEffect - Success is false or missing')
        setLoginError('Login failed. Please check your event name and keycode.')
      }
    }
  }, [data, navigate, getTeams])

  // Watch for errors
  useEffect(() => {
    if (error) {
      console.error('[LoginPage] useEffect - Error received:', error)
      setLoginError(error.message || 'Failed to login. Please try again.')
    }
  }, [error])

  // Redirect if already logged in (check only on mount)
  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    if (currentEvent) {
      console.log('[LoginPage] Already logged in, redirecting...')
      navigate('/event')
    }
  }, [])

  const handleLoginEvent = async (e) => {
    e.preventDefault()
    setLoginError('')
    
    if (!eventName.trim() || !eventKeycode.trim()) {
      setLoginError('Event name and keycode are required')
      return
    }

    try {
      const result = await loginQuery({
        variables: {
          eventName: eventName.trim(),
          keycode: eventKeycode.trim()
        }
      })
      console.log('[LoginPage] Query result:', result)
    } catch (err) {
      console.error('[LoginPage] Query execution error:', err)
      setLoginError(err.message || 'Failed to execute login query')
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
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
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
