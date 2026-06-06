export type BotMessageType =
  | "pacs.008"
  | "pacs.002"
  | "pacs.004"
  | "camt.053"
  | "camt.054"
  | "camt.056"
  | "admin.001"
  | "custom";

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus =
  | "received"
  | "parsing"
  | "parsed"
  | "validating"
  | "validated"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "acked"
  | "nacked";

export interface BotMessagesTable {
  id: string;
  message_id: string;
  message_type: BotMessageType;
  direction: MessageDirection;
  status: MessageStatus;
  sender_bic: string;
  receiver_bic: string;
  raw_payload: string;
  parsed_payload: Record<string, unknown> | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BotMessageTrackingTable {
  id: string;
  message_id: string;
  from_status: MessageStatus;
  to_status: MessageStatus;
  changed_by: string;
  changed_at: Date;
  notes: string | null;
}
