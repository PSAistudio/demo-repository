/**
 * BOT Message API Routes
 *
 * Endpoints for BOT (Bank of Thailand) ISO 20022 message inquiry and sending.
 */

import { db } from "@thai-bank/db";
import type { BotMessageType, MessageDirection, MessageStatus } from "@thai-bank/db/schemas";
import { buildPacs008, buildPacs002, generateMessageId } from "@thai-bank/core";
import type { ApiResponse } from "./index.js";

// ---------------------------------------------------------------------------
// GET /api/bot/messages - List BOT messages with filtering
// ---------------------------------------------------------------------------
export async function handleListBotMessages(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const messageType = url.searchParams.get("messageType") as BotMessageType | null;
  const direction = url.searchParams.get("direction") as MessageDirection | null;
  const status = url.searchParams.get("status") as MessageStatus | null;
  const senderBic = url.searchParams.get("senderBic");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("bot_messages").selectAll();

  if (messageType) {
    query = query.where("message_type", "=", messageType);
  }
  if (direction) {
    query = query.where("direction", "=", direction);
  }
  if (status) {
    query = query.where("status", "=", status);
  }
  if (senderBic) {
    query = query.where("sender_bic", "=", senderBic);
  }

  const [messages, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("bot_messages")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!messageType, (qb) => qb.where("message_type", "=", messageType!))
      .$if(!!direction, (qb) => qb.where("direction", "=", direction!))
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .$if(!!senderBic, (qb) => qb.where("sender_bic", "=", senderBic!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: messages,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/bot/messages/:id - Get a specific BOT message
// ---------------------------------------------------------------------------
export async function handleGetBotMessage(
  _request: Request,
  messageId: string
): Promise<Response> {
  const message = await db
    .selectFrom("bot_messages")
    .selectAll()
    .where("id", "=", messageId)
    .executeTakeFirst();

  if (!message) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `BOT message ${messageId} not found` } },
      { status: 404 }
    );
  }

  // Also fetch tracking history
  const tracking = await db
    .selectFrom("bot_message_tracking")
    .selectAll()
    .where("message_id", "=", messageId)
    .orderBy("changed_at", "desc")
    .execute();

  return Response.json({
    success: true,
    data: { ...message, tracking },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// POST /api/bot/messages/send - Send a BOT message (pacs.008)
// ---------------------------------------------------------------------------
export async function handleSendBotMessage(
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    messageType: "pacs.008" | "pacs.002";
    senderBic?: string;
    receiverBic: string;
    payload?: {
      instrId?: string;
      endToEndId?: string;
      amount: number;
      currency: string;
      creditorBIC: string;
      creditorName: string;
      creditorAccountId: string;
      creditorId?: string;
      debtorBIC: string;
      debtorName: string;
      debtorAccountId: string;
      debtorId?: string;
      remittanceInfo?: string;
    };
    relatedEntityId?: string;
    relatedEntityType?: string;
  };

  if (!body.receiverBic) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing required field: receiverBic" },
      },
      { status: 400 }
    );
  }

  const bankBic = process.env.BANK_BIC_CODE ?? "THBKTHBX";
  const senderBic = body.senderBic ?? bankBic;
  const now = new Date();

  let rawPayload: string;
  let parsedPayload: Record<string, unknown>;

  if (body.messageType === "pacs.008" && body.payload) {
    const msgId = generateMessageId();
    const pacs008 = buildPacs008({
      instrId: body.payload.instrId ?? msgId,
      endToEndId: body.payload.endToEndId ?? `E2E-${msgId}`,
      amount: body.payload.amount,
      currency: body.payload.currency,
      creditorBIC: body.payload.creditorBIC,
      creditorName: body.payload.creditorName,
      creditorAccountId: body.payload.creditorAccountId,
      creditorId: body.payload.creditorId,
      debtorBIC: body.payload.debtorBIC ?? senderBic,
      debtorName: body.payload.debtorName,
      debtorAccountId: body.payload.debtorAccountId,
      debtorId: body.payload.debtorId,
      remittanceInfo: body.payload.remittanceInfo,
    });
    rawPayload = JSON.stringify(pacs008);
    parsedPayload = pacs008 as unknown as Record<string, unknown>;
  } else if (body.messageType === "pacs.002") {
    const msgId = generateMessageId();
    const pacs002 = buildPacs002({
      originalMsgId: body.payload?.instrId ?? msgId,
      originalEndToEndId: body.payload?.endToEndId ?? `E2E-${msgId}`,
      originalTxId: msgId,
      txStatus: "ACCP",
    });
    rawPayload = JSON.stringify(pacs002);
    parsedPayload = pacs002 as unknown as Record<string, unknown>;
  } else {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Unsupported or missing messageType" },
      },
      { status: 400 }
    );
  }

  const messageId = generateMessageId();
  const recordId = crypto.randomUUID();

  await db
    .insertInto("bot_messages")
    .values({
      id: recordId,
      message_id: messageId,
      message_type: body.messageType,
      direction: "outbound",
      status: "validated",
      sender_bic: senderBic,
      receiver_bic: body.receiverBic,
      raw_payload: rawPayload,
      parsed_payload: parsedPayload,
      related_entity_id: body.relatedEntityId ?? null,
      related_entity_type: body.relatedEntityType ?? null,
      retry_count: 0,
      max_retries: 3,
      next_retry_at: null,
      error_message: null,
      processed_at: null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Insert tracking entry
  await db
    .insertInto("bot_message_tracking")
    .values({
      id: crypto.randomUUID(),
      message_id: recordId,
      from_status: "received" as MessageStatus,
      to_status: "validated" as MessageStatus,
      changed_by: "system",
      changed_at: now,
      notes: "Message built and validated for outbound sending",
    })
    .execute();

  return Response.json(
    {
      success: true,
      data: {
        id: recordId,
        messageId,
        messageType: body.messageType,
        direction: "outbound",
        status: "validated",
        senderBic,
        receiverBic: body.receiverBic,
      },
    } satisfies ApiResponse,
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/bot/messages/:id/tracking - Get message tracking history
// ---------------------------------------------------------------------------
export async function handleGetBotMessageTracking(
  _request: Request,
  messageId: string
): Promise<Response> {
  const tracking = await db
    .selectFrom("bot_message_tracking")
    .selectAll()
    .where("message_id", "=", messageId)
    .orderBy("changed_at", "asc")
    .execute();

  return Response.json({
    success: true,
    data: tracking,
  } satisfies ApiResponse);
}
