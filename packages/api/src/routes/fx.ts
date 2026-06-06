/**
 * FX API Routes
 *
 * Endpoints for FX rate inquiry and currency conversion transactions.
 */

import { db } from "@thai-bank/db";
import type { FxRateType, FxTransactionType } from "@thai-bank/db/schemas";
import {
  getFxRate,
  executeFxTransaction,
  checkBotReportingThreshold,
} from "@thai-bank/core";
import type { ApiResponse } from "./index.js";

// ---------------------------------------------------------------------------
// GET /api/fx/rates - List FX rates
// ---------------------------------------------------------------------------
export async function handleListFxRates(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const baseCurrency = url.searchParams.get("baseCurrency");
  const quoteCurrency = url.searchParams.get("quoteCurrency");
  const rateType = url.searchParams.get("rateType") as FxRateType | null;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("fx_rates").selectAll().where("is_active", "=", true);

  if (baseCurrency) {
    query = query.where("base_currency", "=", baseCurrency);
  }
  if (quoteCurrency) {
    query = query.where("quote_currency", "=", quoteCurrency);
  }
  if (rateType) {
    query = query.where("rate_type", "=", rateType);
  }

  const [rates, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("effective_date", "desc").execute(),
    db
      .selectFrom("fx_rates")
      .select(({ fn }) => [fn.countAll().as("total")])
      .where("is_active", "=", true)
      .$if(!!baseCurrency, (qb) => qb.where("base_currency", "=", baseCurrency!))
      .$if(!!quoteCurrency, (qb) => qb.where("quote_currency", "=", quoteCurrency!))
      .$if(!!rateType, (qb) => qb.where("rate_type", "=", rateType!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: rates,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/fx/rates/:base/:quote - Get specific FX rate
// ---------------------------------------------------------------------------
export async function handleGetFxRate(
  request: Request,
  baseCurrency: string,
  quoteCurrency: string
): Promise<Response> {
  const url = new URL(request.url);
  const rateType = (url.searchParams.get("rateType") ?? "spot") as FxRateType;

  try {
    const rate = await getFxRate(baseCurrency, quoteCurrency, rateType);
    return Response.json({ success: true, data: rate } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "FX_RATE_NOT_FOUND", message } },
      { status: 404 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/fx/transactions - Execute FX transaction
// ---------------------------------------------------------------------------
export async function handleExecuteFxTransaction(
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    transactionType: FxTransactionType;
    sellCurrency: string;
    buyCurrency: string;
    sellAmount: number;
    accountId: string;
    counterpartyAccountId?: string;
    rateType?: FxRateType;
    spreadMarkup?: number;
    reference?: string;
  };

  if (
    !body.transactionType ||
    !body.sellCurrency ||
    !body.buyCurrency ||
    !body.sellAmount ||
    !body.accountId
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: transactionType, sellCurrency, buyCurrency, sellAmount, accountId",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await executeFxTransaction({
      transactionType: body.transactionType,
      sellCurrency: body.sellCurrency,
      buyCurrency: body.buyCurrency,
      sellAmount: body.sellAmount,
      accountId: body.accountId,
      counterpartyAccountId: body.counterpartyAccountId,
      rateType: body.rateType,
      spreadMarkup: body.spreadMarkup,
      reference: body.reference,
      createdBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "FX_TRANSACTION_FAILED", message } },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/fx/transactions - List FX transactions
// ---------------------------------------------------------------------------
export async function handleListFxTransactions(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("fx_transactions").selectAll();

  if (accountId) {
    query = query.where("account_id", "=", accountId);
  }
  if (status) {
    query = query.where("status", "=", status);
  }

  const [transactions, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("fx_transactions")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!accountId, (qb) => qb.where("account_id", "=", accountId!))
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/fx/bot-check - Check if an amount requires BOT reporting
// ---------------------------------------------------------------------------
export async function handleBotReportingCheck(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const sellCurrency = url.searchParams.get("sellCurrency");
  const sellAmount = parseInt(url.searchParams.get("sellAmount") ?? "0", 10);
  const buyCurrency = url.searchParams.get("buyCurrency");
  const buyAmount = parseInt(url.searchParams.get("buyAmount") ?? "0", 10);

  if (!sellCurrency || !buyCurrency) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required parameters: sellCurrency, buyCurrency",
        },
      },
      { status: 400 }
    );
  }

  const requiresReporting = checkBotReportingThreshold(
    sellCurrency,
    sellAmount,
    buyCurrency,
    buyAmount
  );

  return Response.json({
    success: true,
    data: {
      requiresBotReporting: requiresReporting,
      sellCurrency,
      sellAmount,
      buyCurrency,
      buyAmount,
      thresholdThb: 20_000_000, // 200,000 THB in satang
    },
  } satisfies ApiResponse);
}
