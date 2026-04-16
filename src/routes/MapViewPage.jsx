import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import MapView from '../UI/views/mapView'
import { GET_TEAMS_WITH_UPDATES } from '../api/graphql/team'
import { GET_EVENT } from '../api/graphql/event'
import { mergeEventWithAuthFields } from '../utils/eventAccess'

function MapViewPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [teams, setTeams] = useState([])
  const updateFrequencyMs = event?.update_frequency || 10000
  const locationLimit = Math.max(1, Math.floor((30 * 60000) / updateFrequencyMs))

  const { data: eventData } = useQuery(GET_EVENT, {
    variables: { id: event?.id },
    skip: !event?.id,
    fetchPolicy: 'network-only',
    pollInterval: 30000,
  })

  const { data: teamsData } = useQuery(GET_TEAMS_WITH_UPDATES, {
    variables: { eventId: event?.id, limit: locationLimit },
    skip: !event?.id,
    fetchPolicy: 'cache-and-network',
    pollInterval: 30000,
  })

  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    const currentTeams = localStorage.getItem('currentTeams')
    if (currentEvent && currentTeams) {
      setEvent(JSON.parse(currentEvent))
      setTeams(JSON.parse(currentTeams))
    } else if (currentEvent) {
      setEvent(JSON.parse(currentEvent))
    } else {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    if (teamsData?.teams) {
      const trimmedTeams = teamsData.teams.map((team) => ({
        ...team,
        updates: Array.isArray(team.updates) ? team.updates.slice(0, locationLimit) : [],
      }))
      setTeams(trimmedTeams)
      localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
    }
  }, [teamsData, locationLimit])

  useEffect(() => {
    if (eventData?.event) {
      setEvent((current) => {
        const merged = mergeEventWithAuthFields(eventData.event, current)
        localStorage.setItem('currentEvent', JSON.stringify(merged))
        return merged
      })
    }
  }, [eventData])

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
