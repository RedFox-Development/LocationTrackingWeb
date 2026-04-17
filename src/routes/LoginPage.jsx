import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LOGIN } from '../api/graphql/login'
import { GET_EVENT } from '../api/graphql/event'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import { graphqlClient } from '../api/graphql/graphqlClient'
// eslint-disable-next-line no-unused-vars
import { hasManageAccess, mergeEventWithAuthFields } from '../utils/eventAccess'
import { getTeamUpdateLimit } from '../utils/updateLimits'

function LoginPage() {
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [eventKeycode, setEventKeycode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBootstrappingEvent, setIsBootstrappingEvent] = useState(false)
  const [useQRMode, setUseQRMode] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [qrReaderInitialized, setQrReaderInitialized] = useState(false)
  const qrScannerRef = useRef(null)

  // Define handleQRLogin first so it can be used in dependencies
  const handleQRLogin = useCallback(async (qrEventName, qrKeycode) => {
    console.log('[LoginPage] handleQRLogin called with:', { qrEventName, qrKeycode })
    setEventName(qrEventName)
    setEventKeycode(qrKeycode)
    setLoginError('')
    
    try {
      setIsSubmitting(true)
      console.log('[LoginPage] Sending LOGIN query...')
      const result = await graphqlClient.query({
        query: LOGIN,
        variables: {
          eventName: qrEventName.trim(),
          keycode: qrKeycode.trim(),
        },
        fetchPolicy: 'network-only',
      })

      const loginResult = result?.data?.login
      console.log('[LoginPage] QR Login result:', loginResult)

      if (!loginResult?.success || !loginResult?.event) {
        console.error('[LoginPage] Login response missing success or event:', loginResult)
        const errorMsg = loginResult?.error || 'Login failed. Please check that the event name and field keycode are correct.'
        setLoginError(`Login failed: ${errorMsg}`)
        return
      }

      const loggedInEvent = {
        ...loginResult.event,
        access_level: loginResult.access_level || loginResult.event?.access_level || 'manage',
      }
      const teamUpdateLimit = getTeamUpdateLimit(loggedInEvent.update_frequency, loggedInEvent.access_level)
      console.log('[LoginPage] Setting current event to localStorage:', loggedInEvent)
      localStorage.setItem('currentEvent', JSON.stringify(loggedInEvent))
      localStorage.removeItem('currentTeams')
      localStorage.removeItem('currentWaypoints')

      try {
        setIsBootstrappingEvent(true)
        console.log('[LoginPage] Bootstrapping event data...')

        const [eventResult, teamsResult, waypointsResult] = await Promise.all([
          graphqlClient.query({
            query: GET_EVENT,
            variables: { id: loggedInEvent.id },
            fetchPolicy: 'network-only',
          }),
          graphqlClient.query({
            query: GET_TEAMS_WITH_UPDATES,
            variables: { eventId: loggedInEvent.id, limit: teamUpdateLimit },
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

        console.log('[LoginPage] Bootstrap complete, saving to localStorage')
        localStorage.setItem('currentEvent', JSON.stringify(fullEvent))
        localStorage.setItem('currentTeams', JSON.stringify(teams))
        localStorage.setItem('currentWaypoints', JSON.stringify(waypoints))
      } catch (bootstrapError) {
        console.error('[LoginPage] event bootstrap failed, continuing with minimal event data:', bootstrapError)
      } finally {
        setIsBootstrappingEvent(false)
      }

      const accessLevel = loggedInEvent?.access_level || (loggedInEvent?.keycode ? 'manage' : 'view')
      const targetPath = accessLevel === 'manage' ? '/event' : accessLevel === 'field' ? '/field' : '/event/map'
      console.log('[LoginPage] Navigating to:', targetPath, 'with access level:', accessLevel)
      navigate(targetPath, { replace: true })
    } catch (err) {
      console.error('[LoginPage] QR login error:', err)
      setLoginError(err.message || 'Failed to login with QR code')
      setIsBootstrappingEvent(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [navigate])

  // Redirect if already logged in (check only on mount)
  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    if (!currentEvent) return

    try {
      const parsedEvent = JSON.parse(currentEvent)
      if (parsedEvent?.id && parsedEvent?.name && (parsedEvent?.keycode || parsedEvent?.view_keycode || parsedEvent?.field_keycode)) {
        console.log('[LoginPage] Already logged in, redirecting...')
        const accessLevel = parsedEvent?.access_level || (parsedEvent?.keycode ? 'manage' : 'view')
        if (accessLevel === 'manage') {
          navigate('/event', { replace: true })
        } else if (accessLevel === 'field') {
          navigate('/field', { replace: true })
        } else {
          navigate('/event/map', { replace: true })
        }
        return
      }
    } catch (storageError) {
      console.warn('[LoginPage] Invalid stored event found, clearing it:', storageError)
    }

    localStorage.removeItem('currentEvent')
    localStorage.removeItem('currentTeams')
    localStorage.removeItem('currentWaypoints')
  }, [navigate])

  // Handle QR mode toggle and initialization
  useEffect(() => {
    if (!useQRMode) return

    // Wait a tick to ensure DOM is ready
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[LoginPage] Initializing QR scanner...')
        
        // Dynamically import the scanner only when needed
        const { Html5QrcodeScanner: Scanner } = await import('html5-qrcode')
        
        const scanner = new Scanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        )

        const handleSuccess = (decodedText) => {
          try {
            console.log('[LoginPage] QR code scanned:', decodedText)
            const qrData = JSON.parse(decodedText)
            if (qrData.fieldKeycode && qrData.event) {
              console.log('[LoginPage] QR code scanned successfully, logging in...')
              scanner.clear().catch(err => console.error('[LoginPage] Error clearing scanner:', err))
              setUseQRMode(false)
              // Trigger login after a short delay to allow state update
              setTimeout(() => {
                handleQRLogin(qrData.event, qrData.fieldKeycode)
              }, 100)
            }
          } catch (e) {
            console.error('[LoginPage] Invalid QR code format:', e)
            setLoginError('Invalid QR code format. Please scan a valid field access QR code.')
          }
        }

        const handleError = (err) => {
          console.error('[LoginPage] QR scanning error:', err)
        }

        scanner.render(handleSuccess, handleError)
        qrScannerRef.current = scanner
        console.log('[LoginPage] QR scanner initialized successfully')
      } catch (err) {
        console.error('[LoginPage] Failed to initialize QR scanner:', err)
        setLoginError('Failed to initialize camera. Please check permissions and try again.')
        setUseQRMode(false)
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (qrScannerRef.current) {
        qrScannerRef.current.clear().catch(err => console.error('[LoginPage] Error clearing scanner on cleanup:', err))
        qrScannerRef.current = null
      }
    }
  }, [useQRMode, handleQRLogin])

  const handleLoginEvent = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault()
    }
    
    const name = eventName
    const code = eventKeycode
    
    setLoginError('')
    
    if (!name.trim() || !code.trim()) {
      setLoginError('Event name and keycode are required')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await graphqlClient.query({
        query: LOGIN,
        variables: {
          eventName: name.trim(),
          keycode: code.trim(),
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
      const teamUpdateLimit = getTeamUpdateLimit(loggedInEvent.update_frequency, loggedInEvent.access_level)
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
            query: GET_TEAMS_WITH_UPDATES,
            variables: { eventId: loggedInEvent.id, limit: teamUpdateLimit },
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

      const accessLevel = loggedInEvent?.access_level || (loggedInEvent?.keycode ? 'manage' : 'view')
      const targetPath = accessLevel === 'manage' ? '/event' : accessLevel === 'field' ? '/field' : '/event/map'
      navigate(targetPath, { replace: true })
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0', opacity: 0.5 }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📱 Field Access
          </h3>
          {useQRMode ? (
            <>
              <div id="qr-reader" style={{ width: '100%', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '1rem' }}></div>
              <p style={{ margin: '1rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Point your camera at the field access QR code
              </p>
              <button
                type="button"
                onClick={() => { setUseQRMode(false); setQrReaderInitialized(false) }}
                className="btn-secondary"
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setUseQRMode(true)}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              🔍 Scan QR Code
            </button>
          )}
        </div>
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
