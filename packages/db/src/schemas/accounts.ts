export type AccountType =
  | "savings"
  | "current"
  | "fixed_deposit"
  | "money_market"
  | "foreign_currency";

export type AccountStatus =
  | "pending"
  | "active"
  | "frozen"
  | "dormant"
  | "closed";

export type AccountCurrency = "THB" | "USD" | "EUR" | "GBP" | "JPY" | "CNY";

export interface AccountsTable {
  id: string;
  account_no: string;
  account_type: AccountType;
  status: AccountStatus;
  currency: AccountCurrency;
  balance: number;
  available_balance: number;
  hold_amount: number;
  interest_rate: number;
  overdraft_limit: number;
  minimum_balance: number;
  product_code: string;
  branch_code: string;
  citizen_id: string | null;
  tax_id: string | null;
  phone_number: string | null;
  co_owner_ids: string[] | null;
  opened_at: Date;
  closed_at: Date | null;
  frozen_reason: string | null;
  dormant_at: Date | null;
  last_transaction_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AccountLedgerTable {
  id: string;
  account_id: string;
  entry_type: "debit" | "credit";
  amount: number;
  balance_after: number;
  reference: string | null;
  description: string;
  created_at: Date;
}

const BH_BANK_CODE = "123";
const BH_COUNTRY_CODE = "TH";

export function calculateBHCheckDigit(accountBody: string): string {
  const weights = [7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < accountBody.length && i < weights.length; i++) {
    sum += parseInt(accountBody[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  if (remainder === 0) return "0";
  const checkDigit = 11 - remainder;
  if (checkDigit === 10) return "X";
  return checkDigit.toString();
}

export function generateBHAccountNo(
  accountType: AccountType,
  branchCode: string,
  sequence: number
): string {
  const typeMap: Record<AccountType, string> = {
    savings: "01",
    current: "02",
    fixed_deposit: "03",
    money_market: "04",
    foreign_currency: "05",
  };
  const typeCode = typeMap[accountType];
  const seqStr = sequence.toString().padStart(6, "0");
  const accountBody = BH_BANK_CODE + typeCode + branchCode + seqStr;
  const checkDigit = calculateBHCheckDigit(accountBody);
  return `${BH_COUNTRY_CODE}${BH_BANK_CODE}${typeCode}${branchCode}${seqStr}${checkDigit}`;
}

export function formatAccountNo(accountNo: string): string {
  if (accountNo.length <= 4) return accountNo;
  const parts: string[] = [];
  for (let i = 0; i < accountNo.length; i += 4) {
    parts.push(accountNo.slice(i, i + 4));
  }
  return parts.join("-");
}
