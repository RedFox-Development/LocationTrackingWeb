# Location Tracking (React\Vite web UI)

A lightweight web interface for managing location tracking events and teams. This app integrates with the Flutter mobile app to create events, generate QR codes for team participation, and track team locations in real-time.

**Architecture**: Static web app (GitHub Pages) + Vercel GraphQL API + Aiven PostgreSQL. Event authentication via keycode system.

## Architecture

**Static Web App**
- React 19 + Vite
- Custom CSS with responsive design
- QR code generation (react-qrcode-logo)
- State management: React hooks + localStorage
- Event authentication via keycode

**Serverless GraphQL API**
- Single `/api` endpoint for all operations
- Event management: createEvent, login
- Team management: createTeam, teams
- Location tracking: createLocationUpdate, updates
- Auto-scaling and connection pooling
- SSL-enabled PostgreSQL connection

**Database**
- Managed cloud PostgreSQL
- SSL connections required
- Tables: events, teams, location_updates
- Accessed only via GraphQL API (no direct client access)

```
┌──────────────────┐
│  Flutter App     │ GraphQL Mutations
│  (Mobile)        │───────────────────┐
└──────────────────┘                   │
                                       ▼
                              ┌──────────────────┐
                              │  Vercel GraphQL  │
                              │      API         │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Aiven           │
                              │  PostgreSQL      │
                              └────────┬─────────┘
                                       │
                                       │ GraphQL Queries
┌──────────────────┐                   │
│   Web UI         │───────────────────┘
│  (React)         │
└──────────────────┘
```

## Project Structure

This is part of a multi-project setup:
- **location_tracker_web** (this project): React web UI hosted on GitHub Pages
- **[location_tracker_api](../location_tracker_api)**: Vercel Serverless GraphQL API
- **[location_share_android](../location_share_android)**: Flutter mobile app

## Features

### ✅ Implemented

- **Create Event**
  - Event name via GraphQL API
  - Auto-generated keycode for authentication
  - Image upload / link setup
  - Event / organization logo upload
  - Event login with name + keycode
  - Event data persistence in localStorage

- **Create Teams**
  - Team name and color management via GraphQL
  - Team deleting from UI (persisted via GraphQL API)
  - QR code generation using react-qrcode-logo
  - QR codes include: team name, event name, API URL, image URL, expiration date, timezone
  - Download QR codes as PNG images
  - Event logo embedded in QR codes
  - No database credentials in QR codes (API-based security)

- **Track Teams on Map**
  - Team filtering and selection
  - Real-time location updates with configurable refresh intervals
  - Location history tracking toggle
  - Team color coding and labels
  - Map placeholder ready for integration

- **Map integration**
  - Leaflet via react-leaflet
  - Display team positions on actual map
  - Draw location history trails
  - Add markers with team labels
  - Near-realtime updates visualized

- **Event geofencing**
  - Drawing the boundaries
  - Saving the boundaries to the event details in the database via API
  - Blinking boundary on rendered map
  - Geofence breach alerting
  - Centering the map to the defined geofenced event area, if set

## Roadmap

- **Web** Team statistics and analytics
- **API + Web** Timeline animation of verified location sequences
- **Web + API** [OPT] checkpoint locations setup + map rendering

## QR Code Format

QR codes contain JSON data for the Flutter app:
```json
{
  "teamName": "Team Alpha",
  "event": "Summer Challenge 2026",
  "apiUrl": "https://your-project.vercel.app/api",
  "expirationDate": 1776286799999,
  "timezone": "UTC"
}
```

**Security**: No database credentials in QR codes - only API endpoint and event metadata.
