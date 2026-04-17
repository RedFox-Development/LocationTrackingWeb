import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import MapView from '../UI/views/mapView'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_EVENT } from '../api/graphql/event'
import { mergeEventWithAuthFields } from '../utils/eventAccess'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'
import { preloadEventDataBundle } from '../utils/eventBootstrap'
import {
  getEventRefreshQueryOptions,
  getTeamsRefreshQueryOptions,
  persistEventSnapshot,
  persistTeamsSnapshot,
  readLocalJson,
} from '../utils/dataRefreshOrchestrator'

function MapViewPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [teams, setTeams] = useState([])
  const locationLimit = getTeamUpdateLimit(event?.update_frequency, event?.access_level || 'manage')

  const { data: eventData } = useQuery(GET_EVENT, getEventRefreshQueryOptions(event?.id))

  const { data: teamsData } = useQuery(GET_TEAMS, getTeamsRefreshQueryOptions(event?.id, locationLimit))

  useEffect(() => {
    const loadMapData = async () => {
      const currentEvent = readLocalJson('currentEvent')
      const currentTeams = readLocalJson('currentTeams')
      const currentWaypoints = readLocalJson('currentWaypoints')

      if (!currentEvent) {
        navigate('/login')
        return
      }

      setEvent(currentEvent)

      const bootstrapLimit = getTeamUpdateLimit(currentEvent?.update_frequency, currentEvent?.access_level || 'manage')
      const parsedTeams = Array.isArray(currentTeams) ? currentTeams : []

      if (parsedTeams.length > 0) {
        setTeams(trimTeamsToLimit(parsedTeams, bootstrapLimit))
      }

      // On browser reload ensure event, teams and waypoints are restored to localStorage.
      if (!currentWaypoints || parsedTeams.length === 0) {
        try {
          const bundle = await preloadEventDataBundle(currentEvent.id)
          if (bundle?.event) {
            setEvent((current) => mergeEventWithAuthFields(bundle.event, current || currentEvent))
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
      const normalizedTeams = persistTeamsSnapshot(teamsData.teams, locationLimit)
      setTeams(normalizedTeams)
    }
  }, [teamsData, locationLimit])

  useEffect(() => {
    if (!teams || teams.length === 0) return

    const trimmedTeams = trimTeamsToLimit(teams, locationLimit)
    if (JSON.stringify(trimmedTeams) === JSON.stringify(teams)) {
      return
    }

    setTeams(trimmedTeams)
    persistTeamsSnapshot(trimmedTeams, locationLimit)
  }, [teams, locationLimit])

  useEffect(() => {
    if (eventData?.event) {
      setEvent((current) => {
        const merged = mergeEventWithAuthFields(eventData.event, current)
        persistEventSnapshot(merged)
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
