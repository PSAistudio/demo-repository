/**
 * Loan Lifecycle
 *
 * Manages the full lifecycle of a loan: creation, approval, disbursement,
 * repayment, and NPA classification. All monetary values in minor units (satang).
 */

import { db, type DbClient } from "@thai-bank/db";
import type {
  LoanType,
  LoanStatus,
  RepaymentMethod,
  PaymentFrequency,
} from "@thai-bank/db/schemas";
import { createBatch, addEntry, postBatch } from "../ledger/engine.js";
import {
  calculateFlatRateSchedule,
  calculateReducingBalanceSchedule,
  calculateEffectiveRateSchedule,
  type ScheduleEntry,
} from "./calculator.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateLoanParams {
  loanType: LoanType;
  borrowerId: string;
  coBorrowerIds?: string[];
  principalAmount: number;
  interestRate: number;
  penaltyRate?: number;
  repaymentMethod: RepaymentMethod;
  paymentFrequency: PaymentFrequency;
  tenureMonths: number;
  collateralType?: string;
  collateralValue?: number;
  createdBy: string;
}

export interface LoanResult {
  id: string;
  loanNo: string;
  status: LoanStatus;
  schedule: ScheduleEntry[];
}

export type NPAClassification =
  | "normal"
  | "special_mention"
  | "substandard"
  | "doubtful"
  | "loss";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateLoanNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `LN-${ts}-${rand}`;
}

/**
 * Choose the appropriate calculator based on repayment method.
 */
function buildSchedule(
  params: CreateLoanParams,
  disbursementDate: Date
): ScheduleEntry[] {
  const calcParams = {
    principalAmount: params.principalAmount,
    interestRate: params.interestRate,
    tenureMonths: params.tenureMonths,
    paymentFrequency: params.paymentFrequency,
    disbursementDate,
  };

  switch (params.repaymentMethod) {
    case "equal_installment":
      return calculateReducingBalanceSchedule(calcParams);
    case "equal_principal":
      return calculateEffectiveRateSchedule(calcParams);
    case "interest_only":
    case "bullet":
      return calculateFlatRateSchedule(calcParams);
    default:
      return calculateReducingBalanceSchedule(calcParams);
  }
}

// ---------------------------------------------------------------------------
// createLoan
// ---------------------------------------------------------------------------

