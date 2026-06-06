import { Pool, PoolConfig } from "pg";
import { Kysely, PostgresDialect, Transaction } from "kysely";
import type {
  AccountsTable,
  AccountLedgerTable,
  LedgerEntriesTable,
  LoansTable,
  LoanSchedulesTable,
  CardsTable,
  CardTransactionsTable,
  FxRatesTable,
  FxTransactionsTable,
  BotMessagesTable,
  BotMessageTrackingTable,
  AuditLogsTable,
  UsersTable,
  SessionsTable,
  PermissionsTable,
  RolesTable,
  RolePermissionsTable,
  UserRolesTable,
  OrganizationsTable,
  ApiKeysTable,
  WebhooksTable,
  NotificationsTable,
  SystemConfigsTable,
} from "./schemas/index.js";

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  permissions: PermissionsTable;
  roles: RolesTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  organizations: OrganizationsTable;
  api_keys: ApiKeysTable;
  webhooks: WebhooksTable;
  notifications: NotificationsTable;
  system_configs: SystemConfigsTable;
  accounts: AccountsTable;
  account_ledger: AccountLedgerTable;
  ledger_entries: LedgerEntriesTable;
  loans: LoansTable;
  loan_schedules: LoanSchedulesTable;
  cards: CardsTable;
  card_transactions: CardTransactionsTable;
  fx_rates: FxRatesTable;
  fx_transactions: FxTransactionsTable;
  bot_messages: BotMessagesTable;
  bot_message_tracking: BotMessageTrackingTable;
  audit_logs: AuditLogsTable;
}

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  database: process.env.DB_NAME ?? "thai_bank",
  user: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

export type DbClient = Kysely<Database>;
export type DbTransaction = Transaction<Database>;

pool.on("error", (err: Error) => {
  console.error("Unexpected pool error:", err);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
