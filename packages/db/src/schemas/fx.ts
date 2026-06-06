export type FxRateType = "spot" | "forward" | "swap" | "cross";
export type FxTransactionType = "buy" | "sell" | "conversion";

export interface FxRatesTable {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate_type: FxRateType;
  bid_rate: number;
  ask_rate: number;
  mid_rate: number;
  effective_date: Date;
  expiry_date: Date | null;
  source: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FxTransactionsTable {
  id: string;
  transaction_type: FxTransactionType;
  sell_currency: string;
  buy_currency: string;
  sell_amount: number;
  buy_amount: number;
  exchange_rate: number;
  base_rate: number;
  spread: number;
  customer_rate: number;
  account_id: string;
  counterparty_account_id: string | null;
  value_date: Date;
  settlement_date: Date | null;
  status: "pending" | "settled" | "cancelled";
  reference: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
