// Single source of truth for the eypi.cc super-admin email — shared by the
// backend org-management guard (backend/src/routes/orgs.ts) and the
// frontend admin config (src/config/admin.ts) so the two can't drift.
export const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'
