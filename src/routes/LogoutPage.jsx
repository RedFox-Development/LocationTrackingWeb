import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function LogoutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    // Clear all stored data
    localStorage.removeItem('currentEvent')
    localStorage.removeItem('currentTeams')
    localStorage.removeItem('currentLocations')
    
    // Redirect to login
    navigate('/login')
  }, [navigate])

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Logging out...</p>
    </div>
  )
}

export default LogoutPage
