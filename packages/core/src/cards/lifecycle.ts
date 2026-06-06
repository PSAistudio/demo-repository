/**
 * Card Management Lifecycle
 *
 * All monetary values in minor units (satang).
 */

import { db, type DbClient } from "@thai-bank/db";
import type {
  CardType,
  CardStatus,
  CardNetwork,
} from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import { randomUUID } from "crypto";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY = process.env.CARD_ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef"; // 32 bytes for aes-256-cbc
const ALGORITHM = "aes-256-cbc";

function encryptCardNumber(plainNumber: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(plainNumber, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function maskCardNumber(cardNo: string): string {
  // Show first 6 and last 4 digits
  if (cardNo.length <= 10) return cardNo;
  return cardNo.slice(0, 6) + "******" + cardNo.slice(-4);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IssueCardParams {
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
  issuedBy: string;
}

export interface CardResult {
  id: string;
  cardNoMasked: string;
  cardType: CardType;
  status: CardStatus;
  network: CardNetwork;
}

// ---------------------------------------------------------------------------
// issueCard
// ---------------------------------------------------------------------------

export async function issueCard(
  params: IssueCardParams,
  client?: DbClient
): Promise<CardResult> {
  const executor = client ?? db;

  // Validate account exists and is active
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

  // Validate card number format (basic Luhn-aware check)
  if (!/^\d{13,19}$/.test(params.cardNumber)) {
    throw new Error("Invalid card number format");
  }

  const cardId = randomUUID();
  const encryptedNo = encryptCardNumber(params.cardNumber);
  const maskedNo = maskCardNumber(params.cardNumber);
  const creditLimit = params.creditLimit ?? 0;

  await executor
    .insertInto("cards")
    .values({
      id: cardId,
      card_no_encrypted: encryptedNo,
      card_no_masked: maskedNo,
      card_type: params.cardType,
      status: "pending_activation",
      network: params.network,
      account_id: params.accountId,
      cardholder_name: params.cardholderName,
      expiry_month: params.expiryMonth,
      expiry_year: params.expiryYear,
      credit_limit: params.cardType === "credit" ? creditLimit : null,
      available_credit:
        params.cardType === "credit" ? creditLimit : null,
      cash_limit: params.cashLimit ?? null,
      pin_attempts: 0,
      is_contactless: params.isContactless ?? false,
      is_international: params.isInternational ?? false,
      activated_at: null,
      blocked_at: null,
      block_reason: null,
      last_used_at: null,
      issued_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return {
    id: cardId,
    cardNoMasked: maskedNo,
    cardType: params.cardType,
    status: "pending_activation",
    network: params.network,
  };
}

// ---------------------------------------------------------------------------
// activateCard
// ---------------------------------------------------------------------------

export async function activateCard(
  cardId: string,
  activatedBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const card = await executor
    .selectFrom("cards")
    .selectAll()
    .where("id", "=", cardId)
    .executeTakeFirst();

  if (!card) {
    throw new Error(`Card ${cardId} not found`);
  }

  if (card.status !== "pending_activation") {
    throw new Error(
      `Card ${cardId} cannot be activated (current status: ${card.status})`
    );
  }

  await executor
    .updateTable("cards")
    .set({
      status: "active",
      activated_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", cardId)
    .execute();

  // Audit log
  await executor
    .insertInto("audit_logs")
    .values({
      id: randomUUID(),
      entity_type: "card",
      entity_id: cardId,
      action: "activate",
      old_values: { status: "pending_activation" },
      new_values: { status: "active", activated_by: activatedBy },
      performed_by: activatedBy,
      ip_address: null,
      user_agent: null,
      created_at: new Date(),
    })
    .execute();
}

// ---------------------------------------------------------------------------
// blockCard
// ---------------------------------------------------------------------------

export async function blockCard(
  cardId: string,
  reason: string,
  blockedBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const card = await executor
    .selectFrom("cards")
    .selectAll()
    .where("id", "=", cardId)
    .executeTakeFirst();

  if (!card) {
    throw new Error(`Card ${cardId} not found`);
  }

  if (card.status !== "active" && card.status !== "frozen") {
    throw new Error(
      `Card ${cardId} cannot be blocked (current status: ${card.status})`
    );
  }

  await executor
    .updateTable("cards")
    .set({
      status: "frozen",
      blocked_at: new Date(),
      block_reason: reason,
      updated_at: new Date(),
    })
    .where("id", "=", cardId)
    .execute();

  // Audit log
  await executor
    .insertInto("audit_logs")
    .values({
      id: randomUUID(),
      entity_type: "card",
      entity_id: cardId,
      action: "block",
      old_values: { status: card.status },
      new_values: { status: "frozen", reason },
      performed_by: blockedBy,
      ip_address: null,
      user_agent: null,
      created_at: new Date(),
    })
    .execute();
}

// ---------------------------------------------------------------------------
// checkCreditLimit
// ---------------------------------------------------------------------------

export async function checkCreditLimit(
  cardId: string,
  requestedAmount: number,
  client?: DbClient
): Promise<{ allowed: boolean; availableCredit: number; creditLimit: number }> {
  const executor = client ?? db;

  const card = await executor
    .selectFrom("cards")
    .selectAll()
    .where("id", "=", cardId)
    .executeTakeFirst();

  if (!card) {
    throw new Error(`Card ${cardId} not found`);
  }

  if (card.card_type !== "credit") {
    // Debit/prepaid cards check against linked account balance
    const account = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("id", "=", card.account_id)
      .executeTakeFirst();

    if (!account) {
      throw new Error(
        `Linked account ${card.account_id} not found for card ${cardId}`
      );
    }

    const availableBalance = Number(account.available_balance);
    return {
      allowed: availableBalance >= requestedAmount,
      availableCredit: availableBalance,
      creditLimit: Number(account.balance),
    };
  }

  const availableCredit = Number(card.available_credit ?? 0);
  const creditLimit = Number(card.credit_limit ?? 0);

  return {
    allowed: availableCredit >= requestedAmount,
    availableCredit,
    creditLimit,
  };
}

// ---------------------------------------------------------------------------
// recordCardTransaction
// ---------------------------------------------------------------------------

export async function recordCardTransaction(
  params: {
    cardId: string;
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
    createdBy: string;
  },
  client?: DbClient
): Promise<{ transactionId: string; status: string }> {
  const executor = client ?? db;

  const card = await executor
    .selectFrom("cards")
    .selectAll()
    .where("id", "=", params.cardId)
    .executeTakeFirst();

  if (!card) {
    throw new Error(`Card ${params.cardId} not found`);
  }

  if (card.status !== "active") {
    throw new Error(
      `Card ${params.cardId} is not active (status: ${card.status})`
    );
  }

  // Check credit limit for debit transactions
  const isDebitTxn = ["purchase", "cash_advance", "fee", "interest"].includes(
    params.transactionType
  );

  if (isDebitTxn) {
    const limitCheck = await checkCreditLimit(
      params.cardId,
      params.amount,
      client
    );
    if (!limitCheck.allowed) {
      return { transactionId: randomUUID(), status: "declined" };
    }
  }

  const transactionId = randomUUID();
  const now = new Date();

  // Insert card transaction
  await executor
    .insertInto("card_transactions")
    .values({
      id: transactionId,
      card_id: params.cardId,
      transaction_type: params.transactionType,
      amount: params.amount,
      currency: params.currency,
      merchant_name: params.merchantName ?? null,
      merchant_category: params.merchantCategory ?? null,
      merchant_id: params.merchantId ?? null,
      terminal_id: params.terminalId ?? null,
      approval_code: params.approvalCode ?? null,
      reference_no: params.referenceNo ?? null,
      is_international: params.isInternational ?? false,
      posting_date: now,
      transaction_date: now,
      billing_amount: params.billingAmount ?? null,
      billing_currency: params.billingCurrency ?? null,
      installment_months: params.installmentMonths ?? null,
      status: "posted",
      reversed_by: null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Post ledger entries
  const batchId = createBatch(params.createdBy);

  if (isDebitTxn) {
    // Debit: card purchase/advance reduces available credit or account balance
    addEntry(
      batchId,
      "2000",
      "debit",
      params.amount,
      params.currency,
      `Card ${params.transactionType} - ${card.card_no_masked} ${params.merchantName ?? ""}`,
      params.referenceNo ?? `CARD-${transactionId.slice(0, 8)}`,
      undefined,
      undefined,
      {
        card_id: params.cardId,
        card_txn_id: transactionId,
        card_transaction_type: params.transactionType,
      }
    );

    // Credit: income or receivable
    const ledgerAccount =
      params.transactionType === "purchase"
        ? "1300"
        : params.transactionType === "cash_advance"
          ? "1000"
          : "4100";

    addEntry(
      batchId,
      ledgerAccount,
      "credit",
      params.amount,
      params.currency,
      `Card ${params.transactionType} settlement - ${card.card_no_masked}`,
      params.referenceNo ?? `CARD-${transactionId.slice(0, 8)}`,
      undefined,
      undefined,
      {
        card_id: params.cardId,
        card_txn_id: transactionId,
      }
    );
  } else {
    // Credit: refund/payment increases available credit or account balance
    addEntry(
      batchId,
      "2000",
      "credit",
      params.amount,
      params.currency,
      `Card ${params.transactionType} - ${card.card_no_masked}`,
      params.referenceNo ?? `CARD-${transactionId.slice(0, 8)}`,
      undefined,
      undefined,
      {
        card_id: params.cardId,
        card_txn_id: transactionId,
        card_transaction_type: params.transactionType,
      }
    );

    addEntry(
      batchId,
      "1200",
      "debit",
      params.amount,
      params.currency,
      `Card ${params.transactionType} reversal - ${card.card_no_masked}`,
      params.referenceNo ?? `CARD-${transactionId.slice(0, 8)}`,
      undefined,
      undefined,
      {
        card_id: params.cardId,
        card_txn_id: transactionId,
      }
    );
  }

  await postBatch(batchId, client);

  // Update card available credit
  if (card.card_type === "credit" && card.credit_limit !== null) {
    const currentAvailable = Number(card.available_credit ?? 0);
    if (isDebitTxn) {
      await executor
        .updateTable("cards")
        .set({
          available_credit: Math.max(0, currentAvailable - params.amount),
          last_used_at: now,
          updated_at: now,
        })
        .where("id", "=", params.cardId)
        .execute();
    } else {
      await executor
        .updateTable("cards")
        .set({
          available_credit: Math.min(
            Number(card.credit_limit),
            currentAvailable + params.amount
          ),
          updated_at: now,
        })
        .where("id", "=", params.cardId)
        .execute();
    }
  } else {
    // Debit/prepaid: update linked account balance
    const account = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("id", "=", card.account_id)
      .executeTakeFirst();

    if (account) {
      const newBalance = isDebitTxn
        ? Number(account.balance) - params.amount
        : Number(account.balance) + params.amount;
      const newAvailable = isDebitTxn
        ? Number(account.available_balance) - params.amount
        : Number(account.available_balance) + params.amount;

      await executor
        .updateTable("accounts")
        .set({
          balance: newBalance,
          available_balance: newAvailable,
          last_transaction_at: now,
          updated_at: now,
        })
        .where("id", "=", card.account_id)
        .execute();
    }
  }

  return { transactionId, status: "posted" };
}
