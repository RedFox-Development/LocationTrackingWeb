import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const currentEvent = localStorage.getItem('currentEvent')
  
  if (!currentEvent) {
    return <Navigate to="/login" replace />
  }
  
  return children
}

export default ProtectedRoute
