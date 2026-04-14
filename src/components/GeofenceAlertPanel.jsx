import { useState, useEffect } from 'react'

/**
 * GeofenceAlertPanel - Displays geofence violations and waypoint alerts
 * Supports swipe-to-dismiss and color-coded alert types
 */
function GeofenceAlertPanel({ alerts = [], onDismiss }) {
  const [visibleAlerts, setVisibleAlerts] = useState(alerts)
  const [swipeStart, setSwipeStart] = useState(null)

  useEffect(() => {
    setVisibleAlerts(alerts)
  }, [alerts])

  const handleTouchStart = (e, alertId) => {
    setSwipeStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e, alertId) => {
    if (!swipeStart) return
    const swipeEnd = e.changedTouches[0].clientX
    const diff = swipeStart - swipeEnd

    // Swipe left > 50px = dismiss
    if (diff > 50) {
      handleDismiss(alertId)
      setSwipeStart(null)
    }
  }

  const handleDismiss = (alertId) => {
    setVisibleAlerts(visibleAlerts.filter(a => a.id !== alertId))
    if (onDismiss) {
      onDismiss(alertId)
    }
  }

  if (!visibleAlerts || visibleAlerts.length === 0) {
    return (
      <div className="geofence-alert-panel empty">
        <p className="no-alerts">No active alerts</p>
      </div>
    )
  }

  return (
    <div className="geofence-alert-panel">
      <div className="alerts-header">
        <h4>Active Alerts</h4>
        <span className="alert-count">{visibleAlerts.length}</span>
      </div>
      <div className="alerts-list">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item alert-${alert.type}`}
            onTouchStart={(e) => handleTouchStart(e, alert.id)}
            onTouchEnd={(e) => handleTouchEnd(e, alert.id)}
          >
            <div className="alert-content">
              <div className="alert-icon">
                {alert.type === 'geofence-violation' && '🚨'}
                {alert.type === 'waypoint-missed' && '⚠️'}
                {alert.type === 'waypoint-visited' && '✓'}
              </div>
              <div className="alert-text">
                <div className="alert-title">{alert.title}</div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
            <button
              className="alert-dismiss"
              onClick={() => handleDismiss(alert.id)}
              title="Dismiss alert"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default GeofenceAlertPanel
