import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import MapView from '../UI/views/mapView'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_EVENT } from '../api/graphql/event'
import { mergeEventWithAuthFields } from '../utils/eventAccess'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'

function MapViewPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [teams, setTeams] = useState([])
  const locationLimit = getTeamUpdateLimit(event?.update_frequency, event?.access_level || 'manage')

  const { data: eventData } = useQuery(GET_EVENT, {
    variables: { id: event?.id },
    skip: !event?.id,
    fetchPolicy: 'network-only',
    pollInterval: 30000,
  })

  const { data: teamsData } = useQuery(GET_TEAMS, {
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
      setTeams(trimTeamsToLimit(JSON.parse(currentTeams), locationLimit))
    } else if (currentEvent) {
      setEvent(JSON.parse(currentEvent))
    } else {
      navigate('/login')
    }
  }, [navigate, locationLimit])

  useEffect(() => {
    if (teamsData?.teams) {
      const trimmedTeams = trimTeamsToLimit(teamsData.teams, locationLimit)
      setTeams(trimmedTeams)
      localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
    }
  }, [teamsData, locationLimit])

  useEffect(() => {
    if (!teams || teams.length === 0) return

    const trimmedTeams = trimTeamsToLimit(teams, locationLimit)
    if (JSON.stringify(trimmedTeams) === JSON.stringify(teams)) {
      return
    }

    setTeams(trimmedTeams)
    localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
  }, [teams, locationLimit])

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
