import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresOrg?: boolean
    requiresAdmin?: boolean
    /** 'public' pages use the light PublicShell. Default 'app'. */
    layout?: 'app' | 'public'
    /** Warms this route's data (see `v-prefetch`). Never throws; skipped on save-data. */
    prefetch?: () => Promise<void>
  }
}
