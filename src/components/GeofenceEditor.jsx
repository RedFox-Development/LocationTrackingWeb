/**
 * Geofence Editor Component
 * Allows users to view and edit event geofence
 */

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet'
import { EditControl } from 'react-leaflet-draw'
import { useMutation } from '@apollo/client/react'
import { UPDATE_EVENT_GEOFENCE, DELETE_EVENT_GEOFENCE } from '../api/graphql/event'
import { getGeofence, saveGeofence } from '../utils/geofence'
import 'leaflet-draw/dist/leaflet.draw.css'

function GeofenceEditor({ event, onGeofenceChange }) {
  // Initialize geofence from event object or localStorage
  const [geofence, setGeofence] = useState(() => {
    if (event?.geofence_data) {
      try {
        return JSON.parse(event.geofence_data)
      } catch (e) {
        console.warn('Failed to parse geofence_data from event:', e)
      }
    }
    // Fall back to localStorage
    if (event?.id) {
      return getGeofence(event.id) || null
    }
    return null
  })
  const [showGeofenceMap, setShowGeofenceMap] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState(null)

  // Apollo mutations
  const [updateGeofence] = useMutation(UPDATE_EVENT_GEOFENCE, {
    onCompleted: (data) => {
      console.log('[GeofenceEditor] Geofence saved to API:', data)
      // Update localStorage as backup
      if (geofence) {
        saveGeofence(event.id, geofence)
      }
      setApiError(null)
    },
    onError: (error) => {
      console.error('[GeofenceEditor] Error saving geofence to API:', error)
      setApiError(error.message || 'Failed to save geofence')
    }
  })

  const [deleteGeofenceApi] = useMutation(DELETE_EVENT_GEOFENCE, {
    onCompleted: (data) => {
      console.log('[GeofenceEditor] Geofence deleted from API:', data)
      // Update localStorage
      deleteGeofence(event.id)
      setApiError(null)
    },
    onError: (error) => {
      console.error('[GeofenceEditor] Error deleting geofence from API:', error)
      setApiError(error.message || 'Failed to delete geofence')
    }
  })

  // Update geofence when event changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (event?.id) {
      // Try to get from event object first, then localStorage
      if (event.geofence_data) {
        try {
          setGeofence(JSON.parse(event.geofence_data))
        } catch (e) {
          const stored = getGeofence(event.id)
          setGeofence(stored || null)
        }
      } else {
        const stored = getGeofence(event.id)
        setGeofence(stored || null)
      }
    }
  }, [event?.id])

  const handleGeofenceCreate = async (e) => {
    const layer = e.layer
    const coords = layer.toLatLngs()
    const polygon = coords.map((point) => [point.lat, point.lng])

    setGeofence(polygon)
    setApiLoading(true)

    try {
      await updateGeofence({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          geofenceData: JSON.stringify(polygon)
        }
      })
      
      if (onGeofenceChange) {
        onGeofenceChange(polygon)
      }

      console.log('[GeofenceEditor] Geofence created:', polygon)
    } catch (error) {
      console.error('[GeofenceEditor] Error creating geofence:', error)
    } finally {
      setApiLoading(false)
    }
  }

  const handleGeofenceEdit = async (e) => {
    const layers = e.layers
    
    let updatedPolygon = null
    layers.forEach((layer) => {
      const coords = layer.toLatLngs()
      updatedPolygon = coords.map((point) => [point.lat, point.lng])
    })

    if (!updatedPolygon) return

    setGeofence(updatedPolygon)
    setApiLoading(true)

    try {
      await updateGeofence({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          geofenceData: JSON.stringify(updatedPolygon)
        }
      })
      
      if (onGeofenceChange) {
        onGeofenceChange(updatedPolygon)
      }

      console.log('[GeofenceEditor] Geofence edited:', updatedPolygon)
    } catch (error) {
      console.error('[GeofenceEditor] Error editing geofence:', error)
    } finally {
      setApiLoading(false)
    }
  }

  const handleGeofenceDelete = async () => {
    setApiLoading(true)

    try {
      await deleteGeofenceApi({
        variables: {
          eventId: event.id,
          keycode: event.keycode
        }
      })
      
      setGeofence(null)
      
      if (onGeofenceChange) {
        onGeofenceChange(null)
      }

      console.log('[GeofenceEditor] Geofence deleted')
    } catch (error) {
      console.error('[GeofenceEditor] Error deleting geofence:', error)
    } finally {
      setApiLoading(false)
    }
  }

  const toggleGeofenceMap = () => {
    setShowGeofenceMap(!showGeofenceMap)
  }

  return (
    <div className="geofence-editor">
      <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Event Geofence</h4>
      
      {apiError && (
        <div className="error-message" style={{ 
          padding: '0.75rem 1rem', 
          backgroundColor: '#ffebee', 
          borderLeft: '4px solid #ff6b6b',
          borderRadius: '0.25rem',
          marginBottom: '1rem'
        }}>
          ⚠️ {apiError}
        </div>
      )}
      
      <div className="geofence-info">
        <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
          Define a boundary for your event. Teams that leave this area will trigger an alert.
        </p>
        
        {geofence && geofence.length > 0 ? (
          <div className="geofence-status" style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '0.25rem',
            marginBottom: '1rem'
          }}>
            <strong>✓ Geofence Active:</strong> {geofence.length} points
            {event?.geofence_data && <small> (saved to server)</small>}
          </div>
        ) : (
          <div className="geofence-status" style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#fff3cd', 
            borderRadius: '0.25rem',
            marginBottom: '1rem'
          }}>
            <strong>No geofence set</strong> - Click the button below to draw one
          </div>
        )}

        <button 
          onClick={toggleGeofenceMap} 
          className="btn-secondary"
          style={{ marginBottom: '1rem' }}
          disabled={apiLoading}
        >
          {showGeofenceMap ? '✕ Close Geofence Map' : '📍 Draw/Edit Geofence'}
        </button>

        {geofence && geofence.length > 0 && (
          <button 
            onClick={handleGeofenceDelete} 
            className="btn-secondary"
            style={{ marginLeft: '0.5rem', backgroundColor: '#ff6b6b' }}
            disabled={apiLoading}
          >
            {apiLoading ? '🔄 Deleting...' : '🗑️ Clear Geofence'}
          </button>
        )}
      </div>

      {showGeofenceMap && (
        <div 
          className="geofence-map-container"
          style={{
            height: '400px',
            marginTop: '1rem',
            borderRadius: '0.5rem',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            opacity: apiLoading ? 0.6 : 1
          }}
        >
          <MapContainer
            center={[20, 0]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handleGeofenceCreate}
                onEdited={handleGeofenceEdit}
                onDeleted={handleGeofenceDelete}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                }}
              />
            </FeatureGroup>
          </MapContainer>
          
          <div style={{ padding: '0.5rem', backgroundColor: '#f5f5f5', fontSize: '0.85rem' }}>
            <strong>Instructions:</strong> Use the polygon tool to draw your event boundary. 
            Click to add points, double-click to complete.
            {apiLoading && <span style={{ marginLeft: '1rem', color: '#2196f3' }}>🔄 Saving to server...</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default GeofenceEditor
