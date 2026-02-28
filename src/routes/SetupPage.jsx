import { useNavigate } from 'react-router-dom'
import EventSetup from '../UI/views/eventSetup'

function SetupPage() {
  const navigate = useNavigate()

  const handleEventCreated = () => {
    navigate('/event')
  }

  return (
    <div className="setup-page">
      <EventSetup onEventCreated={handleEventCreated} />
    </div>
  )
}

export default SetupPage
