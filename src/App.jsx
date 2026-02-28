import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { GET_TEAMS } from './api/graphql/team'

import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './routes/LoginPage'
import SetupPage from './routes/SetupPage'
import EventPage from './routes/EventPage'
import TeamsListPage from './routes/TeamsListPage'
import MapViewPage from './routes/MapViewPage'
import LogoutPage from './routes/LogoutPage'
import './UI/style/App.css'

const App = () => {
  const location = useLocation()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentEvent, setCurrentEvent] = useState(null)
  const lockSomeFeatures = true;

  useEffect(() => {
    // Check if user has event stored (means they logged in)
    const eventData = localStorage.getItem('currentEvent')
    const event = eventData ? JSON.parse(eventData) : null
    setIsLoggedIn(!!event)
    setCurrentEvent(event)
  }, [location.pathname])

  // Poll for teams data when logged in
  const { loading, error, data } = useQuery(GET_TEAMS, {
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

  // Don't show header on login and setup pages
  const showHeader = location.pathname !== '/login' && location.pathname !== '/setup'

  return (
    <>
      {showHeader && (
        <header className="app-header">
          <h1>Location Tracker - Event Manager</h1>
          <nav>
            {isLoggedIn && (
              <>
                <Link 
                  to="/event" 
                  className={location.pathname === '/event' ? 'active' : ''}
                >
                  Event Dashboard
                </Link>
                <Link 
                  to="/teams" 
                  className={location.pathname.startsWith('/teams') ? 'active' : ''}
                >
                  Teams
                </Link>
                <Link 
                  to="/event/map" 
                  className={location.pathname === '/event/map' ? 'active' : ''}
                >
                  Map
                </Link>
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
                <EventPage props={lockSomeFeatures} />
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
