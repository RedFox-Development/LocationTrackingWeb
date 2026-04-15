import appIcon from '../../images/app_icon.svg'

const AppHeaderName = () => {
  const currentEvent = localStorage.getItem('currentEvent')
  const event = currentEvent ? JSON.parse(currentEvent) : null
  const getModeName = () => {
    if (event?.access_level === 'field') return 'Field Operations'
    if (event?.access_level === 'view') return 'Team Tracking'
    if (event?.access_level === 'manage') return 'Event Management'
  }

  return (
    <div className="app-header-name">
      <img src={appIcon} alt="App Logo" className="app-logo" />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
        <h1 className="field-mode-title">Location Tracker</h1>
        <h4 style={{marginTop: '-0.3rem'}}>{getModeName()}</h4>
      </div>
    </div>
  )
}

export default AppHeaderName