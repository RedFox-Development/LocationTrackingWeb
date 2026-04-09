import { useState, useEffect } from 'react'
import { useMutation } from '@apollo/client/react'
import { QRCode } from 'react-qrcode-logo'
import { CREATE_TEAM, UPDATE_TEAM_COLOR, DELETE_TEAM } from '../../api/graphql/team'
import { UPDATE_TEAM_ACCESS_TIMEFRAME } from '../../api/graphql/event'
import { getRandomColor } from '../../utils/colorPalette'
import { getImageDataUri } from '../../utils/dataUri'

function EventManager({ event, onViewMap, onTeamsChanged }) {
  const [teams, setTeams] = useState(event?.teams || [])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState(() => getRandomColor())
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamAccessTimeframeStart, setTeamAccessTimeframeStart] = useState('')
  const [teamAccessTimeframeEnd, setTeamAccessTimeframeEnd] = useState('')
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editColor, setEditColor] = useState('')
  const [error, setError] = useState(null)

  // Apollo mutations
  const [createTeamMutation, { loading: createLoading }] = useMutation(CREATE_TEAM)
  const [updateTeamAccessTimeframeMutation, { loading: updateAccessTimeframeLoading }] = useMutation(UPDATE_TEAM_ACCESS_TIMEFRAME)
  const [updateTeamColorMutation, { loading: updateLoading }] = useMutation(UPDATE_TEAM_COLOR)
  const [deleteTeamMutation, { loading: deleteLoading }] = useMutation(DELETE_TEAM)

  const loading = createLoading || updateAccessTimeframeLoading || updateLoading || deleteLoading

  const toDateInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  }

  const toIsoStartOfDay = (value) => (value ? `${value}T00:00:00Z` : null)
  const toIsoEndOfDay = (value) => (value ? `${value}T23:59:59Z` : null)
  const getEventAccessTimeframeStart = () => toDateInput(event?.team_access_timeframe_start)
  const getEventAccessTimeframeEnd = () => toDateInput(event?.team_access_timeframe_end)

  // Sync teams when event changes
  useEffect(() => {
    if (event?.teams) {
      setTeams(event.teams)
    }
  }, [event])

  useEffect(() => {
    if (!selectedTeam) {
      setTeamAccessTimeframeStart('')
      setTeamAccessTimeframeEnd('')
      return
    }

    // Load event-level team access timeframe
    setTeamAccessTimeframeStart(getEventAccessTimeframeStart())
    setTeamAccessTimeframeEnd(getEventAccessTimeframeEnd())
  }, [selectedTeam, event])

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
          expirationDate: null
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
      setSelectedTeam(newTeam)
      setSelectedTeamAccessStart('')
      setSelectedTeamAccessEnd('')
      
      // Notify parent to reload data
      if (onTeamsChanged) {
        onTeamsChanged()
      }
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
      setEditColor('')
      
      // Notify parent to reload data
      if (onTeamsChanged) {
        onTeamsChanged()
      }
    } catch (err) {
      setError(err.message || 'Failed to update team color')
    }
  }

  const handleCancelEditColor = () => {
    setEditingTeamId(null)
    setEditColor('')
  }

  const handleDeleteTeam = async (teamId) => {
    setError(null)

    try {
      await deleteTeamMutation({
        variables: {
          teamId,
          eventId: event.id,
          keycode: event.keycode,
        },
      })

      const updatedTeams = teams.filter(t => t.id !== teamId)
      setTeams(updatedTeams)
      
      const updatedEvent = { ...event, teams: updatedTeams }
      localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))
      localStorage.setItem('currentTeams', JSON.stringify(updatedTeams))
      
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null)
      }
      
      // Notify parent to reload data
      if (onTeamsChanged) {
        onTeamsChanged()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete team')
    }
  }

  const handleSaveTeamAccessTimeframe = async () => {
    if (!teamAccessTimeframeStart || !teamAccessTimeframeEnd) {
      setError('Team access timeframe start and end dates are required')
      return
    }

    if (new Date(teamAccessTimeframeStart) > new Date(teamAccessTimeframeEnd)) {
      setError('Team access timeframe start must be on or before end')
      return
    }

    setError(null)
    try {
      const { data } = await updateTeamAccessTimeframeMutation({
        variables: {
          eventId: event.id,
          keycode: event.keycode,
          startDate: toIsoStartOfDay(teamAccessTimeframeStart),
          endDate: toIsoEndOfDay(teamAccessTimeframeEnd),
        },
      })

      const updatedEvent = {
        ...event,
        ...data.updateTeamAccessTimeframe,
      }
      localStorage.setItem('currentEvent', JSON.stringify(updatedEvent))

      if (onTeamsChanged) {
        onTeamsChanged()
      }
    } catch (err) {
      setError(err.message || 'Failed to update team access timeframe')
    }
  }

  const generateQRData = (team) => {
    return JSON.stringify({
      teamName: team.name,
      event: event.name,
      apiUrl: event.apiUrl || import.meta.env.VITE_API_URL,
    })
  }

  const hasTeamAccessTimeframe = () => Boolean(event?.team_access_timeframe_start && event?.team_access_timeframe_end)

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
                return (
                  <div
                    key={team.id}
                    className={`team-item ${selectedTeam?.id === team.id ? 'selected' : ''}`}
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
                          <div style={{ fontSize: '0.8rem', color: team.activated ? '#0d7a22' : 'var(--text-tertiary)' }}>
                            {team.activated ? 'Activated' : 'Not activated'}
                          </div>
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
                          disabled={loading}
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
                <h4>Team Access Timeframe</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  All teams in this event share the same access window for location updates.
                </p>
                <div className="form-group">
                  <label>Access Start:</label>
                  <input
                    type="date"
                    value={teamAccessTimeframeStart}
                    onChange={(e) => setTeamAccessTimeframeStart(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Access End:</label>
                  <input
                    type="date"
                    value={teamAccessTimeframeEnd}
                    onChange={(e) => setTeamAccessTimeframeEnd(e.target.value)}
                  />
                </div>
                <button className="btn-secondary" onClick={handleSaveTeamAccessTimeframe} disabled={loading}>
                  Save Team Access Timeframe
                </button>
              </div>

              <div className="qr-config" style={{ marginTop: '1rem' }}>
                <h4>Selected Team Status</h4>
                <div style={{ marginBottom: '0.5rem', color: selectedTeam.activated ? '#0d7a22' : 'var(--text-tertiary)' }}>
                  Activation: {selectedTeam.activated ? 'Activated' : 'Not activated'}
                </div>
                {hasTeamAccessTimeframe() ? (
                  <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                    <div>Timeframe start: {getEventAccessTimeframeStart()}</div>
                    <div>Timeframe end: {getEventAccessTimeframeEnd()}</div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-tertiary)' }}>
                    Set the team access timeframe to generate the QR code.
                  </div>
                )}
              </div>

              {hasTeamAccessTimeframe() && (
                <>
                  <div className="qr-code-container">
                    <QRCode
                      id={`qr-${selectedTeam.id}`}
                      value={generateQRData(selectedTeam)}
                      size={320}
                      logoImage={event.logo_data ? getImageDataUri(event.logo_data, event.logo_mime_type) : undefined}
                      logoWidth={64}
                      logoHeight={64}
                      removeQrCodeBehindLogo={true}
                      qrStyle="dots"
                      eyeRadius={2}
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
              )}
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
