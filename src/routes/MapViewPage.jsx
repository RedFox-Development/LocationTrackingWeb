import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView from '../UI/views/mapView'

function MapViewPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [teams, setTeams] = useState([])

  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    const currentTeams = localStorage.getItem('currentTeams')
    if (currentEvent && currentTeams) {
      setEvent(JSON.parse(currentEvent))
      setTeams(JSON.parse(currentTeams))
    } else {
      navigate('/login')
    }
  }, [navigate])

  if (!event || !event.id) {
    return null
  }

  return (
    <div className="map-view-page">
      <MapView event={event} teams={teams} />
    </div>
  )
}

export default MapViewPage
