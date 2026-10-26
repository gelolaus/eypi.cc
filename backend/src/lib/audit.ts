import type { Client } from '@libsql/client/web'

export type AuditEvent = {
  actorUserId: string
  action: string
  targetType: string
  targetId: string
  meta: unknown
}

export async function recordAudit(database: Client, event: AuditEvent): Promise<void> {
  await database.execute({
    sql: `INSERT INTO audit_events
      (id, actor_user_id, action, target_type, target_id, meta)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      event.actorUserId,
      event.action,
      event.targetType,
      event.targetId,
      event.meta == null ? null : JSON.stringify(event.meta),
    ],
  })
}
