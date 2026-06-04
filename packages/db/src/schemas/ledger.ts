export type EntryType = "debit" | "credit";
export type EntryStatus = "pending" | "posted" | "reversed" | "failed";

export interface LedgerEntriesTable {
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
  created_at: Date;
  updated_at: Date;
}

export interface GLAccount {
  code: string;
  name_en: string;
  name_th: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  normal_balance: "debit" | "credit";
  is_active: boolean;
}

export const CHART_OF_ACCOUNTS: GLAccount[] = [
  {
    code: "1000",
    name_en: "Cash and Cash Equivalents",
    name_th: "เงินสดและรายการเทียบเท่าเงินสด",
    type: "asset",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "1100",
    name_en: "Due from Banks",
    name_th: "เงินฝากธนาคารอื่น",
    type: "asset",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "1200",
    name_en: "Loans to Customers",
    name_th: "สินเชื่อให้ลูกค้า",
    type: "asset",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "1300",
    name_en: "Investments",
    name_th: "การลงทุน",
    type: "asset",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "1400",
    name_en: "Fixed Assets",
    name_th: "สินทรัพย์ถาวร",
    type: "asset",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "2000",
    name_en: "Customer Deposits",
    name_th: "เงินฝากจากลูกค้า",
    type: "liability",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "2100",
    name_en: "Due to Banks",
    name_th: "เงินคงค้างธนาคารอื่น",
    type: "liability",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "2200",
    name_en: "Borrowings",
    name_th: "เงินกู้ยืม",
    type: "liability",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "2300",
    name_en: "Other Liabilities",
    name_th: "หนี้สินอื่น",
    type: "liability",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "3000",
    name_en: "Share Capital",
    name_th: "ทุนจดทะเบียน",
    type: "equity",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "3100",
    name_en: "Retained Earnings",
    name_th: "กำไรสะสม",
    type: "equity",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "4000",
    name_en: "Interest Income",
    name_th: "รายได้ดอกเบี้ย",
    type: "income",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "4100",
    name_en: "Fee and Service Income",
    name_th: "รายได้ค่าธรรมเนียมและบริการ",
    type: "income",
    normal_balance: "credit",
    is_active: true,
  },
  {
    code: "5000",
    name_en: "Interest Expense",
    name_th: "ค่าใช้จ่ายดอกเบี้ย",
    type: "expense",
    normal_balance: "debit",
    is_active: true,
  },
  {
    code: "5100",
    name_en: "Operating Expenses",
    name_th: "ค่าใช้จ่ายการดำเนินงาน",
    type: "expense",
    normal_balance: "debit",
    is_active: true,
  },
];
