import type { RouteLocationNormalized } from 'vue-router'

// Accepts a normalized or a resolved location (resolve() may report a null name).
type GuardRoute = Pick<RouteLocationNormalized, 'matched'> & { name?: RouteLocationNormalized['name'] | null }

/**
 * True when the route cannot be decided without knowing who the visitor is:
 * anything behind sign-in, admin or org checks, plus login and consent.
 * Every other route renders while the session loads in the background.
 */
export function routeNeedsSession(to: GuardRoute): boolean {
  if (to.name === 'login' || to.name === 'consent') return true
  return to.matched.some((record) => (
    record.name === 'login'
    || record.name === 'consent'
    || record.meta.requiresAuth
    || record.meta.requiresAdmin
    || record.meta.requiresOrg
  ))
}

/** Legal, contact, login, consent and account pages stay reachable while consent is pending. */
export function routeSkipsConsent(to: GuardRoute): boolean {
  return to.matched.some((record) => (
    record.name === 'consent'
    || record.name === 'privacy'
    || record.name === 'terms'
    || record.name === 'acceptable-use'
    || record.name === 'contact'
    || record.name === 'login'
    || record.name === 'account'
  ))
}
