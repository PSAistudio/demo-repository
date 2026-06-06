import { db, type DbClient, type DbTransaction } from "@thai-bank/db";
import type { EntryType, EntryStatus } from "@thai-bank/db/schemas";
import { randomUUID } from "crypto";

export interface LedgerEntry {
  id: string;
  batch_id: string;
  ledger_account: string;
  entry_type: EntryType;
  amount: number;
  currency: string;
  status: EntryStatus;
  reference: string | null;
  description: string;
  value_date: Date;
  booking_date: Date;
  counterparty_account: string | null;
  counterparty_bank: string | null;
  reversal_of: string | null;
  reversed_by: string | null;
  created_by: string;
  posted_at: Date | null;
  posted_by: string | null;
  metadata: Record<string, unknown> | null;
}

export type BatchStatus = "open" | "posted" | "reversed" | "failed";

export interface LedgerBatch {
  batch_id: string;
  entries: LedgerEntry[];
  status: BatchStatus;
  created_by: string;
  created_at: Date;
}

const activeBatches = new Map<string, LedgerBatch>();

export function createBatch(createdBy: string): string {
  const batchId = randomUUID();
  const batch: LedgerBatch = {
    batch_id: batchId,
    entries: [],
    status: "open",
    created_by: createdBy,
    created_at: new Date(),
  };
  activeBatches.set(batchId, batch);
  return batchId;
}

export function addEntry(
  batchId: string,
  ledgerAccount: string,
  entryType: "debit" | "credit",
  amount: number,
  currency: string,
  description: string,
  reference?: string,
  counterpartyAccount?: string,
  counterpartyBank?: string,
  metadata?: Record<string, unknown>
): void {
  const batch = activeBatches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }
  if (batch.status !== "open") {
    throw new Error(`Batch ${batchId} is not open (status: ${batch.status})`);
  }

  const debitEntry: LedgerEntry = {
    id: randomUUID(),
    batch_id: batchId,
    ledger_account: ledgerAccount,
    entry_type: entryType,
    amount,
    currency,
    status: "pending",
    reference: reference ?? null,
    description,
    value_date: new Date(),
    booking_date: new Date(),
    counterparty_account: counterpartyAccount ?? null,
    counterparty_bank: counterpartyBank ?? null,
    reversal_of: null,
    reversed_by: null,
    created_by: batch.created_by,
    posted_at: null,
    posted_by: null,
    metadata: metadata ?? null,
  };

  const creditEntry: LedgerEntry = {
    ...debitEntry,
    id: randomUUID(),
    entry_type: entryType === "debit" ? "credit" : "debit",
  };

  batch.entries.push(debitEntry, creditEntry);
}

export async function postBatch(
  batchId: string,
  client?: DbClient
): Promise<void> {
  const batch = activeBatches.get(batchId);
  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }
  if (batch.status !== "open") {
    throw new Error(`Batch ${batchId} is not open (status: ${batch.status})`);
  }
  if (batch.entries.length === 0) {
    throw new Error(`Batch ${batchId} has no entries`);
  }

  // Validate debits = credits
  const debitTotal = batch.entries
    .filter((e) => e.entry_type === "debit")
    .reduce((sum, e) => sum + e.amount, 0);
  const creditTotal = batch.entries
    .filter((e) => e.entry_type === "credit")
    .reduce((sum, e) => sum + e.amount, 0);

  if (Math.abs(debitTotal - creditTotal) > 0.001) {
    batch.status = "failed";
    throw new Error(
      `Batch ${batchId} is not balanced: debits=${debitTotal}, credits=${creditTotal}`
    );
  }

  const executor = client ?? db;

  await executor.transaction().execute(async (trx) => {
    for (const entry of batch.entries) {
      await trx
        .insertInto("ledger_entries")
        .values({
          id: entry.id,
          batch_id: entry.batch_id,
          ledger_account: entry.ledger_account,
          entry_type: entry.entry_type,
          amount: entry.amount,
          currency: entry.currency,
          status: "posted",
          reference: entry.reference,
          description: entry.description,
          value_date: entry.value_date,
          booking_date: entry.booking_date,
          counterparty_account: entry.counterparty_account,
          counterparty_bank: entry.counterparty_bank,
          reversal_of: entry.reversal_of,
          reversed_by: entry.reversed_by,
          created_by: entry.created_by,
          posted_at: new Date(),
          posted_by: entry.created_by,
          metadata: entry.metadata,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();
    }
  });

  batch.status = "posted";
  batch.entries.forEach((e) => {
    e.status = "posted";
    e.posted_at = new Date();
    e.posted_by = batch.created_by;
  });
}

export async function reverseBatch(
  originalBatchId: string,
  reversedBy: string,
  client?: DbClient
): Promise<string> {
  const originalBatch = activeBatches.get(originalBatchId);
  if (!originalBatch) {
    throw new Error(`Original batch ${originalBatchId} not found`);
  }
  if (originalBatch.status !== "posted") {
    throw new Error(
      `Original batch ${originalBatchId} is not posted (status: ${originalBatch.status})`
    );
  }

  const reversalBatchId = createBatch(reversedBy);
  const reversalBatch = activeBatches.get(reversalBatchId)!;

  for (const originalEntry of originalBatch.entries) {
    const reversedEntry: LedgerEntry = {
      ...originalEntry,
      id: randomUUID(),
      batch_id: reversalBatchId,
      entry_type: originalEntry.entry_type === "debit" ? "credit" : "debit",
      status: "pending",
      reversal_of: originalEntry.id,
      reversed_by: null,
      posted_at: null,
      posted_by: null,
      created_by: reversedBy,
      metadata: {
        ...originalEntry.metadata,
        reversal_reason: `Reversal of batch ${originalBatchId}`,
      },
    };
    reversalBatch.entries.push(reversedEntry);
  }

  await postBatch(reversalBatchId, client);

  originalBatch.status = "reversed";
  originalBatch.entries.forEach((e) => {
    e.reversed_by = reversalBatchId;
  });

  return reversalBatchId;
}

export async function getAccountBalance(
  accountId: string,
  balanceType: "debit" | "credit",
  client?: DbClient
): Promise<number> {
  const executor = client ?? db;

  const result = await executor
    .selectFrom("ledger_entries")
    .select(({ fn }) => [
      fn.coalesce(fn.sum("amount"), 0).as("total"),
    ])
    .where("ledger_account", "=", accountId)
    .where("entry_type", "=", balanceType)
    .where("status", "=", "posted")
    .executeTakeFirstOrThrow();

  return Number(result.total);
}

export function getBatch(batchId: string): LedgerBatch | undefined {
  return activeBatches.get(batchId);
}
