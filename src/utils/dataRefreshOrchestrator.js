import { trimTeamsToLimit } from './updateLimits'

export const REFRESH_INTERVALS_MS = {
  event: 30000,
  teams: 30000,
  waypoints: 300000,
}

export const FETCH_POLICIES = {
  event: 'network-only',
  teams: 'cache-and-network',
  waypoints: 'cache-and-network',
}

export const readLocalJson = (key) => {
  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const writeLocalJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const getEventRefreshQueryOptions = (eventId) => ({
  variables: { id: eventId },
  skip: !eventId,
  fetchPolicy: FETCH_POLICIES.event,
  pollInterval: REFRESH_INTERVALS_MS.event,
})

export const getTeamsRefreshQueryOptions = (eventId, limit) => ({
  variables: { eventId, limit },
  skip: !eventId,
  fetchPolicy: FETCH_POLICIES.teams,
  notifyOnNetworkStatusChange: true,
  pollInterval: REFRESH_INTERVALS_MS.teams,
})

export const getWaypointsRefreshQueryOptions = (eventId) => ({
  variables: { eventId },
  skip: !eventId,
  fetchPolicy: FETCH_POLICIES.waypoints,
  pollInterval: REFRESH_INTERVALS_MS.waypoints,
})

export const normalizeTeamsSnapshot = (teams, limit) => {
  if (!Array.isArray(teams)) return []
  return trimTeamsToLimit(teams, limit)
}

export const persistEventSnapshot = (event) => {
  if (!event) return
  writeLocalJson('currentEvent', event)
}

export const persistTeamsSnapshot = (teams, limit) => {
  const normalized = normalizeTeamsSnapshot(teams, limit)
  writeLocalJson('currentTeams', normalized)
  return normalized
}

export const persistWaypointsSnapshot = (waypoints) => {
  const normalized = Array.isArray(waypoints) ? waypoints : []
  writeLocalJson('currentWaypoints', normalized)
  return normalized
}
