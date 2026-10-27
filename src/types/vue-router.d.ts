import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresOrg?: boolean
    requiresAdmin?: boolean
    /** 'public' pages use the light PublicShell. Default 'app'. */
    layout?: 'app' | 'public'
  }
}
