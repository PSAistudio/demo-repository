/**
 * Financial Reports API Routes
 *
 * Endpoints for trial balance and account statement generation.
 */

import { db } from "@thai-bank/db";
import { CHART_OF_ACCOUNTS } from "@thai-bank/db/schemas";
import type { ApiResponse } from "./index.js";

// ---------------------------------------------------------------------------
// GET /api/reports/trial-balance - Generate trial balance report
// ---------------------------------------------------------------------------
export async function handleTrialBalance(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const asOfDate = url.searchParams.get("asOfDate")
    ? new Date(url.searchParams.get("asOfDate")!)
    : new Date();

  // Fetch all posted ledger entries up to the as-of date
  const entries = await db
    .selectFrom("ledger_entries")
    .select([
      "ledger_account",
      "entry_type",
      "amount",
      "currency",
    ])
    .where("status", "=", "posted")
    .where("value_date", "<=", asOfDate)
    .execute();

  // Aggregate by ledger account
  const accountTotals = new Map<
    string,
    { debit: Map<string, number>; credit: Map<string, number> }
  >();

  for (const entry of entries) {
    if (!accountTotals.has(entry.ledger_account)) {
      accountTotals.set(entry.ledger_account, {
        debit: new Map(),
        credit: new Map(),
      });
    }
    const totals = accountTotals.get(entry.ledger_account)!;
    const currencyMap =
      entry.entry_type === "debit" ? totals.debit : totals.credit;
    currencyMap.set(
      entry.currency,
      (currencyMap.get(entry.currency) ?? 0) + Number(entry.amount)
    );
  }

  // Build trial balance rows using the chart of accounts
  const rows = CHART_OF_ACCOUNTS.filter((a) => a.is_active).map((glAccount) => {
    const totals = accountTotals.get(glAccount.code);
    const thbDebit = totals?.debit.get("THB") ?? 0;
    const thbCredit = totals?.credit.get("THB") ?? 0;

    // Normal balance logic
    let balance: number;
    if (glAccount.normal_balance === "debit") {
      balance = thbDebit - thbCredit;
    } else {
      balance = thbCredit - thbDebit;
    }

    return {
      code: glAccount.code,
      nameEn: glAccount.name_en,
      nameTh: glAccount.name_th,
      type: glAccount.type,
      normalBalance: glAccount.normal_balance,
      totalDebit: thbDebit,
      totalCredit: thbCredit,
      balance,
      balanceDirection: balance >= 0 ? glAccount.normal_balance : (glAccount.normal_balance === "debit" ? "credit" : "debit") as "debit" | "credit",
    };
  });

  // Calculate totals
  const totalDebits = rows.reduce((sum, r) => sum + r.totalDebit, 0);
  const totalCredits = rows.reduce((sum, r) => sum + r.totalCredit, 0);
  const isBalanced = totalDebits === totalCredits;

  return Response.json({
    success: true,
    data: {
      asOfDate: asOfDate.toISOString().split("T")[0],
      currency: "THB",
      generatedAt: new Date().toISOString(),
      isBalanced,
      rows,
      totals: {
        totalDebits,
        totalCredits,
        difference: totalDebits - totalCredits,
      },
    },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/reports/account-statement - Generate account statement
// ---------------------------------------------------------------------------
export async function handleAccountStatement(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  if (!accountId) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required parameter: accountId",
        },
      },
      { status: 400 }
    );
  }

  const account = await db
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", accountId)
    .executeTakeFirst();

  if (!account) {
    return Response.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: `Account ${accountId} not found` },
      },
      { status: 404 }
    );
  }

  const fromDate = url.searchParams.get("fromDate")
    ? new Date(url.searchParams.get("fromDate")!)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = url.searchParams.get("toDate")
    ? new Date(url.searchParams.get("toDate")!)
    : new Date();

  // Fetch account ledger entries for the period
  const entries = await db
    .selectFrom("account_ledger")
    .selectAll()
    .where("account_id", "=", accountId)
    .where("created_at", ">=", fromDate)
    .where("created_at", "<=", toDate)
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute();

  // Calculate opening balance (balance before fromDate)
  const openingEntries = await db
    .selectFrom("account_ledger")
    .selectAll()
    .where("account_id", "=", accountId)
    .where("created_at", "<", fromDate)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(1)
    .execute();

  const openingBalance =
    openingEntries.length > 0 ? Number(openingEntries[0].balance_after) : 0;

  // Calculate closing balance
  const closingBalance =
    entries.length > 0
      ? Number(entries[entries.length - 1].balance_after)
      : openingBalance;

  // Summarize
  const totalDebits = entries
    .filter((e) => e.entry_type === "debit")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCredits = entries
    .filter((e) => e.entry_type === "credit")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return Response.json({
    success: true,
    data: {
      account: {
        id: account.id,
        accountNo: account.account_no,
        accountType: account.account_type,
        currency: account.currency,
      },
      period: {
        fromDate: fromDate.toISOString().split("T")[0],
        toDate: toDate.toISOString().split("T")[0],
      },
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      entries: entries.map((e) => ({
        id: e.id,
        date: e.created_at,
        entryType: e.entry_type,
        amount: Number(e.amount),
        balanceAfter: Number(e.balance_after),
        reference: e.reference,
        description: e.description,
      })),
    },
  } satisfies ApiResponse);
}

// ---------------------------------------------------------------------------
// GET /api/reports/ledger-entries - View ledger entries
// ---------------------------------------------------------------------------
export async function handleListLedgerEntries(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const ledgerAccount = url.searchParams.get("ledgerAccount");
  const status = url.searchParams.get("status");
  const reference = url.searchParams.get("reference");
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("ledger_entries").selectAll();

  if (ledgerAccount) {
    query = query.where("ledger_account", "=", ledgerAccount);
  }
  if (status) {
    query = query.where("status", "=", status);
  }
  if (reference) {
    query = query.where("reference", "=", reference);
  }
  if (fromDate) {
    query = query.where("value_date", ">=", new Date(fromDate));
  }
  if (toDate) {
    query = query.where("value_date", "<=", new Date(toDate));
  }

  const [entries, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("ledger_entries")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!ledgerAccount, (qb) => qb.where("ledger_account", "=", ledgerAccount!))
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .$if(!!reference, (qb) => qb.where("reference", "=", reference!))
      .$if(!!fromDate, (qb) => qb.where("value_date", ">=", new Date(fromDate!)))
      .$if(!!toDate, (qb) => qb.where("value_date", "<=", new Date(toDate!)))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}
