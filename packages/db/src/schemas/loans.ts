export type LoanType =
  | "personal"
  | "housing"
  | "auto"
  | "business"
  | "overdraft"
  | "agricultural";

export type LoanStatus =
  | "pending"
  | "approved"
  | "disbursed"
  | "active"
  | "past_due"
  | "defaulted"
  | "settled"
  | "written_off";

export type RepaymentMethod =
  | "equal_installment"
  | "equal_principal"
  | "bullet"
  | "interest_only";

export type PaymentFrequency =
  | "monthly"
  | "bi_weekly"
  | "quarterly"
  | "semi_annually"
  | "annually";

export interface LoansTable {
  id: string;
  loan_no: string;
  loan_type: LoanType;
  status: LoanStatus;
  borrower_id: string;
  co_borrower_ids: string[] | null;
  principal_amount: number;
  disbursed_amount: number;
  outstanding_principal: number;
  outstanding_interest: number;
  interest_rate: number;
  penalty_rate: number;
  repayment_method: RepaymentMethod;
  payment_frequency: PaymentFrequency;
  tenure_months: number;
  collateral_type: string | null;
  collateral_value: number | null;
  disbursed_at: Date | null;
  maturity_date: Date | null;
  next_payment_date: Date | null;
  last_payment_date: Date | null;
  npa_flag: boolean;
  npa_date: Date | null;
  approved_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LoanSchedulesTable {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: Date;
  principal_amount: number;
  interest_amount: number;
  total_amount: number;
  outstanding_principal: number;
  status: "pending" | "paid" | "partial" | "overdue" | "waived";
  paid_date: Date | null;
  paid_amount: number | null;
  penalty_amount: number;
  created_at: Date;
  updated_at: Date;
}
