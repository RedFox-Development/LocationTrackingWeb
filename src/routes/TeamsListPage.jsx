import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import EventManager from '../UI/views/eventManager'
import { GET_TEAMS } from '../api/graphql/team'
import { hasManageAccess } from '../utils/eventAccess'
import { getTeamUpdateLimit, trimTeamsToLimit } from '../utils/updateLimits'

const loadStoredManageEvent = () => {
  const eventData = localStorage.getItem('currentEvent')
  if (!eventData) return null

  try {
    const parsedEvent = JSON.parse(eventData)
    if (!hasManageAccess(parsedEvent)) return null

    const storedTeamsData = localStorage.getItem('currentTeams')
    const teamUpdateLimit = getTeamUpdateLimit(parsedEvent?.update_frequency, parsedEvent?.access_level)
    if (storedTeamsData) {
      parsedEvent.teams = trimTeamsToLimit(JSON.parse(storedTeamsData), teamUpdateLimit)
    }

    return parsedEvent
  } catch {
    return null
  }
}

function TeamsListPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(() => loadStoredManageEvent())
  const teamUpdateLimit = getTeamUpdateLimit(event?.update_frequency, event?.access_level)

  const { error: teamsError } = useQuery(GET_TEAMS, {
    variables: { eventId: event?.id, limit: teamUpdateLimit },
    skip: !event?.id,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    onCompleted: (data) => {
      if (!data?.teams) return

      const trimmedTeams = trimTeamsToLimit(data.teams, teamUpdateLimit)
      localStorage.setItem('currentTeams', JSON.stringify(trimmedTeams))
      setEvent((currentEvent) => {
        if (!currentEvent) return currentEvent
        return {
          ...currentEvent,
          teams: trimmedTeams,
        }
      })
    },
  })

  useEffect(() => {
    if (teamsError) {
      console.error('[TeamsListPage] Teams query error:', teamsError?.message)
    }
  }, [teamsError])

  useEffect(() => {
    const eventData = localStorage.getItem('currentEvent')
    if (!eventData) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const parsedEvent = JSON.parse(eventData)
      if (!hasManageAccess(parsedEvent)) {
        navigate('/event/map', { replace: true })
      }
    } catch {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  const loadEventData = useCallback(() => {
    const parsedEvent = loadStoredManageEvent()
    if (parsedEvent) {
      console.log('TeamsListPage: Loaded event with teams:', parsedEvent.teams)
      setEvent(parsedEvent)
    } else {
      const eventData = localStorage.getItem('currentEvent')
      if (!eventData) {
        navigate('/login')
        return
      }

      try {
        const parsedEvent = JSON.parse(eventData)
        if (!hasManageAccess(parsedEvent)) {
          navigate('/event/map', { replace: true })
          return
        }
      } catch {
        navigate('/login')
      }
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
      <EventManager event={event} onViewMap={handleViewMap} onTeamsChanged={loadEventData} />
    </div>
  )
}

export default TeamsListPage
