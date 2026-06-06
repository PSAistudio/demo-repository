/**
 * Card API Routes
 *
 * Endpoints for card CRUD, activation, blocking, and transaction management.
 */

import { db } from "@thai-bank/db";
import type { CardType, CardStatus, CardNetwork } from "@thai-bank/db/schemas";
import {
  issueCard,
  activateCard,
  blockCard,
  recordCardTransaction,
  checkCreditLimit,
} from "@thai-bank/core";
import type { ApiResponse } from "./index.js";

// ---------------------------------------------------------------------------
// GET /api/cards - List cards with filtering and pagination
// ---------------------------------------------------------------------------
export async function handleListCards(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as CardStatus | null;
  const type = url.searchParams.get("type") as CardType | null;
  const accountId = url.searchParams.get("accountId") as string | null;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("cards").selectAll();

  if (status) {
    query = query.where("status", "=", status);
  }
  if (type) {
    query = query.where("card_type", "=", type);
  }
  if (accountId) {
    query = query.where("account_id", "=", accountId);
  }

  const [cards, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("cards")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .$if(!!type, (qb) => qb.where("card_type", "=", type!))
      .$if(!!accountId, (qb) => qb.where("account_id", "=", accountId!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: cards,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/cards/:id - Get card detail
// ---------------------------------------------------------------------------
export async function handleGetCard(
  _request: Request,
  cardId: string
): Promise<Response> {
  const card = await db
    .selectFrom("cards")
    .selectAll()
    .where("id", "=", cardId)
    .executeTakeFirst();

  if (!card) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `Card ${cardId} not found` } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: card } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// POST /api/cards - Issue a new card
// ---------------------------------------------------------------------------
export async function handleIssueCard(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    cardNumber: string;
    cardType: CardType;
    network: CardNetwork;
    accountId: string;
    cardholderName: string;
    expiryMonth: number;
    expiryYear: number;
    creditLimit?: number;
    cashLimit?: number;
    isContactless?: boolean;
    isInternational?: boolean;
  };

  if (
    !body.cardNumber ||
    !body.cardType ||
    !body.network ||
    !body.accountId ||
    !body.cardholderName ||
    !body.expiryMonth ||
    !body.expiryYear
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: cardNumber, cardType, network, accountId, cardholderName, expiryMonth, expiryYear",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await issueCard({
      cardNumber: body.cardNumber,
      cardType: body.cardType,
      network: body.network,
      accountId: body.accountId,
      cardholderName: body.cardholderName,
      expiryMonth: body.expiryMonth,
      expiryYear: body.expiryYear,
      creditLimit: body.creditLimit,
      cashLimit: body.cashLimit,
      isContactless: body.isContactless,
      isInternational: body.isInternational,
      issuedBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "CARD_ISSUE_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/cards/:id/activate - Activate a card
// ---------------------------------------------------------------------------
export async function handleActivateCard(
  request: Request,
  cardId: string
): Promise<Response> {
  try {
    await activateCard(cardId, "system");

    const updated = await db
      .selectFrom("cards")
      .selectAll()
      .where("id", "=", cardId)
      .executeTakeFirst();

    return Response.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "CARD_ACTIVATE_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/cards/:id/block - Block a card
// ---------------------------------------------------------------------------
export async function handleBlockCard(
  request: Request,
  cardId: string
): Promise<Response> {
  const body = (await request.json()) as { reason?: string };

  try {
    await blockCard(
      cardId,
      body.reason ?? "Administrative block",
      "system"
    );

    const updated = await db
      .selectFrom("cards")
      .selectAll()
      .where("id", "=", cardId)
      .executeTakeFirst();

    return Response.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "CARD_BLOCK_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/cards/:id/credit-limit - Check credit limit
// ---------------------------------------------------------------------------
export async function handleCheckCreditLimit(
  _request: Request,
  cardId: string
): Promise<Response> {
  const url = new URL(_request.url);
  const amount = parseInt(url.searchParams.get("amount") ?? "0", 10);

  try {
    const result = await checkCreditLimit(cardId, amount);
    return Response.json({ success: true, data: result } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "CREDIT_LIMIT_CHECK_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/cards/:id/transactions - Record a card transaction
// ---------------------------------------------------------------------------
export async function handleCardTransaction(
  request: Request,
  cardId: string
): Promise<Response> {
  const body = (await request.json()) as {
    transactionType:
      | "purchase"
      | "cash_advance"
      | "refund"
      | "payment"
      | "fee"
      | "interest"
      | "adjustment";
    amount: number;
    currency: string;
    merchantName?: string;
    merchantCategory?: string;
    merchantId?: string;
    terminalId?: string;
    approvalCode?: string;
    referenceNo?: string;
    isInternational?: boolean;
    billingAmount?: number;
    billingCurrency?: string;
    installmentMonths?: number;
  };

  if (!body.transactionType || !body.amount || !body.currency) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: transactionType, amount, currency",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await recordCardTransaction({
      cardId,
      transactionType: body.transactionType,
      amount: body.amount,
      currency: body.currency,
      merchantName: body.merchantName,
      merchantCategory: body.merchantCategory,
      merchantId: body.merchantId,
      terminalId: body.terminalId,
      approvalCode: body.approvalCode,
      referenceNo: body.referenceNo,
      isInternational: body.isInternational,
      billingAmount: body.billingAmount,
      billingCurrency: body.billingCurrency,
      installmentMonths: body.installmentMonths,
      createdBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "CARD_TXN_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/cards/:id/transactions - List card transactions
// ---------------------------------------------------------------------------
export async function handleListCardTransactions(
  request: Request,
  cardId: string
): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  const [transactions, countResult] = await Promise.all([
    db
      .selectFrom("card_transactions")
      .selectAll()
      .where("card_id", "=", cardId)
      .limit(limit)
      .offset(offset)
      .orderBy("transaction_date", "desc")
      .execute(),
    db
      .selectFrom("card_transactions")
      .select(({ fn }) => [fn.countAll().as("total")])
      .where("card_id", "=", cardId)
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}
