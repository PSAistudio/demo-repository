export type CardType = "credit" | "debit" | "prepaid";
export type CardStatus =
  | "pending_activation"
  | "active"
  | "frozen"
  | "lost"
  | "stolen"
  | "expired"
  | "closed";
export type CardNetwork = "visa" | "mastercard" | "jcb" | "unionpay" | "mea";

export interface CardsTable {
  id: string;
  card_no_encrypted: string;
  card_no_masked: string;
  card_type: CardType;
  status: CardStatus;
  network: CardNetwork;
  account_id: string;
  cardholder_name: string;
  expiry_month: number;
  expiry_year: number;
  credit_limit: number | null;
  available_credit: number | null;
  cash_limit: number | null;
  pin_attempts: number;
  is_contactless: boolean;
  is_international: boolean;
  activated_at: Date | null;
  blocked_at: Date | null;
  block_reason: string | null;
  last_used_at: Date | null;
  issued_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CardTransactionsTable {
  id: string;
  card_id: string;
  transaction_type:
    | "purchase"
    | "cash_advance"
    | "refund"
    | "payment"
    | "fee"
    | "interest"
    | "adjustment";
  amount: number;
  currency: string;
  merchant_name: string | null;
  merchant_category: string | null;
  merchant_id: string | null;
  terminal_id: string | null;
  approval_code: string | null;
  reference_no: string | null;
  is_international: boolean;
  posting_date: Date;
  transaction_date: Date;
  billing_amount: number | null;
  billing_currency: string | null;
  installment_months: number | null;
  status: "authorized" | "posted" | "reversed" | "declined";
  reversed_by: string | null;
  created_at: Date;
  updated_at: Date;
}
