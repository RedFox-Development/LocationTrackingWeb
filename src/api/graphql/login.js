/**
 * Authentication API - GraphQL Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const LOGIN = gql`
  query Login($eventName: String!, $keycode: String!) {
    login(event_name: $eventName, keycode: $keycode) {
      success
      event {
        id
        name
        keycode
        organization_name
        expiration_date
        geofence_data
        image_data
        image_mime_type
        logo_data
        logo_mime_type
      }
    }
  }
`
