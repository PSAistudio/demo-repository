/**
 * FX Operations
 *
 * Foreign exchange rate inquiry, currency conversion, and BOT reporting
 * threshold checks. All monetary values in minor units (satang).
 */

import { db, type DbClient } from "@thai-bank/db";
import type { FxRateType, FxTransactionType } from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FxRateResult {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rateType: FxRateType;
  bidRate: number;
  askRate: number;
  midRate: number;
  effectiveDate: Date;
  source: string;
}

export interface FxTransactionResult {
  id: string;
  transactionType: FxTransactionType;
  sellCurrency: string;
  buyCurrency: string;
  sellAmount: number;
  buyAmount: number;
  exchangeRate: number;
  customerRate: number;
  status: string;
  requiresBotReporting: boolean;
}

// BOT reporting thresholds (in THB minor units = satang)
// Current threshold: 200,000 THB = 20,000,000 satang
const BOT_REPORTING_THRESHOLD_THB = 20_000_000;

// ---------------------------------------------------------------------------
// getFxRate
// ---------------------------------------------------------------------------

export async function getFxRate(
  baseCurrency: string,
  quoteCurrency: string,
  rateType: FxRateType = "spot",
  client?: DbClient
): Promise<FxRateResult> {
  const executor = client ?? db;

  const rate = await executor
    .selectFrom("fx_rates")
    .selectAll()
    .where("base_currency", "=", baseCurrency)
    .where("quote_currency", "=", quoteCurrency)
    .where("rate_type", "=", rateType)
    .where("is_active", "=", true)
    .where("effective_date", "<=", new Date())
    .orderBy("effective_date", "desc")
    .executeTakeFirst();

  if (!rate) {
    throw new Error(
      `No active ${rateType} rate found for ${baseCurrency}/${quoteCurrency}`
    );
  }

  // Check if rate has expired
  if (rate.expiry_date && new Date(rate.expiry_date) < new Date()) {
    throw new Error(
      `FX rate for ${baseCurrency}/${quoteCurrency} has expired`
    );
  }

  return {
    id: rate.id,
    baseCurrency: rate.base_currency,
    quoteCurrency: rate.quote_currency,
    rateType: rate.rate_type as FxRateType,
    bidRate: Number(rate.bid_rate),
    askRate: Number(rate.ask_rate),
    midRate: Number(rate.mid_rate),
    effectiveDate: rate.effective_date,
    source: rate.source,
  };
}

// ---------------------------------------------------------------------------
// executeFxTransaction
// ---------------------------------------------------------------------------

