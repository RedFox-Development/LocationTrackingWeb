import { graphqlClient } from '../api/graphql/graphqlClient'
import { GET_EVENT } from '../api/graphql/event'
import { GET_TEAMS } from '../api/graphql/team'
import { GET_WAYPOINTS } from '../api/graphql/waypoints'
import { mergeEventWithAuthFields } from './eventAccess'

const setLocalJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

const syncGeofenceCache = (event) => {
  if (!event?.id || !event?.geofence_data) return

  try {
    const parsed = JSON.parse(event.geofence_data)
    if (Array.isArray(parsed)) {
      localStorage.setItem(`geofence_${event.id}`, JSON.stringify(parsed))
    }
  } catch (error) {
    console.warn('[eventBootstrap] Failed to parse geofence_data:', error)
  }
}

// Stage 1: persist minimal event identity immediately after login.
export const storeBasicEventData = (event) => {
  if (!event) return
  setLocalJson('currentEvent', event)
}

// Stage 2: load and persist event details used by map and management views.
export const preloadEventDataBundle = async (eventId) => {
  if (!eventId) {
    throw new Error('Missing event id for data preload')
  }

  const [eventResult, teamsResult, waypointsResult] = await Promise.all([
    graphqlClient.query({
      query: GET_EVENT,
      variables: { id: eventId },
      fetchPolicy: 'network-only',
    }),
    graphqlClient.query({
      query: GET_TEAMS,
      variables: { eventId },
      fetchPolicy: 'network-only',
    }),
    graphqlClient.query({
      query: GET_WAYPOINTS,
      variables: { eventId },
      fetchPolicy: 'network-only',
    }),
  ])

  const event = eventResult?.data?.event
  const existingEvent = (() => {
    const raw = localStorage.getItem('currentEvent')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  const teams = teamsResult?.data?.teams || []
  const waypoints = waypointsResult?.data?.waypoints || []

  if (event) {
    const mergedEvent = mergeEventWithAuthFields(event, existingEvent)
    setLocalJson('currentEvent', mergedEvent)
    syncGeofenceCache(mergedEvent)
  }

  setLocalJson('currentTeams', teams)
  setLocalJson('currentWaypoints', waypoints)

  return { event, teams, waypoints }
}
