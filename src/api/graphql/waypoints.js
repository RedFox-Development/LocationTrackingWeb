import { gql } from '@apollo/client'

export const GET_WAYPOINTS = gql`
  query GetWaypoints($eventId: Int!) {
    waypoints(event_id: $eventId) {
      id
      event_id
      name
      lat
      lon
      type
      pointValue
      is_required
      created_at
    }
  }
`

export const GET_WAYPOINT_VISITS = gql`
  query GetWaypointVisits($eventId: Int!) {
    waypointVisits(event_id: $eventId) {
      id
      waypoint_id
      team_id
      team_name
      team_color
      waypoint_name
      waypoint_is_required
      visited_at
      lat
      lon
    }
  }
`

export const CREATE_WAYPOINT = gql`
  mutation CreateWaypoint(
    $eventId: Int!
    $keycode: String!
    $name: String!
    $lat: Float!
    $lon: Float!
    $type: String
    $pointValue: Int
    $isRequired: Boolean
  ) {
    createWaypoint(
      event_id: $eventId
      keycode: $keycode
      name: $name
      lat: $lat
      lon: $lon
      type: $type
      pointValue: $pointValue
      is_required: $isRequired
    ) {
      id
      event_id
      name
      lat
      lon
      type
      pointValue
      is_required
      created_at
    }
  }
`

export const UPDATE_WAYPOINT = gql`
  mutation UpdateWaypoint(
    $waypointId: Int!
    $eventId: Int!
    $keycode: String!
    $name: String
    $isRequired: Boolean
    $lat: Float
    $lon: Float
    $type: String
    $pointValue: Int
  ) {
    updateWaypoint(
      waypoint_id: $waypointId
      event_id: $eventId
      keycode: $keycode
      name: $name
      is_required: $isRequired
      lat: $lat
      lon: $lon
      type: $type
      pointValue: $pointValue
    ) {
      id
      event_id
      name
      lat
      lon
      type
      pointValue
      is_required
      created_at
    }
  }
`

export const DELETE_WAYPOINT = gql`
  mutation DeleteWaypoint(
    $waypointId: Int!
    $eventId: Int!
    $keycode: String!
  ) {
    deleteWaypoint(
      waypoint_id: $waypointId
      event_id: $eventId
      keycode: $keycode
    ) {
      id
      event_id
      name
      lat
      lon
      type
      pointValue
      is_required
      created_at
    }
  }
`
