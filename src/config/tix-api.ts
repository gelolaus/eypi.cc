// Ticketing API base. After the suite merge this is the same unified backend
// origin as the rest of eypi.cc (the Worker now serves /api/events/* too).
export const TIX_API_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.eypi.cc'
