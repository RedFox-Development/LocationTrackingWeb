/**
 * Team API - GraphQL Mutations and Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const CREATE_TEAM = gql`
  mutation CreateTeam($eventId: Int!, $name: String!, $color: String, $expirationDate: DateTime) {
    createTeam(event_id: $eventId, name: $name, color: $color, expiration_date: $expirationDate) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`

export const GET_UPDATES = gql`
  query GetUpdates($event: String!, $team: String!, $limit: Int) {
    updates(event: $event, team: $team, limit: $limit) {
      id
      team
      event
      lat
      lon
      timestamp
    }
  }
`

export const GET_TEAMS = gql`
  query GetTeams($eventId: Int!) {
    teams(event_id: $eventId) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`

export const UPDATE_TEAM_COLOR = gql`
  mutation UpdateTeamColor($teamId: Int!, $eventId: Int!, $keycode: String!, $color: String!) {
    updateTeamColor(team_id: $teamId, event_id: $eventId, keycode: $keycode, color: $color) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`

export const UPDATE_TEAM_EXPIRATION = gql`
  mutation UpdateTeamExpiration($teamId: Int!, $eventId: Int!, $keycode: String!, $expirationDate: DateTime) {
    updateTeamExpiration(
      team_id: $teamId
      event_id: $eventId
      keycode: $keycode
      expiration_date: $expirationDate
    ) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`

export const UPDATE_TEAM_ACCESS_WINDOW = gql`
  mutation UpdateTeamAccessWindow($teamId: Int!, $eventId: Int!, $keycode: String!, $startDate: String, $endDate: String) {
    updateTeamAccessWindow(
      team_id: $teamId
      event_id: $eventId
      keycode: $keycode
      start_date: $startDate
      end_date: $endDate
    ) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`

export const DELETE_TEAM = gql`
  mutation DeleteTeam($teamId: Int!, $eventId: Int!, $keycode: String!) {
    deleteTeam(team_id: $teamId, event_id: $eventId, keycode: $keycode) {
      id
      name
      color
      event_id
      expiration_date
      access_start_date
      access_end_date
      activated
    }
  }
`
