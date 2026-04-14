/**
 * Event API - GraphQL Mutations and Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const GET_EVENT = gql`
  query GetEvent($id: Int!) {
    event(id: $id) {
      id
      name
      keycode
      view_keycode
      field_keycode
      access_level
      organization_name
      expiration_date
      timezone
      timeframe_start
      timeframe_end
      update_frequency
      api_url
      geofence_data
      image_data
      image_mime_type
      logo_data
      logo_mime_type
    }
  }
`

export const EVENT_INFO = gql`
  query EventByName($eventName: String!) {
    eventByName(event_name: $eventName) {
      image_data
      image_mime_type
      logo_data
      logo_mime_type
      organization_name
      timezone
    }
  }
`;

export const CREATE_EVENT = gql`
  mutation CreateEvent(
    $name: String!
    $organizationName: String
    $imageData: String
    $imageMimeType: String
    $logoData: String
    $logoMimeType: String
    $expirationDate: DateTime
    $timezone: String
    $updateFrequency: Int
    $apiUrl: String
  ) {
    createEvent(
      name: $name
      organization_name: $organizationName
      image_data: $imageData
      image_mime_type: $imageMimeType
      logo_data: $logoData
      logo_mime_type: $logoMimeType
      expiration_date: $expirationDate
      timezone: $timezone
      update_frequency: $updateFrequency
      api_url: $apiUrl
    ) {
      id
      name
      keycode
      view_keycode
      api_url
      access_level
      organization_name
      expiration_date
      timezone
      update_frequency
      image_data
      image_mime_type
      logo_data
      logo_mime_type
    }
  }
`

export const UPDATE_EVENT_IMAGE = gql`
  mutation UpdateEventImage(
    $eventId: Int!
    $keycode: String!
    $imageData: String!
    $imageMimeType: String!
  ) {
    updateEventImage(
      event_id: $eventId
      keycode: $keycode
      image_data: $imageData
      image_mime_type: $imageMimeType
    ) {
      id
      name
      keycode
      view_keycode
      access_level
      organization_name
      image_data
      image_mime_type
      logo_data
      logo_mime_type
    }
  }
`

export const UPDATE_EVENT_LOGO = gql`
  mutation UpdateEventLogo(
    $eventId: Int!
    $keycode: String!
    $logoData: String!
    $logoMimeType: String!
  ) {
    updateEventLogo(
      event_id: $eventId
      keycode: $keycode
      logo_data: $logoData
      logo_mime_type: $logoMimeType
    ) {
      id
      name
      keycode
      view_keycode
      access_level
      organization_name
      image_data
      image_mime_type
      logo_data
      logo_mime_type
    }
  }
`

export const UPDATE_ORGANIZATION_NAME = gql`
  mutation UpdateOrganizationName(
    $eventId: Int!
    $keycode: String!
    $organizationName: String!
  ) {
    updateOrganizationName(
      event_id: $eventId
      keycode: $keycode
      organization_name: $organizationName
    ) {
      id
      name
      keycode
      view_keycode
      access_level
      organization_name
      image_data
      image_mime_type
      logo_data
      logo_mime_type
    }
  }
`

export const UPDATE_EVENT_DEADLINE = gql`
  mutation UpdateEventDeadline($eventId: Int!, $keycode: String!, $expirationDate: DateTime) {
    updateEventDeadline(
      event_id: $eventId
      keycode: $keycode
      expiration_date: $expirationDate
    ) {
      id
      name
      expiration_date
      timezone
      start_date
      end_date
    }
  }
`

export const UPDATE_EVENT_TIMEFRAME = gql`
  mutation UpdateEventTimeframe($eventId: Int!, $keycode: String!, $startDate: String, $endDate: String) {
    updateEventTimeframe(
      event_id: $eventId
      keycode: $keycode
      start_date: $startDate
      end_date: $endDate
    ) {
      id
      name
      expiration_date
      timezone
      start_date
      end_date
      team_access_timeframe_start
      team_access_timeframe_end
    }
  }
`

export const UPDATE_TEAM_ACCESS_TIMEFRAME = gql`
  mutation UpdateTeamAccessTimeframe($eventId: Int!, $keycode: String!, $timeframeStart: DateTime, $timeframeEnd: DateTime) {
    updateTeamAccessTimeframe(
      event_id: $eventId
      keycode: $keycode
      timeframe_start: $timeframeStart
      timeframe_end: $timeframeEnd
    ) {
      id
      name
      expiration_date
      timezone
      timeframe_start
      timeframe_end
    }
  }
`

export const EXPORT_EVENT_DATA = gql`
  query ExportEventData(
    $eventId: Int!
    $keycode: String!
    $startDate: String
    $endDate: String
  ) {
    exportEventData(
      event_id: $eventId
      keycode: $keycode
      startDate: $startDate
      endDate: $endDate
    ) {
      event {
        id
        name
        organization_name
        expiration_date
        geofence_data
        image_data
        image_mime_type
        logo_data
        logo_mime_type
      }
      teams {
        id
        name
        color
        locations {
          id
          lat
          lon
          timestamp
        }
      }
      startDate
      endDate
    }
  }
`

export const UPDATE_EVENT_GEOFENCE = gql`
  mutation UpdateEventGeofence(
    $eventId: Int!
    $keycode: String!
    $geofenceData: String!
  ) {
    updateEventGeofence(
      event_id: $eventId
      keycode: $keycode
      geofence_data: $geofenceData
    ) {
      id
      name
      keycode
      view_keycode
      access_level
      organization_name
      geofence_data
    }
  }
`

export const DELETE_EVENT_GEOFENCE = gql`
  mutation DeleteEventGeofence(
    $eventId: Int!
    $keycode: String!
  ) {
    deleteEventGeofence(
      event_id: $eventId
      keycode: $keycode
    ) {
      id
      name
      keycode
      view_keycode
      access_level
      organization_name
      geofence_data
    }
  }
`

export const UPDATE_EVENT_UPDATE_FREQUENCY = gql`
  mutation UpdateEventUpdateFrequency($eventId: Int!, $keycode: String!, $updateFrequency: Int!) {
    updateEventUpdateFrequency(
      event_id: $eventId
      keycode: $keycode
      update_frequency: $updateFrequency
    ) {
      id
      name
      update_frequency
      timezone
      timeframe_start
      timeframe_end
    }
  }
`

export const UPDATE_EVENT_API_URL = gql`
  mutation UpdateEventApiUrl($eventId: Int!, $keycode: String!, $apiUrl: String!) {
    updateEventApiUrl(
      event_id: $eventId
      keycode: $keycode
      api_url: $apiUrl
    ) {
      id
      name
      api_url
    }
  }
`
