/**
 * Team API - GraphQL Mutations and Queries
 * Contains only GraphQL documents
 */

import { gql } from '@apollo/client'

export const CREATE_TEAM = gql`
  mutation CreateTeam($eventId: Int!, $name: String!, $color: String, $expirationDate: String) {
    createTeam(event_id: $eventId, name: $name, color: $color, expiration_date: $expirationDate) {
      id
      name
      color
      event_id
      expiration_date
    }
  }
`

export const GET_UPDATES = gql`
  query GetUpdates($team: String!, $limit: Int) {
    updates(team: $team, limit: $limit) {
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
    }
  }
`
