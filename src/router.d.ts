/// <reference types="vue-router" />

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresOrg?: boolean
  }
}

export {}
