import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import EventManager from '../UI/views/eventManager'
import { GET_TEAMS } from '../api/graphql/team'
import { hasManageAccess } from '../utils/eventAccess'

function TeamsListPage() {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)

  const { data: teamsData, error: teamsError } = useQuery(GET_TEAMS, {
    variables: { eventId: event?.id },
    skip: !event?.id,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })

  useEffect(() => {
    if (teamsError) {
      console.error('[TeamsListPage] Teams query error:', teamsError?.message)
    }
  }, [teamsError])

  useEffect(() => {
    if (!event || !teamsData?.teams) return

    setEvent((currentEvent) => {
      if (!currentEvent) return currentEvent

      const currentTeams = currentEvent.teams || []
      const nextTeams = teamsData.teams
      if (JSON.stringify(currentTeams) === JSON.stringify(nextTeams)) {
        return currentEvent
      }

      const updatedEvent = {
        ...currentEvent,
        teams: nextTeams,
      }

      localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))
      localStorage.setItem('currentTeams', JSON.stringify(nextTeams))
      return updatedEvent
    })
  }, [event, teamsData?.teams])

  // Load event from localStorage
  const loadEventData = useCallback(() => {
    const eventData = localStorage.getItem('currentEvent')
    if (eventData) {
      const parsedEvent = JSON.parse(eventData)
      if (!hasManageAccess(parsedEvent)) {
        navigate('/event/map', { replace: true })
        return
      }
      const storedTeamsData = localStorage.getItem('currentTeams')
      if (storedTeamsData) {
        parsedEvent.teams = JSON.parse(storedTeamsData)
      }
      console.log('TeamsListPage: Loaded event with teams:', parsedEvent.teams)
      setEvent(parsedEvent)
    } else {
      navigate('/login')
    }
  }, [navigate])

  // Load event from localStorage whenever component is rendered
  useEffect(() => {
    loadEventData()
  }, [loadEventData])

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
