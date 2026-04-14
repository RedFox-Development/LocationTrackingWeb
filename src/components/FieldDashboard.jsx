import { useState, useEffect } from 'react'
import FieldMap from './FieldMap'
import GeofenceAlertPanel from './GeofenceAlertPanel'
import TeamStatusBar from './TeamStatusBar'
import '../UI/style/field-mode.css'

/**
 * FieldDashboard - Main container for field organizer monitoring
 * Displays map, team locations, and geofence alerts in mobile-optimized layout
 */
function FieldDashboard({ event, teams = [], waypoints = [], geofences = [] }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [isFullScreen, setIsFullScreen] = useState(false)

  console.log('[FieldDashboard] Received props - event:', event?.name, 'teams:', teams?.length, 'geofences:', geofences?.length, 'waypoints:', waypoints?.length)

  useEffect(() => {
    if (teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0])
    }
  }, [teams, selectedTeam])

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

  const handleDismissAlert = (alertId) => {
    setAlerts(alerts.filter(a => a.id !== alertId))
  }

  return (
    <div className={`field-dashboard ${isFullScreen ? 'full-screen' : ''}`}>
      {/* Map Area - 60% of viewport height */}
      <div className="field-map-container">
        <FieldMap
          event={event}
          teams={teams}
          waypoints={waypoints}
          geofences={geofences}
          selectedTeam={selectedTeam}
          onTeamSelect={setSelectedTeam}
        />
        <button className="fullscreen-toggle" onClick={toggleFullScreen} title="Toggle fullscreen">
          {/* SVG Icon will be styled via CSS */}
          <span className="icon-fullscreen"></span>
        </button>
      </div>

      {/* Alert Panel - Shown unless fullscreen */}
      {!isFullScreen && (
        <div className="field-alerts-container">
          <GeofenceAlertPanel
            alerts={alerts}
            onDismiss={handleDismissAlert}
          />
        </div>
      )}

      {/* Team Status Bar - Shown unless fullscreen */}
      {!isFullScreen && (
        <div className="field-teams-container">
          <TeamStatusBar
            teams={teams}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
          />
        </div>
      )}

      {/* Footer */}
      {!isFullScreen && (
        <div className="field-footer">
          <div className="event-info">
            <h3>{event?.name}</h3>
            <span className="team-count">{teams.length} teams</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default FieldDashboard
