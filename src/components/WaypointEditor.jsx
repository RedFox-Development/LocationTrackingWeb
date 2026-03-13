import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import {
  CREATE_WAYPOINT,
  DELETE_WAYPOINT,
  GET_WAYPOINTS,
  UPDATE_WAYPOINT,
} from '../api/graphql/waypoints'

const DEFAULT_CENTER = [20, 0]

const createWaypointIcon = (isRequired) => {
  const fillColor = isRequired ? '#dc2626' : '#2563eb'
  const strokeColor = isRequired ? '#7f1d1d' : '#1d4ed8'

  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 4.61 5.07 10.83 6.02 11.96a1.26 1.26 0 0 0 1.96 0C13.93 19.83 19 13.61 19 9c0-3.87-3.13-7-7-7z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.3"/>
        <circle cx="12" cy="9" r="3.1" fill="white"/>
      </svg>
    `)}`,
    iconSize: [28, 28],
    iconAnchor: [14, 27],
    popupAnchor: [0, -24],
  })
}

function ClickCapture({ onPointClick }) {
  useMapEvents({
    click: (event) => {
      onPointClick([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

function WaypointEditor({ event }) {
  const [showEditor, setShowEditor] = useState(false)
  const [pendingClick, setPendingClick] = useState(null)
  const [newName, setNewName] = useState('')
  const [newIsRequired, setNewIsRequired] = useState(false)

  const [editingWaypoint, setEditingWaypoint] = useState(null)
  const [editName, setEditName] = useState('')
  const [editIsRequired, setEditIsRequired] = useState(false)

  const { data, loading, error, refetch } = useQuery(GET_WAYPOINTS, {
    variables: { eventId: event.id },
    fetchPolicy: 'network-only',
  })

  const [createWaypoint, { loading: creating }] = useMutation(CREATE_WAYPOINT)
  const [updateWaypoint, { loading: updating }] = useMutation(UPDATE_WAYPOINT)
  const [deleteWaypoint, { loading: deleting }] = useMutation(DELETE_WAYPOINT)

  const waypoints = useMemo(() => data?.waypoints || [], [data])
  const isSaving = creating || updating || deleting

  const mapCenter = useMemo(() => {
    if (pendingClick) {
      return pendingClick
    }
    if (waypoints.length > 0) {
      return [waypoints[0].lat, waypoints[0].lon]
    }
    return DEFAULT_CENTER
  }, [pendingClick, waypoints])

  const resetCreateState = () => {
    setPendingClick(null)
    setNewName('')
    setNewIsRequired(false)
  }

  const handleSaveNewWaypoint = async () => {
    if (!pendingClick || !newName.trim()) {
      return
    }

    await createWaypoint({
      variables: {
        eventId: event.id,
        keycode: event.keycode,
        name: newName.trim(),
        lat: pendingClick[0],
        lon: pendingClick[1],
        isRequired: newIsRequired,
      },
    })

    await refetch()
    resetCreateState()
  }

  const handleStartEdit = (waypoint) => {
    setEditingWaypoint(waypoint.id)
    setEditName(waypoint.name)
    setEditIsRequired(Boolean(waypoint.is_required))
  }

  const handleCancelEdit = () => {
    setEditingWaypoint(null)
    setEditName('')
    setEditIsRequired(false)
  }

  const handleSaveEdit = async (waypointId) => {
    if (!editName.trim()) {
      return
    }

    await updateWaypoint({
      variables: {
        waypointId,
        eventId: event.id,
        keycode: event.keycode,
        name: editName.trim(),
        isRequired: editIsRequired,
      },
    })

    await refetch()
    handleCancelEdit()
  }

  const handleDeleteWaypoint = async (waypointId) => {
    await deleteWaypoint({
      variables: {
        waypointId,
        eventId: event.id,
        keycode: event.keycode,
      },
    })

    await refetch()
    if (editingWaypoint === waypointId) {
      handleCancelEdit()
    }
  }

  return (
    <div className="waypoint-editor">
      <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Waypoints</h4>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error.message || 'Failed to load waypoints'}
        </div>
      )}

      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Click the map to place a waypoint and mark it as optional or required.
      </p>

      <button
        type="button"
        onClick={() => setShowEditor((value) => !value)}
        className="btn-secondary"
        disabled={isSaving}
      >
        {showEditor ? 'Hide waypoint editor' : 'Show waypoint editor'}
      </button>

      {showEditor && (
        <>
          <div style={{ height: '360px', marginTop: '1rem', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ClickCapture onPointClick={setPendingClick} />

              {waypoints.map((waypoint) => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.lat, waypoint.lon]}
                  icon={createWaypointIcon(Boolean(waypoint.is_required))}
                >
                  <Popup>
                    <div>
                      <strong>{waypoint.name}</strong>
                      <p>{waypoint.is_required ? 'Required' : 'Optional'}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {pendingClick && (
                <Marker position={pendingClick} icon={createWaypointIcon(newIsRequired)}>
                  <Popup>
                    <strong>New waypoint location</strong>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          {pendingClick && (
            <div className="waypoint-form-card">
              <h5>Add waypoint</h5>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Waypoint name"
                  disabled={isSaving}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={newIsRequired}
                  onChange={(e) => setNewIsRequired(e.target.checked)}
                  disabled={isSaving}
                />
                Required waypoint
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-primary" onClick={handleSaveNewWaypoint} disabled={isSaving || !newName.trim()}>
                  Save waypoint
                </button>
                <button type="button" className="btn-secondary" onClick={resetCreateState} disabled={isSaving}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="waypoint-list">
            <h5 style={{ marginBottom: '0.75rem' }}>
              Existing waypoints ({loading ? '...' : waypoints.length})
            </h5>
            {waypoints.length === 0 && !loading && <p className="empty-state">No waypoints created yet</p>}
            {waypoints.map((waypoint) => {
              const isEditing = editingWaypoint === waypoint.id
              return (
                <div key={waypoint.id} className="waypoint-list-item">
                  {!isEditing && (
                    <>
                      <div>
                        <strong>{waypoint.name}</strong>
                        <p style={{ color: 'var(--text-secondary)' }}>
                          {waypoint.is_required ? 'Required' : 'Optional'}
                          {' | '}
                          {waypoint.lat.toFixed(5)}, {waypoint.lon.toFixed(5)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn-secondary" onClick={() => handleStartEdit(waypoint)} disabled={isSaving}>
                          Edit
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => handleDeleteWaypoint(waypoint.id)} disabled={isSaving}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}

                  {isEditing && (
                    <div style={{ width: '100%' }}>
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label>Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isSaving}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={editIsRequired}
                          onChange={(e) => setEditIsRequired(e.target.checked)}
                          disabled={isSaving}
                        />
                        Required waypoint
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleSaveEdit(waypoint.id)}
                          disabled={isSaving || !editName.trim()}
                        >
                          Save
                        </button>
                        <button type="button" className="btn-secondary" onClick={handleCancelEdit} disabled={isSaving}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default WaypointEditor
