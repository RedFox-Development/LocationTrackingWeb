import { useNavigate } from 'react-router-dom'
import EventSetup from '../UI/views/eventSetup'

function SetupPage() {
  const handleEventCreated = () => {
    // Event created - success screen will show with navigation buttons
  }

  return (
    <div className="setup-page">
      <EventSetup onEventCreated={handleEventCreated} />
    </div>
  )
}

export default SetupPage