export async function executeFxTransaction(
  params: {
    transactionType: FxTransactionType;
    sellCurrency: string;
    buyCurrency: string;
    sellAmount: number;
    accountId: string;
    counterpartyAccountId?: string;
    rateType?: FxRateType;
    spreadMarkup?: number;
    reference?: string;
    createdBy: string;
  },
  client?: DbClient
): Promise<FxTransactionResult> {
  const executor = client ?? db;

  // Validate account
  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", params.accountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Account ${params.accountId} not found`);
  }

  if (account.status !== "active") {
    throw new Error(
      `Account ${params.accountId} is not active (status: ${account.status})`
    );
  }

  // Get current FX rate
  const rate = await getFxRate(
    params.sellCurrency,
    params.buyCurrency,
    params.rateType ?? "spot",
    client
  );

  // Determine the exchange rate based on transaction direction
  let exchangeRate: number;
  if (params.transactionType === "buy") {
    // Customer buys foreign currency from bank -> bank sells at ask rate
    exchangeRate = rate.askRate;
  } else if (params.transactionType === "sell") {
    // Customer sells foreign currency to bank -> bank buys at bid rate
    exchangeRate = rate.bidRate;
  } else {
    // Conversion uses mid rate
    exchangeRate = rate.midRate;
  }

  // Apply spread markup if provided (in basis points)
  const spreadMarkup = params.spreadMarkup ?? 0;
  const customerRate = exchangeRate * (1 + spreadMarkup / 10000);

  // Calculate buy amount
  // sellAmount is in sellCurrency minor units
  // buyAmount = sellAmount * customerRate (scaled appropriately)
  const buyAmount = Math.round(params.sellAmount * customerRate);

  if (buyAmount <= 0) {
    throw new Error("Calculated buy amount must be greater than zero");
  }

  // Check if customer has sufficient balance in sell currency
  if (params.sellCurrency === account.currency) {
    if (Number(account.available_balance) < params.sellAmount) {
      throw new Error(
        `Insufficient balance in account ${params.accountId}. Available: ${account.available_balance}, Required: ${params.sellAmount}`
      );
    }
  }

  const transactionId = randomUUID();
  const now = new Date();

  // Insert FX transaction record
  await executor
    .insertInto("fx_transactions")
    .values({
      id: transactionId,
      transaction_type: params.transactionType,
      sell_currency: params.sellCurrency,
      buy_currency: params.buyCurrency,
      sell_amount: params.sellAmount,
      buy_amount: buyAmount,
      exchange_rate: exchangeRate,
      base_rate: rate.midRate,
      spread: customerRate - rate.midRate,
      customer_rate: customerRate,
      account_id: params.accountId,
      counterparty_account_id: params.counterpartyAccountId ?? null,
      value_date: now,
      settlement_date: now,
      status: "settled",
      reference: params.reference ?? `FX-${transactionId.slice(0, 8).toUpperCase()}`,
      created_by: params.createdBy,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Post ledger entries
  const batchId = createBatch(params.createdBy);

  // Debit: sell currency from customer deposits
  addEntry(
    batchId,
    "2000",
    "debit",
    params.sellAmount,
    params.sellCurrency,
    `FX ${params.transactionType} - ${params.sellCurrency}${params.sellAmount} to ${params.buyCurrency}${buyAmount}`,
    params.reference ?? `FX-${transactionId.slice(0, 8).toUpperCase()}`,
    undefined,
    undefined,
    {
      fx_transaction_id: transactionId,
      sell_currency: params.sellCurrency,
      buy_currency: params.buyCurrency,
      exchange_rate: customerRate,
    }
  );

  // Credit: buy currency to customer deposits
  addEntry(
    batchId,
    "2000",
    "credit",
    buyAmount,
    params.buyCurrency,
    `FX ${params.transactionType} proceeds - ${params.buyCurrency}${buyAmount}`,
    params.reference ?? `FX-${transactionId.slice(0, 8).toUpperCase()}`,
    undefined,
    undefined,
    {
      fx_transaction_id: transactionId,
      sell_currency: params.sellCurrency,
      buy_currency: params.buyCurrency,
      exchange_rate: customerRate,
    }
  );

  // FX gain/loss entry if there is a spread
  const spreadAmount = buyAmount - Math.round(params.sellAmount * rate.midRate);
  if (spreadAmount !== 0) {
    addEntry(
      batchId,
      spreadAmount > 0 ? "4100" : "5100",
      spreadAmount > 0 ? "credit" : "debit",
      Math.abs(spreadAmount),
      params.buyCurrency,
      `FX spread income/expense - ${params.sellCurrency}/${params.buyCurrency}`,
      `FX-SPREAD-${transactionId.slice(0, 8).toUpperCase()}`,
      undefined,
      undefined,
      { fx_transaction_id: transactionId }
    );
  }

  await postBatch(batchId, client);

  // Update account balances
  if (params.sellCurrency === account.currency) {
    await executor
      .updateTable("accounts")
      .set({
        balance: Number(account.balance) - params.sellAmount,
        available_balance: Number(account.available_balance) - params.sellAmount,
        last_transaction_at: now,
        updated_at: now,
      })
      .where("id", "=", params.accountId)
      .execute();
  } else if (params.buyCurrency === account.currency) {
    await executor
      .updateTable("accounts")
      .set({
        balance: Number(account.balance) + buyAmount,
        available_balance: Number(account.available_balance) + buyAmount,
        last_transaction_at: now,
        updated_at: now,
      })
      .where("id", "=", params.accountId)
      .execute();
  }

  // Check BOT reporting requirement
  const requiresBotReporting = checkBotReportingThreshold(
    params.sellCurrency,
    params.sellAmount,
    params.buyCurrency,
    buyAmount
  );

  return {
    id: transactionId,
    transactionType: params.transactionType,
    sellCurrency: params.sellCurrency,
    buyCurrency: params.buyCurrency,
    sellAmount: params.sellAmount,
    buyAmount,
    exchangeRate,
    customerRate,
    status: "settled",
    requiresBotReporting,
  };
}

// ---------------------------------------------------------------------------
// checkBotReportingThreshold
// ---------------------------------------------------------------------------

export function checkBotReportingThreshold(
  sellCurrency: string,
  sellAmount: number,
  buyCurrency: string,
  buyAmount: number
): boolean {
  // Any transaction involving THB where the THB equivalent meets or exceeds
  // the BOT reporting threshold requires reporting.
  if (sellCurrency === "THB" && sellAmount >= BOT_REPORTING_THRESHOLD_THB) {
    return true;
  }

  if (buyCurrency === "THB" && buyAmount >= BOT_REPORTING_THRESHOLD_THB) {
    return true;
  }

  return false;
}
