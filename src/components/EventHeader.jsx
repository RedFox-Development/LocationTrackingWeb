
import { getImageDataUri } from '../utils/dataUri'

export const EventHeader = ({ event }) => {
  return (
    <div className="event-info">
      <h2>{event.name}</h2>
      {event.logo_data && (
        <img 
          src={getImageDataUri(event.logo_data, event.logo_mime_type)} 
          alt="Event logo" 
          className="event-logo" 
        />
      )}
    </div>
  )
}