export { SUPER_ADMIN_EMAIL } from '@shared/admin'

export interface AdminOrgListItem {
  org_id: string
  org_name: string
  owner_email: string
  is_public_catalog: number
  created_at: string
}
