import appIcon from '../../images/app_icon.svg'

const AppHeaderName = () => {
  return (
    <div className="app-header-name">
      <img src={appIcon} alt="App Logo" className="app-logo" />
      <h1>Location Tracker - Event Manager</h1>
    </div>
  )
}

export default AppHeaderName