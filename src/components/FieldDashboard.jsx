import { useState, useEffect, useRef } from 'react'
import FieldMap from './FieldMap'
import GeofenceAlertPanel from './GeofenceAlertPanel'
import TeamStatusBar from './TeamStatusBar'
import { isPointInPolygon } from '../utils/geofence'
import '../UI/style/field-mode.css'

/**
 * FieldDashboard - Main container for field organizer monitoring
 * Displays map, team locations, and geofence alerts in mobile-optimized layout
 */
function FieldDashboard({ event, teams = [], waypoints = [], geofences = [], isUpdating = false }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [activeTab, setActiveTab] = useState('alerts')
  const geofenceBreachesRef = useRef({})
  const alertIdCounterRef = useRef(0)

  console.log('[FieldDashboard] Received props - event:', event?.name, 'teams:', teams?.length, 'geofences:', geofences?.length, 'waypoints:', waypoints?.length, 'isUpdating:', isUpdating)

  useEffect(() => {
    if (teams.length > 0 && !selectedTeam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTeam(teams[0])
    }
  }, [teams, selectedTeam])

  // Generate alerts from team positions and geofence
  useEffect(() => {
    if (!geofences || geofences.length === 0 || !Array.isArray(teams) || teams.length === 0) {
      return
    }

    // Normalize geofences to single polygon
    let activeGeofence = null
    if (Array.isArray(geofences[0]) && typeof geofences[0][0] === 'number') {
      // Single polygon: [[lat1, lon1], [lat2, lon2], ...]
      activeGeofence = geofences
    } else if (Array.isArray(geofences[0]) && Array.isArray(geofences[0][0])) {
      // Multiple polygons: use first one
      activeGeofence = geofences[0]
    }

    if (!activeGeofence || activeGeofence.length < 3) return

    const newAlerts = []
    const breaches = { ...geofenceBreachesRef.current }

    // Check geofence breaches
    teams.forEach((team) => {
      if (!team.updates || team.updates.length === 0) return

      const latestUpdate = team.updates[0]
      if (!latestUpdate.lat || !latestUpdate.lon) return

      const isInside = isPointInPolygon(latestUpdate.lat, latestUpdate.lon, activeGeofence)

      if (!isInside) {
        if (!breaches[team.id]) {
          // New breach detected
          const alertId = `breach-${Date.now()}-${alertIdCounterRef.current++}`
          newAlerts.push({
            id: alertId,
            type: 'geofence-violation',
            title: `${team.name} Outside Geofence`,
            message: `Position: [${latestUpdate.lat.toFixed(4)}, ${latestUpdate.lon.toFixed(4)}]`,
            timestamp: latestUpdate.timestamp,
          })
          breaches[team.id] = true
        }
      } else if (breaches[team.id]) {
        // Team returned to geofence
        delete breaches[team.id]
      }
    })

    geofenceBreachesRef.current = breaches
    if (newAlerts.length > 0) {
      setAlerts((prevAlerts) => [...newAlerts, ...prevAlerts].slice(0, 20)) // Keep last 20 alerts
    }
  }, [teams, geofences, waypoints])

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

      {/* Tab Section - Alerts and Teams */}
      {!isFullScreen && (
        <div className="field-tabs-section">
          <div className="field-tabs-header">
            <button
              className={`field-tab ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              Alerts
            </button>
            <button
              className={`field-tab ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              Teams
            </button>
          </div>
          <div className="field-tabs-content">
            {activeTab === 'alerts' && (
              <div className="field-alerts-container">
                <GeofenceAlertPanel
                  alerts={alerts}
                  onDismiss={handleDismissAlert}
                />
              </div>
            )}
            {activeTab === 'teams' && (
              <div className="field-teams-container">
                <TeamStatusBar
                  teams={teams}
                  selectedTeam={selectedTeam}
                  onSelectTeam={setSelectedTeam}
                />
              </div>
            )}
          </div>
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
