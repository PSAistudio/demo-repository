export type {
  AccountType,
  AccountStatus,
  AccountCurrency,
  AccountsTable,
  AccountLedgerTable,
} from "./accounts.js";

export {
  generateBHAccountNo,
  calculateBHCheckDigit,
  formatAccountNo,
} from "./accounts.js";

export type {
  EntryType,
  EntryStatus,
  LedgerEntriesTable,
  GLAccount,
} from "./ledger.js";

export { CHART_OF_ACCOUNTS } from "./ledger.js";

export type {
  LoanType,
  LoanStatus,
  RepaymentMethod,
  PaymentFrequency,
  LoansTable,
  LoanSchedulesTable,
} from "./loans.js";

export type {
  CardType,
  CardStatus,
  CardNetwork,
  CardsTable,
  CardTransactionsTable,
} from "./cards.js";

export type {
  FxRateType,
  FxTransactionType,
  FxRatesTable,
  FxTransactionsTable,
} from "./fx.js";

export type {
  BotMessageType,
  MessageDirection,
  MessageStatus,
  BotMessagesTable,
  BotMessageTrackingTable,
} from "./bot-messages.js";

export type { AuditLogsTable } from "./audit-logs.js";

// System table stubs (11 tables)
export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
}

export interface PermissionsTable {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: Date;
}

export interface RolesTable {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RolePermissionsTable {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: Date;
}

export interface UserRolesTable {
  id: string;
  user_id: string;
  role_id: string;
  granted_by: string | null;
  created_at: Date;
}

export interface OrganizationsTable {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKeysTable {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  organization_id: string | null;
  permissions: string[];
  expires_at: Date | null;
  last_used_at: Date | null;
  is_active: boolean;
  created_by: string;
  created_at: Date;
}

export interface WebhooksTable {
  id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  organization_id: string | null;
  last_delivery_at: Date | null;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationsTable {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: Date | null;
  created_at: Date;
}

export interface SystemConfigsTable {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}
