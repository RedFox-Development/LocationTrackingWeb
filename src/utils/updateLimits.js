export const TEAM_UPDATE_WINDOW_MINUTES = {
  manage: 30,
  view: 30,
  field: 10,
}

export const getTeamUpdateLimit = (updateFrequencyMs, accessLevel = 'manage') => {
  const safeUpdateFrequencyMs = Math.max(1, Number(updateFrequencyMs) || 10000)
  const minutes = TEAM_UPDATE_WINDOW_MINUTES[accessLevel] || TEAM_UPDATE_WINDOW_MINUTES.manage
  return Math.max(1, Math.floor((minutes * 60000) / safeUpdateFrequencyMs))
}

export const trimTeamsToLimit = (teams, limit) => {
  if (!Array.isArray(teams)) return []

  return teams.map((team) => ({
    ...team,
    updates: Array.isArray(team.updates) ? team.updates.slice(0, limit) : [],
  }))
}