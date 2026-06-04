import { db, type DbClient } from "@thai-bank/db";
import type { AccountCurrency } from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import { randomUUID } from "crypto";

export type InterbankChannel = "BAHTNET" | "ITMX";

export interface InterbankTransferParams {
  fromAccountId: string;
  toAccountNo: string;
  toBankCode: string;
  toAccountName: string;
  amount: number;
  currency: AccountCurrency;
  channel: InterbankChannel;
  description: string;
  initiatedBy: string;
}

export interface InterbankTransferResult {
  transactionId: string;
  batchId: string;
  fromAccountNo: string;
  toAccountNo: string;
  toBankCode: string;
  amount: number;
  currency: string;
  channel: InterbankChannel;
  status: string;
  reference: string;
}

export async function initiateInterbankTransfer(
  params: InterbankTransferParams,
  client?: DbClient
): Promise<InterbankTransferResult> {
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

  if (params.channel === "BAHTNET" && params.amount < 2000000) {
    throw new Error(
      "BAHTNET transfers require a minimum amount of 2,000,000 THB"
    );
  }

  const transactionId = randomUUID();
  const reference = `IB-${params.channel}-${transactionId.slice(0, 8).toUpperCase()}`;

  const batchId = createBatch(params.initiatedBy);

  // Debit source account
  addEntry(
    batchId,
    "2000",
    "debit",
    params.amount,
    params.currency,
    `Interbank transfer to ${params.toAccountNo} (${params.toBankCode}) via ${params.channel} - ${params.description}`,
    reference,
    params.toAccountNo,
    params.toBankCode,
    { interbank: true, channel: params.channel, to_account_name: params.toAccountName }
  );

  // Credit due to banks (interbank settlement)
  addEntry(
    batchId,
    "2100",
    "credit",
    params.amount,
    params.currency,
    `Interbank transfer from ${fromAccount.account_no} to ${params.toAccountNo} (${params.toBankCode}) via ${params.channel}`,
    reference,
    fromAccount.account_no,
    params.toBankCode,
    { interbank: true, channel: params.channel }
  );

  await postBatch(batchId, client);

  // Update source account balance
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

  return {
    transactionId,
    batchId,
    fromAccountNo: fromAccount.account_no,
    toAccountNo: params.toAccountNo,
    toBankCode: params.toBankCode,
    amount: params.amount,
    currency: params.currency,
    channel: params.channel,
    status: "pending_settlement",
    reference,
  };
}
