// Unified eypi.cc API base origin (auth, links, events, orgs, forms, etc.).
// Override with VITE_API_BASE_URL in .env.local for local wrangler dev (http://localhost:8787).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.eypi.cc'

/** True when Vite dev server talks to a local wrangler API (banner + health check). */
export const IS_LOCAL_DEV =
  import.meta.env.DEV &&
  /^https?:\/\/localhost(:\d+)?$/i.test(new URL(API_BASE_URL).origin)
