import { db, type DbClient } from "@thai-bank/db";
import type {
  AccountType,
  AccountStatus,
  AccountCurrency,
} from "@thai-bank/db/schemas";
import { generateBHAccountNo } from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import { randomUUID } from "crypto";

const DORMANCY_MONTHS = 12;

export interface OpenAccountParams {
  accountType: AccountType;
  currency: AccountCurrency;
  branchCode: string;
  citizenId?: string;
  taxId?: string;
  phoneNumber?: string;
  productCode: string;
  initialDeposit?: number;
  openedBy: string;
}

export interface AccountResult {
  id: string;
  accountNo: string;
  status: AccountStatus;
}

export async function openAccount(
  params: OpenAccountParams,
  client?: DbClient
): Promise<AccountResult> {
  const executor = client ?? db;
  const accountId = randomUUID();

  const sequenceResult = await executor
    .selectFrom("accounts")
    .select(({ fn }) => [fn.countAll().as("count")])
    .where("account_type", "=", params.accountType)
    .where("branch_code", "=", params.branchCode)
    .executeTakeFirst();

  const sequence = Number(sequenceResult?.count ?? 0) + 1;
  const accountNo = generateBHAccountNo(
    params.accountType,
    params.branchCode,
    sequence
  );

  const initialDeposit = params.initialDeposit ?? 0;

  await executor
    .insertInto("accounts")
    .values({
      id: accountId,
      account_no: accountNo,
      account_type: params.accountType,
      status: "active",
      currency: params.currency,
      balance: initialDeposit,
      available_balance: initialDeposit,
      hold_amount: 0,
      interest_rate: 0,
      overdraft_limit: 0,
      minimum_balance: params.accountType === "current" ? 1000 : 500,
      product_code: params.productCode,
      branch_code: params.branchCode,
      citizen_id: params.citizenId ?? null,
      tax_id: params.taxId ?? null,
      phone_number: params.phoneNumber ?? null,
      co_owner_ids: null,
      opened_at: new Date(),
      closed_at: null,
      frozen_reason: null,
      dormant_at: null,
      last_transaction_at: initialDeposit > 0 ? new Date() : null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  if (initialDeposit > 0) {
    const batchId = createBatch(params.openedBy);
    addEntry(
      batchId,
      "1000",
      "debit",
      initialDeposit,
      params.currency,
      `Initial deposit for account ${accountNo}`,
      `OPEN-${accountNo}`,
      accountNo,
      undefined,
      { account_opening: true }
    );
    addEntry(
      batchId,
      "2000",
      "credit",
      initialDeposit,
      params.currency,
      `Initial deposit for account ${accountNo}`,
      `OPEN-${accountNo}`,
      accountNo,
      undefined,
      { account_opening: true }
    );
    await postBatch(batchId, client);
  }

  return {
    id: accountId,
    accountNo,
    status: "active",
  };
}

export async function closeAccount(
  accountId: string,
  closedBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", accountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  if (account.status === "closed") {
    throw new Error(`Account ${accountId} is already closed`);
  }
  if (Number(account.balance) !== 0) {
    throw new Error(
      `Account ${accountId} has non-zero balance (${account.balance}). Withdraw all funds before closing.`
    );
  }

  await executor
    .updateTable("accounts")
    .set({
      status: "closed",
      closed_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", accountId)
    .execute();
}

export async function freezeAccount(
  accountId: string,
  reason: string,
  frozenBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", accountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  if (account.status !== "active") {
    throw new Error(
      `Account ${accountId} cannot be frozen (current status: ${account.status})`
    );
  }

  await executor
    .updateTable("accounts")
    .set({
      status: "frozen",
      frozen_reason: reason,
      updated_at: new Date(),
    })
    .where("id", "=", accountId)
    .execute();
}

export async function unfreezeAccount(
  accountId: string,
  unfrozenBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", accountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  if (account.status !== "frozen") {
    throw new Error(
      `Account ${accountId} is not frozen (current status: ${account.status})`
    );
  }

  await executor
    .updateTable("accounts")
    .set({
      status: "active",
      frozen_reason: null,
      updated_at: new Date(),
    })
    .where("id", "=", accountId)
    .execute();
}

export async function markDormant(
  accountId: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", accountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  if (account.status !== "active") {
    throw new Error(
      `Account ${accountId} cannot be marked dormant (current status: ${account.status})`
    );
  }

  const lastTransactionAt = account.last_transaction_at ?? account.opened_at;
  const dormantThreshold = new Date(lastTransactionAt);
  dormantThreshold.setMonth(dormantThreshold.getMonth() + DORMANCY_MONTHS);

  if (new Date() < dormantThreshold) {
    throw new Error(
      `Account ${accountId} does not meet dormancy criteria. Last activity: ${lastTransactionAt.toISOString()}`
    );
  }

  await executor
    .updateTable("accounts")
    .set({
      status: "dormant",
      dormant_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "=", accountId)
    .execute();
}
