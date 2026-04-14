export const resolveAccessLevel = (event) => {
  if (event?.access_level === 'view') return 'view'
  return 'manage'
}

export const hasManageAccess = (event) => resolveAccessLevel(event) === 'manage'

// Public event reads intentionally do not expose manage keycodes.
// Merge fetched event payload with previously-authenticated key data.
export const mergeEventWithAuthFields = (fetchedEvent, previousEvent) => {
  const merged = {
    ...(previousEvent || {}),
    ...(fetchedEvent || {}),
  }

  const previousAccess = resolveAccessLevel(previousEvent)
  const fetchedAccess = resolveAccessLevel(fetchedEvent)

  // Preserve keycodes from previous event if fetched ones are empty (API returns empty for security)
  merged.keycode = fetchedEvent?.keycode || previousEvent?.keycode || ''
  merged.view_keycode = fetchedEvent?.view_keycode || previousEvent?.view_keycode || ''
  merged.field_keycode = fetchedEvent?.field_keycode || previousEvent?.field_keycode || ''
  merged.access_level = fetchedEvent?.access_level || previousEvent?.access_level || (previousAccess === 'view' || fetchedAccess === 'view' ? 'view' : 'manage')

  return merged
}
