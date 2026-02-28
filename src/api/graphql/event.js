/**
 * Event API - GraphQL Mutations and Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const EVENT_INFO = gql`
  query EventByName($eventName: String!) {
    eventByName(event_name: $eventName) {
      image_data
      image_mime_type
      logo_data
      logo_mime_type
      organization_name
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
    $expirationDate: String
  ) {
    createEvent(
      name: $name
      organization_name: $organizationName
      image_data: $imageData
      image_mime_type: $imageMimeType
      logo_data: $logoData
      logo_mime_type: $logoMimeType
      expiration_date: $expirationDate
    ) {
      id
      name
      keycode
      organization_name
      expiration_date
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
      organization_name
      image_data
      image_mime_type
      logo_data
      logo_mime_type
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
        image_data
        image_mime_type
        logo_data
        logo_mime_type
      }
      teams {
        id
        name
        color
        expiration_date
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
      organization_name
      geofence_data
    }
  }
`
