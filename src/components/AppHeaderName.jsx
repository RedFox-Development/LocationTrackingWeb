import appIcon from '../../images/app_icon.svg'

const AppHeaderName = () => {
  const currentEvent = localStorage.getItem('currentEvent')
  const event = currentEvent ? JSON.parse(currentEvent) : null
  const isFieldMode = event?.access_level === 'field'

  return (
    <div className="app-header-name">
      <img src={appIcon} alt="App Logo" className="app-logo" />
      {isFieldMode ? (
        <h1 className="field-mode-title">Location Tracker – Field Operations</h1>
      ) : (
        <h1>Location Tracker - Event Manager</h1>
      )}
    </div>
  )
}

export default AppHeaderName