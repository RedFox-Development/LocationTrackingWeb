import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const navigate = useNavigate()
  const currentEvent = localStorage.getItem('currentEvent')
  const currentTeams = localStorage.getItem('currentTeams')
  
  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!currentEvent) {
      navigate('/login', { replace: true })
      return
    }
    
    // On mount/refresh, ensure data is loaded from localStorage
    try {
      const event = JSON.parse(currentEvent)
      const teams = currentTeams ? JSON.parse(currentTeams) : []
      
      // Validate that event has required fields
      if (!event.id || !event.name || (!event.keycode && !event.view_keycode && !event.field_keycode)) {
        console.error('[ProtectedRoute] Invalid event data, redirecting to login')
        localStorage.removeItem('currentEvent')
        localStorage.removeItem('currentTeams')
        navigate('/login', { replace: true })
        return
      }
      
      console.log('[ProtectedRoute] Loaded event:', event.name, 'with', teams.length, 'teams')
    } catch (error) {
      console.error('[ProtectedRoute] Error parsing stored data:', error)
      localStorage.removeItem('currentEvent')
      localStorage.removeItem('currentTeams')
      navigate('/login', { replace: true })
    }
  }, [])
  
  if (!currentEvent) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default ProtectedRoute
