/**
 * TeamStatusBar - Quick team status indicators and selector
 * Shows team name, last location, and quick actions
 */
function TeamStatusBar({ teams = [], selectedTeam, onSelectTeam }) {
  return (
    <div className="team-status-bar">
      <div className="teams-scroll">
        {teams.map((team) => (
          <button
            key={team.id}
            className={`team-indicator ${selectedTeam?.id === team.id ? 'active' : ''}`}
            onClick={() => onSelectTeam(team)}
            style={{
              borderLeftColor: team.color || '#3B82F6',
            }}
          >
            <div className="team-dot" style={{ backgroundColor: team.color || '#3B82F6' }}></div>
            <div className="team-name">{team.name}</div>
            <div className="team-status">
              {team.activated ? (
                <span className="status-active">Active</span>
              ) : (
                <span className="status-inactive">Inactive</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TeamStatusBar
