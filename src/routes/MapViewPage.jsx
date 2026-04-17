import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import MapView from '../UI/views/mapView'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_EVENT } from '../api/graphql/event'
import { mergeEventWithAuthFields } from '../utils/eventAccess'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'
import { preloadEventDataBundle } from '../utils/eventBootstrap'

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
    const loadMapData = async () => {
      const currentEvent = localStorage.getItem('currentEvent')
      const currentTeams = localStorage.getItem('currentTeams')
      const currentWaypoints = localStorage.getItem('currentWaypoints')

      if (!currentEvent) {
        navigate('/login')
        return
      }

      const parsedEvent = JSON.parse(currentEvent)
      setEvent(parsedEvent)

      const bootstrapLimit = getTeamUpdateLimit(parsedEvent?.update_frequency, parsedEvent?.access_level || 'manage')

      if (currentTeams) {
        setTeams(trimTeamsToLimit(JSON.parse(currentTeams), bootstrapLimit))
      }

      // On browser reload ensure event, teams and waypoints are restored to localStorage.
      if (!currentTeams || !currentWaypoints) {
        try {
          const bundle = await preloadEventDataBundle(parsedEvent.id)
          if (bundle?.event) {
            setEvent((current) => mergeEventWithAuthFields(bundle.event, current || parsedEvent))
          }
          setTeams(trimTeamsToLimit(bundle?.teams || [], bootstrapLimit))
        } catch (error) {
          console.error('[MapViewPage] Failed to preload event bundle on reload:', error)
        }
      }
    }

    loadMapData()
  }, [navigate])

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
