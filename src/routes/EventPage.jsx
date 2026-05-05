import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import { QRCode } from 'react-qrcode-logo'
import { GET_EVENT, UPDATE_EVENT_IMAGE, UPDATE_EVENT_LOGO, UPDATE_ORGANIZATION_NAME, UPDATE_EVENT_DEADLINE, UPDATE_TEAM_ACCESS_TIMEFRAME, UPDATE_EVENT_UPDATE_FREQUENCY } from '../api/graphql/event'
import { parseDataUri } from '../utils/dataUri'
import { exportEventAsZip } from '../utils/exportData'
import { getImageDataUri } from '../utils/dataUri'
import { EventHeader } from '../components/EventHeader'
import GeofenceEditor from '../components/GeofenceEditor'
import WaypointEditor from '../components/WaypointEditor'
import { ThreeColumnGrid } from '../components/ColumnGrids'
import { hasManageAccess, mergeEventWithAuthFields } from '../utils/eventAccess'

const EventPage = (props) => {
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  
  const [editingOrgName, setEditingOrgName] = useState(false)
  const [orgNameValue, setOrgNameValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [eventDeadlineDay, setEventDeadlineDay] = useState('')
  const [teamAccessTimeframeStart, setTeamAccessTimeframeStart] = useState('')
  const [teamAccessTimeframeEnd, setTeamAccessTimeframeEnd] = useState('')
  const [teamAccessTimeframeStartTime, setTeamAccessTimeframeStartTime] = useState('00:00')
  const [teamAccessTimeframeEndTime, setTeamAccessTimeframeEndTime] = useState('23:59')
  const [updateFrequency, setUpdateFrequency] = useState('10')
  
  // Export state
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  // Apollo mutations
  const [updateImage] = useMutation(UPDATE_EVENT_IMAGE)
  const [updateLogo] = useMutation(UPDATE_EVENT_LOGO)
  const [updateOrgName] = useMutation(UPDATE_ORGANIZATION_NAME)
  const [updateEventDeadline] = useMutation(UPDATE_EVENT_DEADLINE)
  const [updateTeamAccessTimeframe] = useMutation(UPDATE_TEAM_ACCESS_TIMEFRAME)
  const [updateEventUpdateFrequency] = useMutation(UPDATE_EVENT_UPDATE_FREQUENCY)

  const { data: latestEventData } = useQuery(GET_EVENT, {
    variables: { id: event?.id },
    skip: !event?.id,
    fetchPolicy: 'network-only',
  })

  const toDateInput = (value) => {
    if (!value) return ''
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim()
    }

    const normalized =
      typeof value === 'string' && value.includes(' ') && !value.includes('T')
        ? `${value.replace(' ', 'T')}Z`
        : value

    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  const toTimeInput = (value) => {
    if (!value) return '00:00'
    
    const normalized =
      typeof value === 'string' && value.includes(' ') && !value.includes('T')
        ? `${value.replace(' ', 'T')}Z`
        : value

    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return '00:00'
    
    const isoString = date.toISOString()
    const timePart = isoString.split('T')[1]
    return timePart.split(':').slice(0, 2).join(':')
  }

  const toIsoDateTime = (date, time, isEndTime = false) => {
    if (!date || !time) return null
    const seconds = isEndTime ? '59' : '00'
    return `${date}T${time}:${seconds}Z`
  }

  // Load event from localStorage
  useEffect(() => {
    const currentEvent = localStorage.getItem('currentEvent')
    if (currentEvent) {
      const eventData = JSON.parse(currentEvent)
      if (!hasManageAccess(eventData)) {
        navigate('/event/map', { replace: true })
        return
      }
      setEvent(eventData)
      setOrgNameValue(eventData.organization_name || '')
      setEventDeadlineDay(toDateInput(eventData.expiration_date))
      setTeamAccessTimeframeStart(toDateInput(eventData.timeframe_start))
      setTeamAccessTimeframeEnd(toDateInput(eventData.timeframe_end))
      setTeamAccessTimeframeStartTime(toTimeInput(eventData.timeframe_start))
      setTeamAccessTimeframeEndTime(toTimeInput(eventData.timeframe_end))
      setUpdateFrequency(eventData.update_frequency ? String(eventData.update_frequency / 1000) : '10')
    } else {
      navigate('/login')
    }
  }, [navigate])

  useEffect(() => {
    if (!latestEventData?.event) return

    setEvent((current) => {
      const merged = mergeEventWithAuthFields(latestEventData.event, current)

      if (
        current &&
        current.id === merged.id &&
        current.keycode === merged.keycode &&
        current.view_keycode === merged.view_keycode &&
        current.field_keycode === merged.field_keycode &&
        current.access_level === merged.access_level &&
        current.organization_name === merged.organization_name &&
        current.expiration_date === merged.expiration_date &&
        current.geofence_data === merged.geofence_data &&
        current.image_data === merged.image_data &&
        current.image_mime_type === merged.image_mime_type &&
        current.logo_data === merged.logo_data &&
        current.logo_mime_type === merged.logo_mime_type &&
        current.update_frequency === merged.update_frequency &&
        current.timeframe_start === merged.timeframe_start &&
        current.timeframe_end === merged.timeframe_end
      ) {
        return current
      }

      localStorage.setItem('currentEvent', JSON.stringify(merged))
      setEventDeadlineDay(toDateInput(merged.expiration_date))
      setTeamAccessTimeframeStart(toDateInput(merged.timeframe_start))
      setTeamAccessTimeframeEnd(toDateInput(merged.timeframe_end))
      setTeamAccessTimeframeStartTime(toTimeInput(merged.timeframe_start))
      setTeamAccessTimeframeEndTime(toTimeInput(merged.timeframe_end))
      setUpdateFrequency(merged.update_frequency ? String(merged.update_frequency / 1000) : '10')
      return merged
    })
  }, [latestEventData])

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

  const handleDownloadQRCode = async () => {
    try {
      // Get the QR code canvas element
      const qrCanvas = document.querySelector('#field-organizer-qr canvas')
      if (!qrCanvas) {
        setError('QR code not found')
        return
      }

      // Convert canvas to blob and download
      qrCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${event.name}-field-access-qr-${new Date().toISOString().split('T')[0]}.png`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setSuccess('QR code downloaded successfully!')
      })
    } catch (err) {
      setError(err.message || 'Failed to download QR code')
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

  const handleEventDeadlineSave = async () => {
    if (!eventDeadlineDay) {
      setError('Event expiration day is required')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data } = await updateEventDeadline({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          expirationDate: `${eventDeadlineDay}T23:59:59Z`,
        },
      })

      const updated = {
        ...event,
        expiration_date: data.updateEventDeadline.expiration_date,
      }
      setEvent(updated)
      localStorage.setItem('currentEvent', JSON.stringify(updated))
      setSuccess('Event expiration day updated')
    } catch (err) {
      setError(err.message || 'Failed to update event expiration day')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTeamAccessTimeframe = async () => {
    if (!teamAccessTimeframeStart || !teamAccessTimeframeEnd) {
      setError('Team access timeframe start and end dates are required')
      return
    }

    const startDateTime = toIsoDateTime(teamAccessTimeframeStart, teamAccessTimeframeStartTime, false)
    const endDateTime = toIsoDateTime(teamAccessTimeframeEnd, teamAccessTimeframeEndTime, true)

    if (new Date(startDateTime) > new Date(endDateTime)) {
      setError('Team access timeframe start must be on or before end')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data } = await updateTeamAccessTimeframe({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          timeframeStart: startDateTime,
          timeframeEnd: endDateTime,
        },
      })

      const updated = {
        ...event,
        team_access_timeframe_start: data.updateTeamAccessTimeframe.timeframe_start,
        team_access_timeframe_end: data.updateTeamAccessTimeframe.timeframe_end,
      }
      setEvent(updated)
      localStorage.setItem('currentEvent', JSON.stringify(updated))
      setSuccess('Team access timeframe updated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to update team access timeframe')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUpdateFrequency = async () => {
    if (!updateFrequency) {
      setError('Update frequency is required')
      return
    }

    const frequencySeconds = parseInt(updateFrequency, 10)
    if (isNaN(frequencySeconds) || frequencySeconds < 1 || frequencySeconds > 60) {
      setError('Update frequency must be between 1 and 60 seconds')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data } = await updateEventUpdateFrequency({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          updateFrequency: frequencySeconds * 1000, // Convert to milliseconds
        },
      })

      const updated = {
        ...event,
        update_frequency: data.updateEventUpdateFrequency.update_frequency,
      }
      setEvent(updated)
      localStorage.setItem('currentEvent', JSON.stringify(updated))
      setSuccess('Location update frequency updated successfully!')
    } catch (err) {
      setError(err.message || 'Failed to update location update frequency')
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('[EventPage] Starting export with dates:', { exportStartDate, exportEndDate })
      const startDate = exportStartDate ? new Date(exportStartDate) : undefined
      const endDate = exportEndDate ? new Date(exportEndDate) : undefined

      console.log('[EventPage] Calling exportEventAsZip with eventId:', event.id)
      const zipBlob = await exportEventAsZip(
        event.id,
        event.keycode,
        startDate,
        endDate
      )

      if (!zipBlob || zipBlob.size === 0) {
        throw new Error('Export produced empty file')
      }

      console.log('[EventPage] Export successful, blob size:', zipBlob.size)

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
      console.log('[EventPage] Export download completed')
    } catch (err) {
      console.error('[EventPage] Export error:', err)
      console.error('[EventPage] Error details:', {
        message: err?.message,
        networkError: err?.networkError,
        graphQLErrors: err?.graphQLErrors,
      })
      setError(err?.message || 'Failed to export data')
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
        <ThreeColumnGrid>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 1 / 1 / 1' }}>Event Name</label>
          <p style={{ margin: '0.5rem 0', gridArea: '2 / 1 / 2 / 1' }}>{event.name}</p>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 2 / 1 / 2' }}>Event Expiration Day</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '2 / 2 / 2 / 2' }}>
            <input
              type="date"
              value={eventDeadlineDay}
              onChange={(e) => setEventDeadlineDay(e.target.value)}
              style={{ maxWidth: '55%' }}
              disabled={loading}
            />
          </div>
          <button
            onClick={handleEventDeadlineSave}
            className="btn-secondary"
            disabled={loading}
            style={{ maxWidth: '55%', padding: '0.5rem 1rem', fontSize: '0.9rem', gridArea: '3 / 2 / 3 / 2' }}
          >
            Save Expiration Day
          </button>
          
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 3 / 1 / 3' }}>Organization Name</label>
            {editingOrgName ? (
              <>
                <input
                  type="text"
                  value={orgNameValue}
                  onChange={(e) => setOrgNameValue(e.target.value)}
                  placeholder="Enter organization name"
                  disabled={loading}
                  style={{ maxWidth: '75%', marginBottom: '0.5rem', gridArea: '2 / 3 / 2 / 3' }}
                />
                <div style={{ maxWidth: '75%', display: 'flex', gap: '0.5rem', gridArea: '3 / 3 / 3 / 3' }}>
                  <button 
                    onClick={handleOrgNameSave} 
                    className="btn-primary" 
                    disabled={loading}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', flex: 1 }}
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
                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ maxWidth: '55%', margin: '0.5rem 0', gridArea: '2 / 3 / 2 / 3' }}>{event.organization_name || 'Not set'}</p>
                <button 
                  onClick={() => setEditingOrgName(true)} 
                  className="btn-secondary"
                  style={{ maxWidth: '45%', padding: '0.5rem 1rem', fontSize: '0.9rem', gridArea: '3 / 3 / 3 / 3' }}
                >
                  Edit
                </button>
              </>
            )}
        </ThreeColumnGrid>

        <h3 style={{ marginBottom: '0.5rem', marginTop: '2rem' }}>Team Access Timeframe</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Set the access window during which teams can submit location updates. All teams share the same timeframe.
        </p>
        <ThreeColumnGrid>
          {/* Date Row */}
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 1 / 1 / 1' }}>Start Date</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '2 / 1 / 2 / 1' }}>
            <input
              type="date"
              value={teamAccessTimeframeStart}
              onChange={(e) => setTeamAccessTimeframeStart(e.target.value)}
              disabled={loading}
              style={{ maxWidth: '45%'}}
            />
          </div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 2 / 1 / 2' }}>End Date</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '2 / 2 / 2 / 2' }}>
            <input
              type="date"
              value={teamAccessTimeframeEnd}
              onChange={(e) => setTeamAccessTimeframeEnd(e.target.value)}
              disabled={loading}
              style={{ maxWidth: '45%' }}
            />
          </div>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '2 / 3 / 2 / 3' }}>
            <button
              onClick={handleSaveTeamAccessTimeframe}
              className="btn-secondary"
              disabled={loading}
              style={{ maxWidth: '55%', padding: '0.6rem 1rem' }}
            >
              {loading ? 'Saving...' : 'Save Timeframe'}
            </button>
          </div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '3 / 1 / 3 / 1' }}>Start Time</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '4 / 1 / 4 / 1' }}>
            <input
              type="time"
              value={teamAccessTimeframeStartTime}
              onChange={(e) => setTeamAccessTimeframeStartTime(e.target.value)}
              disabled={loading}
              style={{ maxWidth: '45%', marginBottom: '0.3rem' }}
            />
          </div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '3 / 2 / 3 / 2' }}>End Time</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '4 / 2 / 4 / 2' }}>
            <input
              type="time"
              value={teamAccessTimeframeEndTime}
              onChange={(e) => setTeamAccessTimeframeEndTime(e.target.value)}
              disabled={loading}
              style={{ maxWidth: '45%', marginBottom: '0.3rem' }}
            />
          </div>
        </ThreeColumnGrid>

        <h3 style={{ marginBottom: '0.5rem' }}>Location Update Frequency</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Set how frequently teams mobile apps should send location updates. Lower values provide more frequent updates but consume more battery.
        </p>
        <ThreeColumnGrid>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 1 / 1 / 1' }}>Update Frequency</label>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '1 / 2 / 1 / 2' }}>
            <select
              value={updateFrequency}
              onChange={(e) => setUpdateFrequency(e.target.value)}
              disabled={loading}
              style={{ maxWidth: '45%', marginBottom: '0.3rem' }}
            >
              <option value="1">1 second</option>
              <option value="3">3 seconds</option>
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="15">15 seconds</option>
              <option value="20">20 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '1 / 3 / 1 / 3' }}>
            <button
              onClick={handleSaveUpdateFrequency}
              className="btn-secondary"
              disabled={loading}
              style={{ maxWidth: '55%', padding: '0.6rem 1rem' }}
            >
              {loading ? 'Saving...' : 'Save Frequency'}
            </button>
          </div>
        </ThreeColumnGrid>  
        
        <h3 style={{ marginBottom: '1rem' }}>Event Images & Access</h3>
        <ThreeColumnGrid>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 1 / 1 / 1' }}>Event Image</label>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 2 / 1 / 2' }}>Organization Logo</label>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '1 / 3 / 1 / 3' }}>Field Access QR code</label>

          {event.image_data && (
            <img 
              src={getImageDataUri(event.image_data, event.image_mime_type)} 
              alt="Event" 
              className="manage-image-preview" 
              style={{ maxHeight: '8rem', aspectRatio: 'auto', borderRadius: '0.5rem', objectFit: 'cover', gridArea: '2 / 1 / 2 / 1' }}
            />
          )}
          {event.logo_data && (
            <img 
              src={getImageDataUri(event.logo_data, event.logo_mime_type)} 
              alt="Logo" 
              className="manage-logo-preview" 
              style={{ maxHeight: '8rem', aspectRatio: 'auto', borderRadius: '0.5rem', objectFit: 'cover', gridArea: '2 / 2 / 2 / 2' }}
            />
          )}
          {event?.field_keycode ? (
            <QRCode
              id="field-organizer-qr"
              value={JSON.stringify({
                event: event.name,
                fieldKeycode: event.field_keycode,
                type: 'field',
              })}
              size={200}
              logoImage={event.logo_data ? getImageDataUri(event.logo_data, event.logo_mime_type) : undefined}
              logoWidth={36}
              logoHeight={36}
              removeQrCodeBehindLogo={true}
              qrStyle="dots"
              eyeRadius={2}
              style={{ gridArea: '2 / 3 / 2 / 3' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              QR code will appear once event is created
            </div>
          )}

          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '3 / 1 / 3 / 1' }}>
            <input
              id="event-image-upload"
              type="file"
              accept="image/gif,image/png,image/jpeg,image/webp,image/*"
              onChange={handleImageUpload}
              disabled={loading}
              style={{ display: 'none', maxWidth: '55%' }}
            />
            <label htmlFor="event-image-upload" className="btn-secondary" style={{ textAlign: 'center', cursor: 'pointer', padding: '0.5rem 1rem', maxWidth: '55%', fontWeight: '600' }}>
              {event.image_data ? 'Change Image' : 'Upload Image'}
            </label>
          </div>
          <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '3 / 2 / 3 / 2' }}>
            <input
              id="org-logo-upload"
              type="file"
              accept="image/gif,image/png,image/jpeg,image/webp,image/*"
              onChange={handleLogoUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <label htmlFor="org-logo-upload" className="btn-secondary" style={{ textAlign: 'center', cursor: 'pointer', padding: '0.5rem 1rem', maxWidth: '55%', fontWeight: '600' }}>
              {event.logo_data ? 'Change Logo' : 'Upload Logo'}
            </label>
          </div>
          {event?.field_keycode && (
            <div className="form-group" style={{ margin: '0.5rem 0', marginBottom: '0.5rem', gridArea: '3 / 3 / 3 / 3' }}>
              <button
                onClick={handleDownloadQRCode}
                className="btn-secondary"
                style={{ maxWidth: '55%', padding: '0.5rem 1rem', textAlign: 'center' }}
              >
                📥 Download QR Code
              </button>
            </div>
          )}
        </ThreeColumnGrid>

        <GeofenceEditor event={event} />
        <WaypointEditor event={event} />

        {!props.lockSomeFeatures && <>
          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Export Event Data</h3>
          <ThreeColumnGrid>
            <p style={{ gridArea: '1 / 1 / 1 / 3', color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Download a complete archive of your event data including teams, locations (GeoJSON & CSV),
              images, metadata, and georeferenced PNG overlays in a single ZIP file.
            </p>
            {!exportStartDate && !exportEndDate && (<p style={{ gridArea: '2 / 1 / 2 / 3', color: 'var(--text-secondary)', fontSize: '1rem', textDecoration: 'var(--error-color) solid underline 2px' }}>
              If you leave dates empty, all location data will be exported
            </p>)}
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '3 / 1 / 3 / 1' }}>Start Date (optional)</label>
            <div className="form-group" style={{ flex: 1, gridArea: '4 / 1 / 4 / 1' }}>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                disabled={exporting}
                style={{ maxWidth: '55%'}}
              />
            </div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', gridArea: '3 / 2 / 3 / 2' }}>End Date (optional)</label>
            <div className="form-group" style={{ flex: 1, gridArea: '4 / 2 / 4 / 2' }}>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                disabled={exporting}
                style={{ maxWidth: '55%'}}
              />
            </div>
            <div className="form-group" style={{ flex: 1, maxWidth: '55%', gridArea: '4 / 3 / 4 / 3' }}>
              <button
                onClick={handleExportData}
                className="btn-primary"
                disabled={exporting}
                style={{ padding: '0.67rem 1.5rem' }}
              >
                {exporting ? 'Exporting...' : '📦 Export event data as a ZIP file'}
              </button>
            </div>
          </ThreeColumnGrid>
          </>
        }
      </div>
    </div>
  )
}

export default EventPage
