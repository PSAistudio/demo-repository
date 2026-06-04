import { db } from "@thai-bank/db";
import type { LoanType, LoanStatus } from "@thai-bank/db/schemas";
import type { ApiResponse } from "./index.js";

interface CreateLoanBody {
  loanType: LoanType;
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  repaymentMethod: string;
  paymentFrequency: string;
  tenureMonths: number;
  collateralType?: string;
  collateralValue?: number;
  coBorrowerIds?: string[];
}

export async function handleListLoans(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as LoanStatus | null;
  const type = url.searchParams.get("type") as LoanType | null;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("loans").selectAll();

  if (status) {
    query = query.where("status", "=", status);
  }
  if (type) {
    query = query.where("loan_type", "=", type);
  }

  const [loans, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("loans")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .$if(!!type, (qb) => qb.where("loan_type", "=", type!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: loans,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  } satisfies ApiResponse);
}

export async function handleGetLoan(id: string): Promise<Response> {
  const loan = await db
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!loan) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `Loan ${id} not found` } },
      { status: 404 }
    );
  }

  const schedules = await db
    .selectFrom("loan_schedules")
    .selectAll()
    .where("loan_id", "=", id)
    .orderBy("installment_no", "asc")
    .execute();

  return Response.json({
    success: true,
    data: { ...loan, schedules },
  } satisfies ApiResponse);
}

export async function handleCreateLoan(request: Request): Promise<Response> {
  const body = (await request.json()) as CreateLoanBody;

  if (
    !body.loanType ||
    !body.borrowerId ||
    !body.principalAmount ||
    body.interestRate === undefined ||
    !body.repaymentMethod ||
    !body.paymentFrequency ||
    !body.tenureMonths
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: loanType, borrowerId, principalAmount, interestRate, repaymentMethod, paymentFrequency, tenureMonths",
        },
      },
      { status: 400 }
    );
  }

  const loan = await db
    .insertInto("loans")
    .values({
      id: crypto.randomUUID(),
      loan_no: `LN-${Date.now().toString(36).toUpperCase()}`,
      loan_type: body.loanType,
      status: "pending",
      borrower_id: body.borrowerId,
      co_borrower_ids: body.coBorrowerIds ?? null,
      principal_amount: body.principalAmount,
      disbursed_amount: 0,
      outstanding_principal: 0,
      outstanding_interest: 0,
      interest_rate: body.interestRate,
      penalty_rate: 0,
      repayment_method: body.repaymentMethod as "equal_installment",
      payment_frequency: body.paymentFrequency as "monthly",
      tenure_months: body.tenureMonths,
      collateral_type: body.collateralType ?? null,
      collateral_value: body.collateralValue ?? null,
      disbursed_at: null,
      maturity_date: null,
      next_payment_date: null,
      last_payment_date: null,
      npa_flag: false,
      npa_date: null,
      approved_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();

  return Response.json(
    { success: true, data: loan } satisfies ApiResponse,
    { status: 201 }
  );
}

export async function handleUpdateLoanStatus(
  id: string,
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    status: LoanStatus;
    approvedBy?: string;
  };

  if (!body.status) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing required field: status" },
      },
      { status: 400 }
    );
  }

  const existing = await db
    .selectFrom("loans")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `Loan ${id} not found` } },
      { status: 404 }
    );
  }

  const updated = await db
    .updateTable("loans")
    .set({
      status: body.status,
      approved_by: body.approvedBy ?? existing.approved_by,
      updated_at: new Date(),
      ...(body.status === "approved" ? { approved_by: body.approvedBy ?? "system" } : {}),
      ...(body.status === "disbursed" ? { disbursed_at: new Date() } : {}),
    })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();

  return Response.json({ success: true, data: updated } satisfies ApiResponse);
}
