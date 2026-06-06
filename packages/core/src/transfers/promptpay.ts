import { db, type DbClient } from "@thai-bank/db";
import type { AccountCurrency } from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import { randomUUID } from "crypto";

export interface PromptPayTransferParams {
  fromAccountId: string;
  toTaxId?: string;
  toCitizenId?: string;
  toPhoneNumber?: string;
  amount: number;
  currency: AccountCurrency;
  description: string;
  initiatedBy: string;
}

export interface PromptPayTransferResult {
  transactionId: string;
  batchId: string;
  fromAccountNo: string;
  toIdentifier: string;
  amount: number;
  currency: string;
  status: string;
}

export async function initiatePromptPayTransfer(
  params: PromptPayTransferParams,
  client?: DbClient
): Promise<PromptPayTransferResult> {
  const executor = client ?? db;

  const fromAccount = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", params.fromAccountId)
    .executeTakeFirst();

  if (!fromAccount) {
    throw new Error(`Source account ${params.fromAccountId} not found`);
  }
  if (fromAccount.status !== "active") {
    throw new Error(
      `Source account ${params.fromAccountId} is not active (status: ${fromAccount.status})`
    );
  }
  if (Number(fromAccount.available_balance) < params.amount) {
    throw new Error(
      `Insufficient available balance. Available: ${fromAccount.available_balance}, Required: ${params.amount}`
    );
  }

  // Resolve destination account via PromptPay identifier
  const toIdentifier =
    params.toCitizenId ?? params.toTaxId ?? params.toPhoneNumber;
  if (!toIdentifier) {
    throw new Error(
      "One of toCitizenId, toTaxId, or toPhoneNumber must be provided"
    );
  }

  let toAccount: Awaited<ReturnType<typeof executor.selectFrom("accounts").selectAll().executeTakeFirst>>;

  if (params.toCitizenId) {
    toAccount = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("citizen_id", "=", params.toCitizenId)
      .where("status", "=", "active")
      .executeTakeFirst();
  } else if (params.toTaxId) {
    toAccount = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("tax_id", "=", params.toTaxId)
      .where("status", "=", "active")
      .executeTakeFirst();
  } else if (params.toPhoneNumber) {
    toAccount = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("phone_number", "=", params.toPhoneNumber)
      .where("status", "=", "active")
      .executeTakeFirst();
  }

  if (!toAccount) {
    throw new Error(
      `No active account found for PromptPay identifier: ${toIdentifier}`
    );
  }

  if (fromAccount.id === toAccount.id) {
    throw new Error("Source and destination accounts cannot be the same");
  }

  const transactionId = randomUUID();
  const reference = `PP-${transactionId.slice(0, 8).toUpperCase()}`;

  const batchId = createBatch(params.initiatedBy);

  // Debit source account
  addEntry(
    batchId,
    "2000",
    "debit",
    params.amount,
    params.currency,
    `PromptPay transfer to ${toIdentifier} - ${params.description}`,
    reference,
    toAccount.account_no,
    undefined,
    { promptpay: true, to_identifier: toIdentifier }
  );

  // Credit destination account
  addEntry(
    batchId,
    "2000",
    "credit",
    params.amount,
    params.currency,
    `PromptPay transfer from ${fromAccount.account_no} - ${params.description}`,
    reference,
    fromAccount.account_no,
    undefined,
    { promptpay: true, from_account: fromAccount.account_no }
  );

  await postBatch(batchId, client);

  // Update account balances
  await executor
    .updateTable("accounts")
    .set({
      balance: Number(fromAccount.balance) - params.amount,
      available_balance: Number(fromAccount.available_balance) - params.amount,
      last_transaction_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", fromAccount.id)
    .execute();

  await executor
    .updateTable("accounts")
    .set({
      balance: Number(toAccount.balance) + params.amount,
      available_balance: Number(toAccount.available_balance) + params.amount,
      last_transaction_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", toAccount.id)
    .execute();

  return {
    transactionId,
    batchId,
    fromAccountNo: fromAccount.account_no,
    toIdentifier,
    amount: params.amount,
    currency: params.currency,
    status: "completed",
  };
}

export interface PromptPayInquiryResult {
  identifier: string;
  identifierType: "citizen_id" | "tax_id" | "phone";
  accountNo: string;
  accountType: string;
  displayName: string;
  bankCode: string;
  isVerified: boolean;
}

export async function inquiryPromptPay(
  params:
    | { citizenId: string }
    | { taxId: string }
    | { phoneNumber: string },
  client?: DbClient
): Promise<PromptPayInquiryResult> {
  const executor = client ?? db;

  let account: Awaited<ReturnType<typeof executor.selectFrom("accounts").selectAll().executeTakeFirst>>;
  let identifierType: "citizen_id" | "tax_id" | "phone";
  let identifier: string;

  if ("citizenId" in params) {
    identifier = params.citizenId;
    identifierType = "citizen_id";
    account = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("citizen_id", "=", params.citizenId)
      .where("status", "=", "active")
      .executeTakeFirst();
  } else if ("taxId" in params) {
    identifier = params.taxId;
    identifierType = "tax_id";
    account = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("tax_id", "=", params.taxId)
      .where("status", "=", "active")
      .executeTakeFirst();
  } else {
    identifier = params.phoneNumber;
    identifierType = "phone";
    account = await executor
      .selectFrom("accounts")
      .selectAll()
      .where("phone_number", "=", params.phoneNumber)
      .where("status", "=", "active")
      .executeTakeFirst();
  }

  if (!account) {
    throw new Error(
      `No active account found for PromptPay identifier: ${identifier}`
    );
  }

  return {
    identifier,
    identifierType,
    accountNo: account.account_no,
    accountType: account.account_type,
    displayName: "***" + (account.citizen_id?.slice(-4) ?? "0000"),
    bankCode: account.branch_code,
    isVerified: true,
  };
}
