import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
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

function WaypointAutoFit({ points, active }) {
  const map = useMap()

  useEffect(() => {
    if (!active || !Array.isArray(points) || points.length === 0) return

    // Fit to all known waypoint coordinates whenever editor is active and points change.
    // This keeps the viewport focused on the waypoint cluster.
    const bounds = points.map((point) => [point.lat, point.lon])
    map.fitBounds(bounds, {
      padding: [28, 28],
      maxZoom: 17,
      animate: false,
    })
  }, [map, points, active])

  return null
}

function WaypointEditor({ event }) {
  const [showEditor, setShowEditor] = useState(false)
  const [draftWaypoints, setDraftWaypoints] = useState([])

  const [editingWaypoint, setEditingWaypoint] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('CHECKPOINT')
  const [editPointValue, setEditPointValue] = useState(1)
  const [editIsRequired, setEditIsRequired] = useState(false)

  const WAYPOINT_TYPES = ['START', 'CHECKPOINT', 'END']

  const { data, loading, error, refetch } = useQuery(GET_WAYPOINTS, {
    variables: { eventId: event?.id },
    skip: !event?.id,
    fetchPolicy: 'network-only',
  })

  useEffect(() => {
    console.log('[WaypointEditor] Query state - eventId:', event?.id, 'skip:', !event?.id, 'loading:', loading, 'error:', error?.message)
    if (data?.waypoints) {
      console.log('[WaypointEditor] Waypoints received:', data.waypoints.length)
    }
  }, [event?.id, loading, error, data])

  const [createWaypoint, { loading: creating }] = useMutation(CREATE_WAYPOINT)
  const [updateWaypoint, { loading: updating }] = useMutation(UPDATE_WAYPOINT)
  const [deleteWaypoint, { loading: deleting }] = useMutation(DELETE_WAYPOINT)

  const waypoints = useMemo(() => data?.waypoints || [], [data])
  const isSaving = creating || updating || deleting

  const mapCenter = useMemo(() => {
    if (draftWaypoints.length > 0) {
      const lastDraft = draftWaypoints[draftWaypoints.length - 1]
      return [lastDraft.lat, lastDraft.lon]
    }
    if (waypoints.length > 0) {
      return [waypoints[0].lat, waypoints[0].lon]
    }
    return DEFAULT_CENTER
  }, [draftWaypoints, waypoints])

  const clearDrafts = () => {
    setDraftWaypoints([])
  }

  const fitPoints = useMemo(() => {
    const existing = waypoints.map((waypoint) => ({ lat: waypoint.lat, lon: waypoint.lon }))
    const drafts = draftWaypoints.map((waypoint) => ({ lat: waypoint.lat, lon: waypoint.lon }))
    return [...existing, ...drafts]
  }, [waypoints, draftWaypoints])

  const handlePointClick = (point) => {
    const sequence = waypoints.length + draftWaypoints.length + 1
    const tempWaypoint = {
      tempId: `draft-${Date.now()}-${Math.random()}`,
      lat: point[0],
      lon: point[1],
      name: `Waypoint ${sequence}`,
      is_required: false,
    }
    setDraftWaypoints((current) => [...current, tempWaypoint])
  }

  const handleDraftChange = (tempId, field, value) => {
    setDraftWaypoints((current) =>
      current.map((draft) =>
        draft.tempId === tempId
          ? {
              ...draft,
              [field]: value,
            }
          : draft
      )
    )
  }

  const handleRemoveDraft = (tempId) => {
    setDraftWaypoints((current) => current.filter((draft) => draft.tempId !== tempId))
  }

  const handleSaveDraftWaypoints = async () => {
    const validDrafts = draftWaypoints.filter((draft) => draft.name.trim())
    if (validDrafts.length === 0) {
      return
    }

    try {
      await Promise.all(
        validDrafts.map((draft) =>
          createWaypoint({
            variables: {
              eventId: event?.id,
              keycode: event?.keycode,
              name: draft.name.trim(),
              lat: draft.lat,
              lon: draft.lon,
              type: (draft.type || 'CHECKPOINT').toUpperCase(),
              pointValue: draft.pointValue || 0,
              isRequired: Boolean(draft.is_required),
            },
          })
        )
      )

      await refetch()
      clearDrafts()
    } catch (err) {
      console.error('Failed to save waypoint drafts:', err)
    }
  }

  const handleWaypointDragEnd = async (waypoint, dragEvent) => {
    const marker = dragEvent?.target
    if (!marker) {
      return
    }
    const position = marker.getLatLng()
    try {
      await updateWaypoint({
        variables: {
          waypointId: waypoint?.id,
          eventId: event?.id,
          keycode: event?.keycode,
          lat: position.lat,
          lon: position.lng,
        },
      })
      await refetch()
    } catch (err) {
      console.error('Failed to update waypoint position:', err)
    }
  }

  const handleStartEdit = (waypoint) => {
    setEditingWaypoint(waypoint.id)
    setEditName(waypoint.name)
    setEditType((waypoint.type || 'CHECKPOINT').toUpperCase())
    setEditPointValue(waypoint.pointValue || 0)
    setEditIsRequired(Boolean(waypoint.is_required))
  }

  const handleCancelEdit = () => {
    setEditingWaypoint(null)
    setEditName('')
    setEditType('checkpoint')
    setEditPointValue(0)
    setEditIsRequired(false)
  }

  const handleSaveEdit = async (waypointId) => {
    if (!editName.trim()) {
      return
    }

    try {
      await updateWaypoint({
        variables: {
          waypointId,
          eventId: event?.id,
          keycode: event?.keycode,
          name: editName.trim(),
          type: editType.toUpperCase(),
          pointValue: editPointValue,
          isRequired: editIsRequired,
        },
      })

      await refetch()
      handleCancelEdit()
    } catch (err) {
      console.error('Failed to update waypoint:', err)
    }
  }

  const handleDeleteWaypoint = async (waypointId) => {
    try {
      await deleteWaypoint({
        variables: {
          waypointId,
          eventId: event?.id,
          keycode: event?.keycode,
        },
      })

      await refetch()
      if (editingWaypoint === waypointId) {
        handleCancelEdit()
      }
    } catch (err) {
      console.error('Failed to delete waypoint:', err)
    }
  }

  const getErrorMessage = () => {
    if (!error) return null
    if (typeof error === 'string') return error
    if (error.graphQLErrors && error.graphQLErrors.length > 0) {
      return error.graphQLErrors[0].message
    }
    if (error.networkError) return error.networkError.message || 'Network error'
    if (error.message) return error.message
    return 'Failed to load waypoints'
  }

  return (
    <div className="waypoint-editor">
      <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Event Waypoints</h3>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {getErrorMessage()}
        </div>
      )}

      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Click multiple points to queue one or more waypoints, then save all at once. Existing waypoints are draggable.
      </p>

      <button
        type="button"
        onClick={() => setShowEditor((value) => !value)}
        className="btn-secondary"
        disabled={isSaving}
      >
        {showEditor ? '✕ Close waypoint editor' : '📍 Add \\ edit waypoints'}
      </button>

      {showEditor && (
        <>
          <div className="editor-map-frame" style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%' }}>
              <WaypointAutoFit points={fitPoints} active={showEditor} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ClickCapture onPointClick={handlePointClick} />

              {waypoints.map((waypoint) => (
                <Marker
                  key={waypoint.id}
                  position={[waypoint.lat, waypoint.lon]}
                  icon={createWaypointIcon(Boolean(waypoint.is_required))}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      handleWaypointDragEnd(waypoint, event)
                    },
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{waypoint.name}</strong>
                      <p>{waypoint.is_required ? 'Required' : 'Optional'}</p>
                      <p>Drag marker to fine-tune location</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {draftWaypoints.map((draft) => (
                <Marker
                  key={draft.tempId}
                  position={[draft.lat, draft.lon]}
                  icon={createWaypointIcon(Boolean(draft.is_required))}
                >
                  <Popup>
                    <strong>{draft.name || 'Draft waypoint'}</strong>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {draftWaypoints.length > 0 && (
            <div className="waypoint-form-card">
              <h5>Pending waypoints ({draftWaypoints.length})</h5>
              <div className="waypoint-list">
                {draftWaypoints.map((draft) => (
                  <div key={draft.tempId} className="waypoint-list-item" style={{ marginBottom: '0.6rem' }}>
                    <div style={{ width: '100%' }}>
                      <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                        <label>Name</label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => handleDraftChange(draft.tempId, 'name', e.target.value)}
                          placeholder="Waypoint name"
                          disabled={isSaving}
                          style={{ maxWidth: '40%' }}
                        />
                      </div>
                      <label>Type of waypoint</label>
                      <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                        <select
                          value={draft.type || 'CHECKPOINT'}
                          onChange={(e) => handleDraftChange(draft.tempId, 'type', e.target.value)}
                          disabled={isSaving}
                          style={{ maxWidth: '40%' }}
                        >
                          <option value="START">Start</option>
                          <option value="CHECKPOINT">Checkpoint</option>
                          <option value="END">End</option>
                        </select>
                      </div>
                      <label>Points</label>
                      <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                        <input
                          type="number"
                          value={draft.pointValue || 1}
                          onChange={(e) => handleDraftChange(draft.tempId, 'pointValue', parseInt(e.target.value) || 0)}
                          disabled={isSaving}
                          min="0"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(draft.is_required)}
                            onChange={(e) => handleDraftChange(draft.tempId, 'is_required', e.target.checked)}
                            disabled={isSaving}
                          />
                          Required waypoint
                        </label>
                      </div>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        Location: {draft.lat.toFixed(5)}, {draft.lon.toFixed(5)}
                      </p>
                      <div className="form-group" style={{ marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleRemoveDraft(draft.tempId)}
                          disabled={isSaving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveDraftWaypoints}
                  disabled={isSaving || draftWaypoints.every((draft) => !draft.name.trim())}
                >
                  Save all pending waypoints
                </button>
                <button type="button" className="btn-secondary" onClick={clearDrafts} disabled={isSaving}>
                  Clear pending
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
                        <button type="button" className="btn-secondary" onClick={() => {
                          if (window.confirm(`Are you sure you want to delete waypoint "${waypoint.name}"? This action cannot be undone.`)) {
                            handleDeleteWaypoint(waypoint.id)
                          }
                        }} disabled={isSaving}>
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
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label>Type</label>
                        <select value={editType} onChange={(e) => setEditType(e.target.value)} disabled={isSaving}>
                          <option value="start">Start</option>
                          <option value="checkpoint">Checkpoint</option>
                          <option value="end">End</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label>Points</label>
                        <input
                          type="number"
                          value={editPointValue}
                          onChange={(e) => setEditPointValue(parseInt(e.target.value) || 0)}
                          disabled={isSaving}
                          min="0"
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
