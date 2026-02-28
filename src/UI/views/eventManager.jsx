import { useState, useEffect } from 'react'
import { useMutation } from '@apollo/client/react'
import { QRCode } from 'react-qrcode-logo'
import { CREATE_TEAM, UPDATE_TEAM_COLOR } from '../../api/graphql/team'
import { getRandomColor } from '../../utils/colorPalette'
import { getImageDataUri } from '../../utils/dataUri'

function EventManager({ event, onViewMap }) {
  const [teams, setTeams] = useState(event?.teams || [])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState(() => getRandomColor())
  const [newTeamExpiration, setNewTeamExpiration] = useState(() => {
    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
    return oneMonthFromNow.toISOString().split('T')[0]
  })
  const [expirationDate, setExpirationDate] = useState(() => {
    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
    return oneMonthFromNow.toISOString().split('T')[0]
  })
  const [timezone, setTimezone] = useState('UTC')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editColor, setEditColor] = useState('')
  const [error, setError] = useState(null)

  // Apollo mutations
  const [createTeamMutation, { loading: createLoading }] = useMutation(CREATE_TEAM)
  const [updateTeamColorMutation, { loading: updateLoading }] = useMutation(UPDATE_TEAM_COLOR)

  const loading = createLoading || updateLoading

  // Sync teams when event changes
  useEffect(() => {
    if (event?.teams) {
      setTeams(event.teams)
    }
  }, [event])

  const handleAddTeam = async (e) => {
    e.preventDefault()
    if (!newTeamName.trim()) return

    setError(null)

    try {
      const { data } = await createTeamMutation({
        variables: {
          eventId: event.id,
          name: newTeamName.trim(),
          color: newTeamColor,
          expirationDate: newTeamExpiration ? `${newTeamExpiration}T23:59:59Z` : null
        }
      })

      const newTeam = data.createTeam
      const updatedTeams = [...teams, newTeam]
      setTeams(updatedTeams)
      
      // Update event in localStorage
      const updatedEvent = { ...event, teams: updatedTeams }
      localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))
      localStorage.setItem('currentTeams', JSON.stringify(updatedTeams))
      
      setNewTeamName('')
      setNewTeamColor(getRandomColor())
      const oneMonthFromNow = new Date()
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)
      setNewTeamExpiration(oneMonthFromNow.toISOString().split('T')[0])
      setSelectedTeam(newTeam)
    } catch (err) {
      setError(err.message || 'Failed to create team')
    }
  }

  const handleRandomColor = () => {
    setNewTeamColor(getRandomColor())
  }

  const handleEditTeamColor = (team) => {
    setEditingTeamId(team.id)
    setEditColor(team.color)
  }

  const handleSaveTeamColor = async (team) => {
    if (editColor === team.color) {
      setEditingTeamId(null)
      return
    }

    setError(null)

    try {
      const { data } = await updateTeamColorMutation({
        variables: {
          teamId: team.id,
          eventId: event.id,
          keycode: event.keycode,
          color: editColor
        }
      })

      const updatedTeam = data.updateTeamColor
      const updatedTeams = teams.map(t => t.id === team.id ? updatedTeam : t)
      setTeams(updatedTeams)
      
      // Update event in localStorage
      const updatedEvent = { ...event, teams: updatedTeams }
      localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))
      localStorage.setItem('currentTeams', JSON.stringify(updatedTeams))
      
      if (selectedTeam?.id === team.id) {
        setSelectedTeam(updatedTeam)
      }
      
      setEditingTeamId(null)
    } catch (err) {
      setError(err.message || 'Failed to update team color')
    }
  }

  const isExpiringSoon = (expirationDate) => {
    if (!expirationDate) return false
    const expDate = new Date(expirationDate)
    const today = new Date()
    const daysUntilExpiration = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
    return daysUntilExpiration <= 7 && daysUntilExpiration >= 0
  }

  const isExpired = (expirationDate) => {
    if (!expirationDate) return false
    const expDate = new Date(expirationDate)
    const today = new Date()
    return expDate < today
  }

  const handleCancelEditColor = () => {
    setEditingTeamId(null)
    setEditColor('')
  }

  const handleDeleteTeam = (teamId) => {
    const updatedTeams = teams.filter(t => t.id !== teamId)
    setTeams(updatedTeams)
    
    const updatedEvent = { ...event, teams: updatedTeams }
    localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))
    localStorage.setItem('currentTeams', JSON.stringify(updatedTeams))
    
    if (selectedTeam?.id === teamId) {
      setSelectedTeam(null)
    }
  }

  const generateQRData = (team) => {
    const teamExpiration = team.expiration_date || expirationDate
    return JSON.stringify({
      teamName: team.name,
      event: event.name,
      apiUrl: event.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      imageUrl: '',
      expirationDate: teamExpiration,
      timezone: timezone
    })
  }

  const downloadQRCode = (team) => {
    const canvas = document.getElementById(`qr-${team.id}`)
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream")
      const downloadLink = document.createElement("a")
      downloadLink.href = pngUrl
      downloadLink.download = `${team.name.replace(/\s+/g, '_')}_QR.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
    }
  }

  if (!event) {
    return <div className="event-manager">Please create an event first</div>
  }

  return (
    <div className="event-manager">
      <div className="event-info">
        <h2>{event.name}</h2>
        {event.logo_data && <img src={getImageDataUri(event.logo_data, event.logo_mime_type)} alt="Event logo" className="event-logo" />}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Add Team Form */}
      <div className="add-team-section">
        <h3>Add New Team</h3>
        <form onSubmit={handleAddTeam} className="add-team-form">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Enter team name"
            disabled={loading}
            style={{ flex: 2 }}
          />
          <div className="color-picker-group">
            <label>Color:</label>
            <input
              type="color"
              value={newTeamColor}
              onChange={(e) => setNewTeamColor(e.target.value)}
              disabled={loading}
            />
            <button 
              type="button" 
              onClick={handleRandomColor}
              className="btn-secondary"
              disabled={loading}
              style={{ padding: '0.5rem 1rem', marginLeft: '0.5rem' }}
            >
              🎲 Random
            </button>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Expires:</label>
            <input
              type="date"
              value={newTeamExpiration}
              onChange={(e) => setNewTeamExpiration(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Adding...' : 'Add Team'}
          </button>
        </form>
      </div>
      <div className="manager-layout">
        <div className="teams-panel">
          <h3>Teams</h3>
          <div className="teams-list">
            {teams.length === 0 ? (
              <p className="empty-state">No teams yet. Add a team to get started.</p>
            ) : (
              teams.map(team => {
                const expiringSoon = isExpiringSoon(team.expiration_date)
                const expired = isExpired(team.expiration_date)
                
                return (
                  <div
                    key={team.id}
                    className={`team-item ${selectedTeam?.id === team.id ? 'selected' : ''} ${expired ? 'expired' : ''} ${expiringSoon ? 'expiring-soon' : ''}`}
                    onClick={() => setSelectedTeam(team)}
                  >
                    {editingTeamId === team.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          disabled={loading}
                        />
                        <span className="team-name">{team.name}</span>
                        <button
                          onClick={() => handleSaveTeamColor(team)}
                          className="btn-primary"
                          disabled={loading}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditColor}
                          className="btn-secondary"
                          disabled={loading}
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="team-color-indicator" style={{ backgroundColor: team.color || '#3b82f6' }}></div>
                        <div style={{ flex: 1 }}>
                          <span className="team-name">{team.name}</span>
                          {team.expiration_date && (
                            <div style={{ fontSize: '0.85rem', color: expired ? 'var(--error-color)' : expiringSoon ? '#f39c12' : 'var(--text-tertiary)' }}>
                              Expires: {new Date(team.expiration_date).toLocaleDateString()}
                              {expired && ' (EXPIRED)'}
                              {expiringSoon && !expired && ' (Soon)'}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditTeamColor(team)
                          }}
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem', marginRight: '0.5rem' }}
                        >
                          🎨
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteTeam(team.id)
                          }}
                          className="btn-delete"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="qr-panel">
          {selectedTeam ? (
            <>
              <h3>QR Code for {selectedTeam.name}</h3>
              
              <div className="qr-config">
                <h4>QR Code Configuration</h4>
                <div className="form-group">
                  <label>Expiration Date:</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Timezone:</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    <option value="UTC">UTC</option>
                    <option value="Europe/Helsinki">Europe/Helsinki</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                  </select>
                </div>
              </div>

              <div className="qr-code-container">
                <QRCode
                  id={`qr-${selectedTeam.id}`}
                  value={generateQRData(selectedTeam)}
                  size={300}
                  logoImage={event.logo_data || undefined}
                  logoWidth={60}
                  logoHeight={60}
                  removeQrCodeBehindLogo={true}
                  qrStyle="dots"
                  eyeRadius={5}
                />
              </div>
              <button
                onClick={() => downloadQRCode(selectedTeam)}
                className="btn-primary"
              >
                Download QR Code
              </button>
              <div className="qr-info">
                <h4>QR Code Information</h4>
                <pre>{JSON.stringify(JSON.parse(generateQRData(selectedTeam)), null, 2)}</pre>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Select a team to view and download its QR code
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EventManager
