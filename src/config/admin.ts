export const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'

export interface AdminOrgListItem {
  org_id: string
  org_name: string
  owner_email: string
  is_public_catalog: number
  created_at: string
}
