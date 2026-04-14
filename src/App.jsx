import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { GET_TEAMS } from './api/graphql/team'

import ProtectedRoute from './components/ProtectedRoute'
import AppHeaderName from './components/AppHeaderName'
import LoginPage from './routes/LoginPage'
import SetupPage from './routes/SetupPage'
import EventPage from './routes/EventPage'
import TeamsListPage from './routes/TeamsListPage'
import MapViewPage from './routes/MapViewPage'
import FieldModePage from './routes/FieldModePage'
import LogoutPage from './routes/LogoutPage'
import { hasManageAccess } from './utils/eventAccess'
import './UI/style/App.css'

const App = () => {
  const location = useLocation()
  // Initialize state from localStorage and update on pathname changes
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const eventData = localStorage.getItem('currentEvent')
    return !!eventData
  })
  const [currentEvent, setCurrentEvent] = useState(() => {
    const eventData = localStorage.getItem('currentEvent')
    return eventData ? JSON.parse(eventData) : null
  })
  const canManageEvent = hasManageAccess(currentEvent)
  const isFieldOrganizer = currentEvent?.access_level === 'field'
  const lockSomeFeatures = false;

  useEffect(() => {
    // Update state when pathname changes (e.g., after login/logout)
    const checkAuth = () => {
      const eventData = localStorage.getItem('currentEvent')
      const event = eventData ? JSON.parse(eventData) : null
      setIsLoggedIn(!!event)
      setCurrentEvent(event)
    }
    
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(checkAuth, 0)
    return () => clearTimeout(timeoutId)
  }, [location.pathname])

  // Poll for teams data when logged in
  const { error, data } = useQuery(GET_TEAMS, {
    variables: { eventId: currentEvent?.id },
    skip: !isLoggedIn || !currentEvent?.id,
    pollInterval: 60000,
    fetchPolicy: 'network-only'
  });
  if (data?.teams) {
    console.log('[App] Teams data updated:', data.teams)
    localStorage.setItem('currentTeams', JSON.stringify(data.teams))
  }
  if (error) {
    console.error('[App] Error fetching teams:', error)
  }

  // Don't show header on login and setup pages, show minimal header for field mode
  const showHeader = location.pathname !== '/login' && location.pathname !== '/setup'
  const showFullNav = !isFieldOrganizer

  return (
    <>
      {showHeader && (
        <header className="app-header">
          <AppHeaderName />
          <nav>
            {isLoggedIn && (
              <>
                {showFullNav && canManageEvent && (
                  <Link 
                    to="/event" 
                    className={location.pathname === '/event' ? 'active' : ''}
                  >
                    Event Dashboard
                  </Link>
                )}
                {showFullNav && canManageEvent && (
                  <Link 
                    to="/teams" 
                    className={location.pathname.startsWith('/teams') ? 'active' : ''}
                  >
                    Teams
                  </Link>
                )}
                {showFullNav && (
                  <Link 
                    to="/event/map" 
                    className={location.pathname === '/event/map' ? 'active' : ''}
                  >
                    Map
                  </Link>
                )}
                {isFieldOrganizer && (
                  <span className="nav-title" style={{maxWidth: '35%'}}>Field Operations</span>
                )}
                <Link 
                  to="/logout" 
                  className="logout-link"
                >
                  Logout
                </Link>
              </>
            )}
            {!isLoggedIn && location.pathname !== '/setup' && (
              <Link to="/setup" className="btn-link">
                Get Started
              </Link>
            )}
          </nav>
        </header>
      )}
      <section className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route 
            path="/event" 
            element={
              <ProtectedRoute>
                <EventPage lockSomeFeatures={lockSomeFeatures} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teams" 
            element={
              <ProtectedRoute>
                <TeamsListPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/event/map" 
            element={
              <ProtectedRoute>
                <MapViewPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/field" 
            element={
              <ProtectedRoute>
                <FieldModePage />
              </ProtectedRoute>
            } 
          />
          <Route path="/logout" element={<LogoutPage />} />
        </Routes>
      </section>
      {showHeader && (
        <footer className="app-footer">
          <p>Location Tracker Web Interface</p>
        </footer>
      )}
    </>
  )
}

export default App
