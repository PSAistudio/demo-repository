export interface AuditLogsTable {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}
