import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { CREATE_EVENT } from '../../api/graphql/event'
import { parseDataUri } from '../../utils/dataUri'

function EventSetup({ onEventCreated }) {
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [eventExpiration, setEventExpiration] = useState(() => {
    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
    return oneMonthFromNow.toISOString().split('T')[0]
  })
  const [eventImage, setEventImage] = useState('')
  const [eventLogo, setEventLogo] = useState('')
  const [error, setError] = useState(null)
  const [createdEvent, setCreatedEvent] = useState(null)

  const [createEvent, { loading }] = useMutation(CREATE_EVENT, {
    onCompleted: (data) => {
      const newEvent = data.createEvent
      setCreatedEvent(newEvent)
      
      // Store event in localStorage
      localStorage.setItem('currentEvent', JSON.stringify(newEvent))
      localStorage.setItem('currentTeams', JSON.stringify([]))
      
      // Call callback and redirect
      if (onEventCreated) {
        onEventCreated()
      }
      navigate('/event')
    },
    onError: (error) => {
      setError(error.message || 'Failed to create event')
    }
  })

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEventImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEventLogo(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    setError(null)
    
    if (!eventName.trim()) {
      setError('Event name is required')
      return
    }

    try {
      // Parse image data URIs
      const imageInfo = eventImage ? parseDataUri(eventImage) : null
      const logoInfo = eventLogo ? parseDataUri(eventLogo) : null

      await createEvent({
        variables: {
          name: eventName.trim(),
          organizationName: organizationName.trim() || null,
          imageData: imageInfo?.base64Data || null,
          imageMimeType: imageInfo?.mimeType || null,
          logoData: logoInfo?.base64Data || null,
          logoMimeType: logoInfo?.mimeType || null,
          expirationDate: eventExpiration ? `${eventExpiration}T23:59:59Z` : null
        }
      })
    } catch (err) {
      setError(err.message || 'Failed to create event')
    }
  }

  if (createdEvent) {
    return (
      <div className="event-setup">
        <div className="success-container">
          <h2>Event Created Successfully!</h2>
          <div className="event-details">
            <p><strong>Event Name:</strong> {createdEvent.name}</p>
            <p><strong>Event ID:</strong> {createdEvent.id}</p>
            <p><strong>Event Keycode:</strong> <code>{createdEvent.keycode}</code></p>
            {createdEvent.organization_name && (
              <p><strong>Organization:</strong> {createdEvent.organization_name}</p>
            )}
            {createdEvent.expiration_date && (
              <p><strong>Expiration Date:</strong> {new Date(createdEvent.expiration_date).toLocaleDateString()}</p>
            )}
          </div>
          <div className="button-group">
            <Link to="/login" className="btn-primary">Go to Login</Link>
            <Link to="/event" className="btn-secondary">Go to Event Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="event-setup">
      <div className="setup-container">
        <h1>Create New Event</h1>
        <p className="setup-description">Set up a new location tracking event</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleCreateEvent} className="setup-form">
          <div className="form-group">
            <label>Event Name *</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              required
              placeholder="Enter event name"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Organization Name</label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Enter organization name (optional)"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Event Expiration Date</label>
            <input
              type="date"
              value={eventExpiration}
              onChange={(e) => setEventExpiration(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="image-uploads">
            <h3>Event Images</h3>
            <div className="form-group">
              <label>Event Image</label>
              {eventImage && (
                <img src={eventImage} alt="Preview" className="image-preview" />
              )}
              <label htmlFor="event-image" className="btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block', cursor: 'pointer' }}>
                {eventImage ? 'Change Image' : 'Upload Image'}
              </label>
              <input
                id="event-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={loading}
                style={{ display: 'none' }}
              />
            </div>

            <div className="form-group">
              <label>Organization Logo</label>
              {eventLogo && (
                <img src={eventLogo} alt="Preview" className="logo-preview" style={{ maxWidth: '100px', maxHeight: '100px' }} />
              )}
              <label htmlFor="org-logo" className="btn-secondary" style={{ marginTop: '0.5rem', display: 'inline-block', cursor: 'pointer' }}>
                {eventLogo ? 'Change Logo' : 'Upload Logo'}
              </label>
              <input
                id="org-logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={loading}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '2rem', width: '100%' }}>
            {loading ? 'Creating Event...' : 'Create Event'}
          </button>
        </form>

        <div className="setup-info">
          <p>Already have an event?</p>
          <Link to="/login" className="btn-link">Login to your event</Link>
        </div>
      </div>
    </div>
  )
}

export default EventSetup
