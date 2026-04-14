/**
 * Authentication API - GraphQL Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const LOGIN = gql`
  query Login($eventName: String!, $keycode: String!) {
    login(event_name: $eventName, keycode: $keycode) {
      success
      access_level
      event {
        id
        name
        keycode
        view_keycode
        field_keycode
        access_level
        organization_name
        expiration_date
        timezone
        geofence_data
        image_data
        image_mime_type
        logo_data
        logo_mime_type
        update_frequency
      }
    }
  }
`
