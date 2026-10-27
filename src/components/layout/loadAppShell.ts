/** The one loader for the signed-in shell chunk. The router warms it early; App.vue renders it. */
export const loadAppShell = () => import('@/components/layout/AppShell.vue')
