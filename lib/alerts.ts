/**
 * Read-state helpers for client-derived alerts (PURE).
 *
 * Alerts are derived from real machine state; only their read state lives on
 * the device. Marking all read must union the CURRENT alert ids — the previous
 * implementation unioned the read ids with themselves, so nothing ever cleared.
 */

/** Current ids plus every visible alert id, de-duplicated. */
export function markAllAsRead(current: readonly string[], visibleIds: readonly string[]): string[] {
  return Array.from(new Set([...current, ...visibleIds]))
}

/** Unread count for the given alerts, given the set of read ids. */
export function countUnread<T extends { id: string }>(alerts: readonly T[], readIds: readonly string[]): number {
  const read = new Set(readIds)
  return alerts.filter((alert) => !read.has(alert.id)).length
}
