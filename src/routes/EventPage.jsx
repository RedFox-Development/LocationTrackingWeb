import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { UPDATE_EVENT_IMAGE, UPDATE_EVENT_LOGO, UPDATE_ORGANIZATION_NAME } from '../api/graphql/event'
import { parseDataUri } from '../utils/dataUri'
import { exportEventAsZip } from '../utils/exportData'
import { getImageDataUri } from '../utils/dataUri'
import { EventHeader } from '../components/EventHeader'
import GeofenceEditor from '../components/GeofenceEditor'

const EventPage = (props) => {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  
  const [editingOrgName, setEditingOrgName] = useState(false)
  const [orgNameValue, setOrgNameValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Export state
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  // Apollo mutations
  const [updateImage] = useMutation(UPDATE_EVENT_IMAGE)
  const [updateLogo] = useMutation(UPDATE_EVENT_LOGO)
  const [updateOrgName] = useMutation(UPDATE_ORGANIZATION_NAME)

  // Load event from localStorage
  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    if (currentEvent) {
      const eventData = JSON.parse(currentEvent)
      setEvent(eventData)
      setOrgNameValue(eventData.organization_name || '')
    } else {
      navigate('/login')
    }
  }, [navigate])

  if (!event || !event.id) {
    return null
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUri = reader.result
        const imageInfo = parseDataUri(dataUri)

        try {
          await updateImage({
            variables: {
              eventId: event.id,
              keycode: event.keycode,
              imageData: imageInfo.base64Data,
              imageMimeType: imageInfo.mimeType
            }
          })

          // Update localStorage with new image
          const updated = { ...event, image_data: imageInfo.base64Data, image_mime_type: imageInfo.mimeType }
          setEvent(updated)
          localStorage.setItem('currentEvent', JSON.stringify(updated))
          
          setSuccess('Event image updated successfully!')
        } catch (err) {
          setError(err.message || 'Failed to update image')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError(err.message || 'Failed to read file')
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const dataUri = reader.result
        const logoInfo = parseDataUri(dataUri)

        try {
          await updateLogo({
            variables: {
              eventId: event.id,
              keycode: event.keycode,
              logoData: logoInfo.base64Data,
              logoMimeType: logoInfo.mimeType
            }
          })

          // Update localStorage with new logo
          const updated = { ...event, logo_data: logoInfo.base64Data, logo_mime_type: logoInfo.mimeType }
          setEvent(updated)
          localStorage.setItem('currentEvent', JSON.stringify(updated))

          setSuccess('Organization logo updated successfully!')
        } catch (err) {
          setError(err.message || 'Failed to update logo')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError(err.message || 'Failed to read file')
      setLoading(false)
    }
  }

  const handleOrgNameSave = async () => {
    if (orgNameValue === event.organization_name) {
      setEditingOrgName(false)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await updateOrgName({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          organizationName: orgNameValue
        }
      })

      // Update localStorage with new org name
      const updated = { ...event, organization_name: orgNameValue }
      setEvent(updated)
      localStorage.setItem('currentEvent', JSON.stringify(updated))

      setEditingOrgName(false)
      setSuccess('Organization name updated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to update organization name')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const startDate = exportStartDate ? new Date(exportStartDate) : undefined
      const endDate = exportEndDate ? new Date(exportEndDate) : undefined

      const zipBlob = await exportEventAsZip(
        event.id,
        event.keycode,
        startDate,
        endDate
      )

      // Trigger download
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${event.name}-export-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSuccess('Event data exported successfully!')
    } catch (err) {
      setError(err.message || 'Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="event-page">
      <EventHeader event={event} />

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="manage-section">
        <h3>Event Configuration</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Event Name</label>
            <p>{event.name}</p>
          </div>

          <div className="info-item">
            <label>Organization Name</label>
            {editingOrgName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={orgNameValue}
                  onChange={(e) => setOrgNameValue(e.target.value)}
                  placeholder="Enter organization name"
                  disabled={loading}
                  style={{ flex: 1 }}
                />
                <button 
                  onClick={handleOrgNameSave} 
                  className="btn-primary" 
                  disabled={loading}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setEditingOrgName(false)
                    setOrgNameValue(event.organization_name || '')
                  }} 
                  className="btn-secondary"
                  disabled={loading}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <p style={{ flex: 1, marginLeft: 0 }}>{event.organization_name || 'Not set'}</p>
                <button 
                  onClick={() => setEditingOrgName(true)} 
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', marginLeft: '-0.2rem' }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

        <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Event Images</h4>
        <div className="image-management">
          <div className="image-item">
            <label>Event Image</label>
            {event.image_data && (
              <img 
                src={getImageDataUri(event.image_data, event.image_mime_type)} 
                alt="Event" 
                className="manage-image-preview" 
              />
            )}
            <input
              id="event-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <br/>
            <label htmlFor="event-image-upload" className="btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block', cursor: 'pointer' }}>
              {event.image_data ? 'Change Image' : 'Upload Image'}
            </label>
          </div>
             
          <div className="image-item">
            <label>Organization Logo</label>
            {event.logo_data && (
              <img src={getImageDataUri(event.logo_data, event.logo_mime_type)} alt="Logo" className="manage-logo-preview" />
            )}
            <input
              id="org-logo-upload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <br/>
            <label htmlFor="org-logo-upload" className="btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block', cursor: 'pointer' }}>
              {event.logo_data ? 'Change Logo' : 'Upload Logo'}
            </label>
          </div>
        </div>

        <GeofenceEditor event={event} />

        {props.lockSomeFeatures && <>
          <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Export Event Data</h4>
          <div className="export-section">
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Download a complete archive of your event data including teams, locations (GeoJSON & CSV),
              images, and metadata in a single ZIP file.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Start Date (optional)</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  disabled={exporting}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>End Date (optional)</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  disabled={exporting}
                />
              </div>
              <button
                onClick={handleExportData}
                className="btn-primary"
                disabled={exporting}
                style={{ padding: '0.67rem 1.5rem' }}
              >
                {exporting ? 'Exporting...' : '📦 Export event data as a ZIP file'}
              </button>
            </div>
            {!exportStartDate && !exportEndDate && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>
                Leave dates empty to export all location data
              </p>
            )}
          </div>
          </>
        }
      </div>
    </div>
  )
}

export default EventPage