export async function createLoan(
  params: CreateLoanParams,
  client?: DbClient
): Promise<LoanResult> {
  const executor = client ?? db;

  // Validate borrower exists
  const borrower = await executor
    .selectFrom("users")
    .select(["id"])
    .where("id", "=", params.borrowerId)
    .executeTakeFirst();

  if (!borrower) {
    throw new Error(`Borrower ${params.borrowerId} not found`);
  }

  if (params.principalAmount <= 0) {
    throw new Error("Principal amount must be greater than zero");
  }

  if (params.interestRate < 0) {
    throw new Error("Interest rate cannot be negative");
  }

  if (params.tenureMonths <= 0) {
    throw new Error("Tenure must be at least 1 month");
  }

  const loanId = randomUUID();
  const loanNo = generateLoanNo();

  // Build the repayment schedule (pre-disbursement, for reference)
  const schedule = buildSchedule(params, new Date());
  const maturityDate =
    schedule.length > 0 ? schedule[schedule.length - 1].due_date : null;
  const nextPaymentDate = schedule.length > 0 ? schedule[0].due_date : null;

  await executor
    .insertInto("loans")
    .values({
      id: loanId,
      loan_no: loanNo,
      loan_type: params.loanType,
      status: "pending",
      borrower_id: params.borrowerId,
      co_borrower_ids: params.coBorrowerIds ?? null,
      principal_amount: params.principalAmount,
      disbursed_amount: 0,
      outstanding_principal: 0,
      outstanding_interest: 0,
      interest_rate: params.interestRate,
      penalty_rate: params.penaltyRate ?? 0,
      repayment_method: params.repaymentMethod,
      payment_frequency: params.paymentFrequency,
      tenure_months: params.tenureMonths,
      collateral_type: params.collateralType ?? null,
      collateral_value: params.collateralValue ?? null,
      disbursed_at: null,
      maturity_date: maturityDate,
      next_payment_date: nextPaymentDate,
      last_payment_date: null,
      npa_flag: false,
      npa_date: null,
      approved_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return {
    id: loanId,
    loanNo,
    status: "pending",
    schedule,
  };
}

// ---------------------------------------------------------------------------
// approveLoan
// ---------------------------------------------------------------------------

export async function approveLoan(
  loanId: string,
  approverId: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const loan = await executor
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", loanId)
    .executeTakeFirst();

  if (!loan) {
    throw new Error(`Loan ${loanId} not found`);
  }

  if (loan.status !== "pending") {
    throw new Error(
      `Loan ${loanId} cannot be approved (current status: ${loan.status})`
    );
  }

  // Verify approver exists
  const approver = await executor
    .selectFrom("users")
    .select(["id"])
    .where("id", "=", approverId)
    .executeTakeFirst();

  if (!approver) {
    throw new Error(`Approver ${approverId} not found`);
  }

  await executor
    .updateTable("loans")
    .set({
      status: "approved",
      approved_by: approverId,
      updated_at: new Date(),
    })
    .where("id", "=", loanId)
    .execute();

  // Audit log entry
  await executor
    .insertInto("audit_logs")
    .values({
      id: randomUUID(),
      entity_type: "loan",
      entity_id: loanId,
      action: "approve",
      old_values: { status: "pending" },
      new_values: { status: "approved", approved_by: approverId },
      performed_by: approverId,
      ip_address: null,
      user_agent: null,
      created_at: new Date(),
    })
    .execute();
}

// ---------------------------------------------------------------------------
// disburseLoan
// ---------------------------------------------------------------------------

export async function disburseLoan(
  loanId: string,
  disbursementAccountId: string,
  disbursedBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const loan = await executor
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", loanId)
    .executeTakeFirst();

  if (!loan) {
    throw new Error(`Loan ${loanId} not found`);
  }

  if (loan.status !== "approved") {
    throw new Error(
      `Loan ${loanId} cannot be disbursed (current status: ${loan.status})`
    );
  }

  // Validate disbursement account
  const account = await executor
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", disbursementAccountId)
    .executeTakeFirst();

  if (!account) {
    throw new Error(`Disbursement account ${disbursementAccountId} not found`);
  }

  if (account.status !== "active") {
    throw new Error(
      `Disbursement account ${disbursementAccountId} is not active`
    );
  }

  const now = new Date();

  // Build the actual schedule from the real disbursement date
  const schedule = buildSchedule(
    {
      loanType: loan.loan_type as LoanType,
      borrowerId: loan.borrower_id,
      principalAmount: Number(loan.principal_amount),
      interestRate: Number(loan.interest_rate),
      penaltyRate: Number(loan.penalty_rate),
      repaymentMethod: loan.repayment_method as RepaymentMethod,
      paymentFrequency: loan.payment_frequency as PaymentFrequency,
      tenureMonths: loan.tenure_months,
      createdBy: disbursedBy,
    },
    now
  );

  // Post disbursement ledger entries
  const batchId = createBatch(disbursedBy);

  // Debit Loans to Customers (asset)
  addEntry(
    batchId,
    "1200",
    "debit",
    Number(loan.principal_amount),
    "THB",
    `Loan disbursement - ${loan.loan_no}`,
    `DISB-${loan.loan_no}`,
    account.account_no,
    undefined,
    { loan_id: loanId, loan_type: loan.loan_type }
  );

  // Credit Customer Deposits (liability)
  addEntry(
    batchId,
    "2000",
    "credit",
    Number(loan.principal_amount),
    "THB",
    `Loan disbursement to account ${account.account_no} - ${loan.loan_no}`,
    `DISB-${loan.loan_no}`,
    account.account_no,
    undefined,
    { loan_id: loanId, loan_type: loan.loan_type }
  );

  await postBatch(batchId, client);

  // Update loan record
  await executor
    .updateTable("loans")
    .set({
      status: "active",
      disbursed_amount: Number(loan.principal_amount),
      outstanding_principal: Number(loan.principal_amount),
      disbursed_at: now,
      maturity_date:
        schedule.length > 0 ? schedule[schedule.length - 1].due_date : null,
      next_payment_date:
        schedule.length > 0 ? schedule[0].due_date : null,
      updated_at: now,
    })
    .where("id", "=", loanId)
    .execute();

  // Insert schedule rows
  for (const entry of schedule) {
    await executor
      .insertInto("loan_schedules")
      .values({
        id: randomUUID(),
        loan_id: loanId,
        installment_no: entry.installment_no,
        due_date: entry.due_date,
        principal_amount: entry.principal,
        interest_amount: entry.interest,
        total_amount: entry.total,
        outstanding_principal: entry.balance,
        status: "pending",
        paid_date: null,
        paid_amount: null,
        penalty_amount: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }

  // Credit the disbursement account
  await executor
    .updateTable("accounts")
    .set({
      balance: Number(account.balance) + Number(loan.principal_amount),
      available_balance:
        Number(account.available_balance) + Number(loan.principal_amount),
      last_transaction_at: now,
      updated_at: now,
    })
    .where("id", "=", disbursementAccountId)
    .execute();
}

// ---------------------------------------------------------------------------
// recordPayment
// ---------------------------------------------------------------------------

export async function recordPayment(
  loanId: string,
  installmentNo: number,
  paidAmount: number,
  paidBy: string,
  client?: DbClient
): Promise<void> {
  const executor = client ?? db;

  const loan = await executor
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", loanId)
    .executeTakeFirst();

  if (!loan) {
    throw new Error(`Loan ${loanId} not found`);
  }

  if (loan.status !== "active" && loan.status !== "past_due") {
    throw new Error(
      `Loan ${loanId} is not in a payable state (status: ${loan.status})`
    );
  }

  const scheduleEntry = await executor
    .selectFrom("loan_schedules")
    .selectAll()
    .where("loan_id", "=", loanId)
    .where("installment_no", "=", installmentNo)
    .executeTakeFirst();

  if (!scheduleEntry) {
    throw new Error(
      `Installment ${installmentNo} not found for loan ${loanId}`
    );
  }

  if (scheduleEntry.status === "paid") {
    throw new Error(
      `Installment ${installmentNo} is already fully paid`
    );
  }

  const totalDue =
    Number(scheduleEntry.total_amount) + Number(scheduleEntry.penalty_amount);

  // Determine payment status
  let newScheduleStatus: "paid" | "partial" | "overdue";
  if (paidAmount >= totalDue) {
    newScheduleStatus = "paid";
  } else if (paidAmount >= Number(scheduleEntry.principal_amount)) {
    newScheduleStatus = "partial";
  } else {
    newScheduleStatus = "overdue";
  }

  const now = new Date();

  // Update the schedule entry
  await executor
    .updateTable("loan_schedules")
    .set({
      status: newScheduleStatus,
      paid_date: now,
      paid_amount: paidAmount,
      updated_at: now,
    })
    .where("id", "=", scheduleEntry.id)
    .execute();

  // Calculate the principal and interest portions of this payment
  const principalPaid = Math.min(
    paidAmount,
    Number(scheduleEntry.principal_amount)
  );
  const interestPaid = Math.min(
    Math.max(0, paidAmount - principalPaid),
    Number(scheduleEntry.interest_amount)
  );

  // Post repayment ledger entries
  const batchId = createBatch(paidBy);

  // Debit Customer Deposits (the borrower pays from their account)
  addEntry(
    batchId,
    "2000",
    "debit",
    paidAmount,
    "THB",
    `Loan repayment - ${loan.loan_no} installment #${installmentNo}`,
    `PAY-${loan.loan_no}-${installmentNo}`,
    undefined,
    undefined,
    { loan_id: loanId, installment_no: installmentNo }
  );

  // Credit Loans to Customers (reduces the loan asset)
  addEntry(
    batchId,
    "1200",
    "credit",
    principalPaid,
    "THB",
    `Loan principal repayment - ${loan.loan_no} installment #${installmentNo}`,
    `PAY-${loan.loan_no}-${installmentNo}`,
    undefined,
    undefined,
    { loan_id: loanId, installment_no: installmentNo, type: "principal" }
  );

  // Credit Interest Income (if any interest portion)
  if (interestPaid > 0) {
    addEntry(
      batchId,
      "4000",
      "credit",
      interestPaid,
      "THB",
      `Loan interest income - ${loan.loan_no} installment #${installmentNo}`,
      `PAY-${loan.loan_no}-${installmentNo}`,
      undefined,
      undefined,
      { loan_id: loanId, installment_no: installmentNo, type: "interest" }
    );
  }

  await postBatch(batchId, client);

  // Update loan outstanding amounts
  const newOutstandingPrincipal = Math.max(
    0,
    Number(loan.outstanding_principal) - principalPaid
  );
  const newOutstandingInterest = Math.max(
    0,
    Number(loan.outstanding_interest) - interestPaid
  );

  // Find the next pending installment for next_payment_date
  const nextPending = await executor
    .selectFrom("loan_schedules")
    .select(["due_date"])
    .where("loan_id", "=", loanId)
    .where("status", "=", "pending")
    .orderBy("installment_no", "asc")
    .executeTakeFirst();

  await executor
    .updateTable("loans")
    .set({
      outstanding_principal: newOutstandingPrincipal,
      outstanding_interest: newOutstandingInterest,
      last_payment_date: now,
      next_payment_date: nextPending?.due_date ?? null,
      status: newOutstandingPrincipal === 0 ? "settled" : loan.status,
      updated_at: now,
    })
    .where("id", "=", loanId)
    .execute();
}

// ---------------------------------------------------------------------------
// classifyNPA
// ---------------------------------------------------------------------------

export async function classifyNPA(
  loanId: string,
  client?: DbClient
): Promise<NPAClassification> {
  const executor = client ?? db;

  const loan = await executor
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", loanId)
    .executeTakeFirst();

  if (!loan) {
    throw new Error(`Loan ${loanId} not found`);
  }

  if (loan.status !== "active" && loan.status !== "past_due") {
    return "normal";
  }

  // Find the earliest overdue installment
  const overdueInstallment = await executor
    .selectFrom("loan_schedules")
    .selectAll()
    .where("loan_id", "=", loanId)
    .where("status", "in", ["pending", "partial", "overdue"])
    .where("due_date", "<", new Date())
    .orderBy("due_date", "asc")
    .executeTakeFirst();

  if (!overdueInstallment) {
    // No overdue installments
    if (loan.npa_flag) {
      await executor
        .updateTable("loans")
        .set({ npa_flag: false, npa_date: null, updated_at: new Date() })
        .where("id", "=", loanId)
        .execute();
    }
    return "normal";
  }

  // Calculate days past due
  const now = new Date();
  const dueDate = new Date(overdueInstallment.due_date);
  const diffMs = now.getTime() - dueDate.getTime();
  const pastDueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // BOT NPA classification thresholds
  let classification: NPAClassification;
  if (pastDueDays <= 0) {
    classification = "normal";
  } else if (pastDueDays <= 30) {
    classification = "special_mention";
  } else if (pastDueDays <= 90) {
    classification = "substandard";
  } else if (pastDueDays <= 180) {
    classification = "doubtful";
  } else {
    classification = "loss";
  }

  // Update loan NPA flag if substandard or worse
  if (
    classification === "substandard" ||
    classification === "doubtful" ||
    classification === "loss"
  ) {
    await executor
      .updateTable("loans")
      .set({
        npa_flag: true,
        npa_date: loan.npa_date ?? new Date(),
        status: "past_due",
        updated_at: new Date(),
      })
      .where("id", "=", loanId)
      .execute();
  } else if (classification === "normal" && loan.npa_flag) {
    await executor
      .updateTable("loans")
      .set({
        npa_flag: false,
        npa_date: null,
        status: "active",
        updated_at: new Date(),
      })
      .where("id", "=", loanId)
      .execute();
  } else if (classification === "special_mention") {
    // Special mention does not set NPA flag but we update the loan status
    if (loan.status === "active") {
      await executor
        .updateTable("loans")
        .set({ status: "past_due", updated_at: new Date() })
        .where("id", "=", loanId)
        .execute();
    }
  }

  return classification;
}
