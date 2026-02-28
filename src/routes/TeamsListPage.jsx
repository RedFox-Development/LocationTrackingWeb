import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import EventManager from '../UI/views/eventManager'

function TeamsListPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)

  // Load event from localStorage whenever component is rendered
  useEffect(() => {
    const eventData = localStorage.getItem('currentEvent')
    const teamsData = localStorage.getItem('currentTeams')
    if (eventData && teamsData) {
      const parsedEvent = JSON.parse(eventData)
      parsedEvent.teams = JSON.parse(teamsData)
      console.log('TeamsListPage: Loaded event with teams:', parsedEvent.teams)
      setEvent(parsedEvent)
    } else {
      navigate('/setup')
    }
  }, [navigate])

  const handleViewMap = () => {
    navigate('/event/map')
  }

  if (!event) {
    return <div>Loading...</div>
  }

  return (
    <div className="teams-list-page">
      <EventManager event={event} onViewMap={handleViewMap} />
    </div>
  )
}

export default TeamsListPage
