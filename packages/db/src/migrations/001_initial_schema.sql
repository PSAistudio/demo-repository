-- =============================================================================
-- 001_initial_schema.sql
-- Thai Commercial Bank Platform - Full PostgreSQL DDL
-- All monetary values in minor units (satang = 1/100 THB)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255),
  avatar_url      VARCHAR(512),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_is_active ON users (is_active);

-- -----------------------------------------------------------------------------
-- 2. sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token           VARCHAR(512) NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sessions_token UNIQUE (token)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_token ON sessions (token);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- -----------------------------------------------------------------------------
-- 3. permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  resource        VARCHAR(255) NOT NULL,
  action          VARCHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_permissions_name UNIQUE (name),
  CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
);

-- -----------------------------------------------------------------------------
-- 4. roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_roles_name UNIQUE (name)
);

-- -----------------------------------------------------------------------------
-- 5. role_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- 6. user_roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);

-- -----------------------------------------------------------------------------
-- 7. organizations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  settings        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_organizations_slug UNIQUE (slug)
);

-- -----------------------------------------------------------------------------
-- 8. api_keys
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  key_hash        VARCHAR(255) NOT NULL,
  key_prefix      VARCHAR(16) NOT NULL,
  organization_id UUID REFERENCES organizations (id),
  permissions     JSONB NOT NULL DEFAULT '[]',
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NOT NULL REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_api_keys_key_hash UNIQUE (key_hash)
);

CREATE INDEX idx_api_keys_prefix ON api_keys (key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);

-- -----------------------------------------------------------------------------
-- 9. webhooks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             VARCHAR(1024) NOT NULL,
  events          JSONB NOT NULL DEFAULT '[]',
  secret          VARCHAR(255) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  organization_id UUID REFERENCES organizations (id),
  last_delivery_at TIMESTAMPTZ,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10. notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            VARCHAR(64) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  data            JSONB,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_read_at ON notifications (read_at) WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- 11. system_configs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             VARCHAR(255) NOT NULL,
  value           TEXT NOT NULL,
  description     TEXT,
  updated_by      UUID REFERENCES users (id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_system_configs_key UNIQUE (key)
);

-- -----------------------------------------------------------------------------
-- 12. accounts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_no        VARCHAR(20) NOT NULL,
  account_type      VARCHAR(20) NOT NULL CHECK (account_type IN ('savings','current','fixed_deposit','money_market','foreign_currency')),
  status            VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','frozen','dormant','closed')),
  currency          VARCHAR(3) NOT NULL DEFAULT 'THB' CHECK (currency IN ('THB','USD','EUR','GBP','JPY','CNY')),
  balance           BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  available_balance BIGINT NOT NULL DEFAULT 0,
  hold_amount       BIGINT NOT NULL DEFAULT 0 CHECK (hold_amount >= 0),
  interest_rate     NUMERIC(8,6) NOT NULL DEFAULT 0,
  overdraft_limit   BIGINT NOT NULL DEFAULT 0 CHECK (overdraft_limit >= 0),
  minimum_balance   BIGINT NOT NULL DEFAULT 0 CHECK (minimum_balance >= 0),
  product_code      VARCHAR(20) NOT NULL,
  branch_code       VARCHAR(5) NOT NULL,
  citizen_id        VARCHAR(13),
  tax_id            VARCHAR(13),
  phone_number      VARCHAR(15),
  co_owner_ids      UUID[],
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  frozen_reason     TEXT,
  dormant_at        TIMESTAMPTZ,
  last_transaction_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_accounts_account_no UNIQUE (account_no)
);

CREATE INDEX idx_accounts_account_type ON accounts (account_type);
CREATE INDEX idx_accounts_status ON accounts (status);
CREATE INDEX idx_accounts_citizen_id ON accounts (citizen_id) WHERE citizen_id IS NOT NULL;
CREATE INDEX idx_accounts_tax_id ON accounts (tax_id) WHERE tax_id IS NOT NULL;
CREATE INDEX idx_accounts_phone_number ON accounts (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_accounts_branch_code ON accounts (branch_code);

-- -----------------------------------------------------------------------------
-- 13. account_ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  entry_type      VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount          BIGINT NOT NULL CHECK (amount > 0),
  balance_after   BIGINT NOT NULL,
  reference       VARCHAR(64),
  description     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_ledger_account_id ON account_ledger (account_id);
CREATE INDEX idx_account_ledger_created_at ON account_ledger (created_at);

-- -----------------------------------------------------------------------------
-- 14. ledger_entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL,
  ledger_account        VARCHAR(16) NOT NULL,
  entry_type            VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount                BIGINT NOT NULL CHECK (amount > 0),
  currency              VARCHAR(3) NOT NULL DEFAULT 'THB',
  status                VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed','failed')),
  reference             VARCHAR(64),
  description           TEXT NOT NULL,
  value_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  booking_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  counterparty_account  VARCHAR(20),
  counterparty_bank     VARCHAR(11),
  reversal_of           UUID REFERENCES ledger_entries (id),
  reversed_by           UUID REFERENCES ledger_entries (id),
  created_by            UUID NOT NULL REFERENCES users (id),
  posted_at             TIMESTAMPTZ,
  posted_by             UUID REFERENCES users (id),
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_batch_id ON ledger_entries (batch_id);
CREATE INDEX idx_ledger_entries_ledger_account ON ledger_entries (ledger_account);
CREATE INDEX idx_ledger_entries_status ON ledger_entries (status);
CREATE INDEX idx_ledger_entries_value_date ON ledger_entries (value_date);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries (reference) WHERE reference IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 15. loans
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_no               VARCHAR(24) NOT NULL,
  loan_type             VARCHAR(20) NOT NULL CHECK (loan_type IN ('personal','housing','auto','business','overdraft','agricultural')),
  status                VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','disbursed','active','past_due','defaulted','settled','written_off')),
  borrower_id           UUID NOT NULL REFERENCES users (id),
  co_borrower_ids       UUID[],
  principal_amount      BIGINT NOT NULL CHECK (principal_amount > 0),
  disbursed_amount      BIGINT NOT NULL DEFAULT 0 CHECK (disbursed_amount >= 0),
  outstanding_principal BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_principal >= 0),
  outstanding_interest  BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_interest >= 0),
  interest_rate         NUMERIC(8,6) NOT NULL CHECK (interest_rate >= 0),
  penalty_rate          NUMERIC(8,6) NOT NULL DEFAULT 0 CHECK (penalty_rate >= 0),
  repayment_method      VARCHAR(24) NOT NULL CHECK (repayment_method IN ('equal_installment','equal_principal','bullet','interest_only')),
  payment_frequency     VARCHAR(16) NOT NULL CHECK (payment_frequency IN ('monthly','bi_weekly','quarterly','semi_annually','annually')),
  tenure_months         INTEGER NOT NULL CHECK (tenure_months > 0),
  collateral_type       VARCHAR(50),
  collateral_value      BIGINT CHECK (collateral_value IS NULL OR collateral_value >= 0),
  disbursed_at          TIMESTAMPTZ,
  maturity_date         DATE,
  next_payment_date     DATE,
  last_payment_date     DATE,
  npa_flag              BOOLEAN NOT NULL DEFAULT FALSE,
  npa_date              DATE,
  approved_by           UUID REFERENCES users (id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loans_loan_no UNIQUE (loan_no)
);

CREATE INDEX idx_loans_borrower_id ON loans (borrower_id);
CREATE INDEX idx_loans_status ON loans (status);
CREATE INDEX idx_loans_loan_type ON loans (loan_type);
CREATE INDEX idx_loans_npa_flag ON loans (npa_flag) WHERE npa_flag = TRUE;
CREATE INDEX idx_loans_next_payment_date ON loans (next_payment_date) WHERE next_payment_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 16. loan_schedules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_schedules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               UUID NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
  installment_no        INTEGER NOT NULL CHECK (installment_no > 0),
  due_date              DATE NOT NULL,
  principal_amount      BIGINT NOT NULL CHECK (principal_amount >= 0),
  interest_amount       BIGINT NOT NULL CHECK (interest_amount >= 0),
  total_amount          BIGINT NOT NULL CHECK (total_amount >= 0),
  outstanding_principal BIGINT NOT NULL CHECK (outstanding_principal >= 0),
  status                VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','overdue','waived')),
  paid_date             DATE,
  paid_amount           BIGINT CHECK (paid_amount IS NULL OR paid_amount >= 0),
  penalty_amount        BIGINT NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loan_schedules_loan_installment UNIQUE (loan_id, installment_no)
);

CREATE INDEX idx_loan_schedules_loan_id ON loan_schedules (loan_id);
CREATE INDEX idx_loan_schedules_due_date ON loan_schedules (due_date);
CREATE INDEX idx_loan_schedules_status ON loan_schedules (status);

-- -----------------------------------------------------------------------------
-- 17. cards
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_no_encrypted VARCHAR(512) NOT NULL,
  card_no_masked    VARCHAR(19) NOT NULL,
  card_type         VARCHAR(10) NOT NULL CHECK (card_type IN ('credit','debit','prepaid')),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending_activation' CHECK (status IN ('pending_activation','active','frozen','lost','stolen','expired','closed')),
  network           VARCHAR(12) NOT NULL CHECK (network IN ('visa','mastercard','jcb','unionpay','mea')),
  account_id        UUID NOT NULL REFERENCES accounts (id),
  cardholder_name   VARCHAR(100) NOT NULL,
  expiry_month      SMALLINT NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year       SMALLINT NOT NULL CHECK (expiry_year >= 2024),
  credit_limit      BIGINT CHECK (credit_limit IS NULL OR credit_limit >= 0),
  available_credit  BIGINT CHECK (available_credit IS NULL OR available_credit >= 0),
  cash_limit        BIGINT CHECK (cash_limit IS NULL OR cash_limit >= 0),
  pin_attempts      SMALLINT NOT NULL DEFAULT 0 CHECK (pin_attempts >= 0 AND pin_attempts <= 3),
  is_contactless    BOOLEAN NOT NULL DEFAULT FALSE,
  is_international  BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at       TIMESTAMPTZ,
  blocked_at        TIMESTAMPTZ,
  block_reason      TEXT,
  last_used_at      TIMESTAMPTZ,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_account_id ON cards (account_id);
CREATE INDEX idx_cards_status ON cards (status);
CREATE INDEX idx_cards_card_type ON cards (card_type);
CREATE INDEX idx_cards_network ON cards (network);

-- -----------------------------------------------------------------------------
-- 18. card_transactions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id             UUID NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  transaction_type    VARCHAR(16) NOT NULL CHECK (transaction_type IN ('purchase','cash_advance','refund','payment','fee','interest','adjustment')),
  amount              BIGINT NOT NULL CHECK (amount > 0),
  currency            VARCHAR(3) NOT NULL DEFAULT 'THB',
  merchant_name       VARCHAR(255),
  merchant_category   VARCHAR(10),
  merchant_id         VARCHAR(32),
  terminal_id         VARCHAR(32),
  approval_code       VARCHAR(12),
  reference_no        VARCHAR(32),
  is_international     BOOLEAN NOT NULL DEFAULT FALSE,
  posting_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_amount      BIGINT,
  billing_currency    VARCHAR(3),
  installment_months  INTEGER CHECK (installment_months IS NULL OR installment_months > 0),
  status              VARCHAR(12) NOT NULL DEFAULT 'authorized' CHECK (status IN ('authorized','posted','reversed','declined')),
  reversed_by         UUID REFERENCES card_transactions (id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_card_transactions_card_id ON card_transactions (card_id);
CREATE INDEX idx_card_transactions_status ON card_transactions (status);
CREATE INDEX idx_card_transactions_transaction_date ON card_transactions (transaction_date);
CREATE INDEX idx_card_transactions_reference_no ON card_transactions (reference_no) WHERE reference_no IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 19. fx_rates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency   VARCHAR(3) NOT NULL,
  quote_currency  VARCHAR(3) NOT NULL,
  rate_type       VARCHAR(10) NOT NULL CHECK (rate_type IN ('spot','forward','swap','cross')),
  bid_rate        NUMERIC(18,8) NOT NULL CHECK (bid_rate > 0),
  ask_rate        NUMERIC(18,8) NOT NULL CHECK (ask_rate > 0),
  mid_rate        NUMERIC(18,8) NOT NULL CHECK (mid_rate > 0),
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  source          VARCHAR(64) NOT NULL DEFAULT 'internal',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fx_rates_pair_type_date UNIQUE (base_currency, quote_currency, rate_type, effective_date)
);

CREATE INDEX idx_fx_rates_base_quote ON fx_rates (base_currency, quote_currency);
CREATE INDEX idx_fx_rates_is_active ON fx_rates (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_fx_rates_effective_date ON fx_rates (effective_date);

-- -----------------------------------------------------------------------------
-- 20. fx_transactions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fx_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type        VARCHAR(10) NOT NULL CHECK (transaction_type IN ('buy','sell','conversion')),
  sell_currency           VARCHAR(3) NOT NULL,
  buy_currency            VARCHAR(3) NOT NULL,
  sell_amount             BIGINT NOT NULL CHECK (sell_amount > 0),
  buy_amount              BIGINT NOT NULL CHECK (buy_amount > 0),
  exchange_rate           NUMERIC(18,8) NOT NULL CHECK (exchange_rate > 0),
  base_rate               NUMERIC(18,8) NOT NULL CHECK (base_rate > 0),
  spread                  NUMERIC(18,8) NOT NULL DEFAULT 0,
  customer_rate           NUMERIC(18,8) NOT NULL CHECK (customer_rate > 0),
  account_id              UUID NOT NULL REFERENCES accounts (id),
  counterparty_account_id UUID REFERENCES accounts (id),
  value_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  settlement_date         DATE,
  status                  VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','cancelled')),
  reference               VARCHAR(64),
  created_by              UUID NOT NULL REFERENCES users (id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fx_transactions_account_id ON fx_transactions (account_id);
CREATE INDEX idx_fx_transactions_status ON fx_transactions (status);
CREATE INDEX idx_fx_transactions_sell_currency ON fx_transactions (sell_currency);
CREATE INDEX idx_fx_transactions_buy_currency ON fx_transactions (buy_currency);

-- -----------------------------------------------------------------------------
-- 21. bot_messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id          VARCHAR(64) NOT NULL,
  message_type        VARCHAR(16) NOT NULL CHECK (message_type IN ('pacs.008','pacs.002','pacs.004','camt.053','camt.054','camt.056','admin.001','custom')),
  direction           VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  status              VARCHAR(16) NOT NULL DEFAULT 'received' CHECK (status IN ('received','parsing','parsed','validating','validated','processing','completed','failed','rejected','acked','nacked')),
  sender_bic          VARCHAR(11) NOT NULL,
  receiver_bic        VARCHAR(11) NOT NULL,
  raw_payload         TEXT NOT NULL,
  parsed_payload      JSONB,
  related_entity_id   UUID,
  related_entity_type VARCHAR(32),
  retry_count         SMALLINT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries         SMALLINT NOT NULL DEFAULT 3 CHECK (max_retries BETWEEN 0 AND 10),
  next_retry_at       TIMESTAMPTZ,
  error_message       TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bot_messages_message_id UNIQUE (message_id)
);

CREATE INDEX idx_bot_messages_message_type ON bot_messages (message_type);
CREATE INDEX idx_bot_messages_direction ON bot_messages (direction);
CREATE INDEX idx_bot_messages_status ON bot_messages (status);
CREATE INDEX idx_bot_messages_sender_bic ON bot_messages (sender_bic);
CREATE INDEX idx_bot_messages_created_at ON bot_messages (created_at);
CREATE INDEX idx_bot_messages_next_retry ON bot_messages (next_retry_at) WHERE next_retry_at IS NOT NULL AND status IN ('failed','rejected');

-- -----------------------------------------------------------------------------
-- 22. bot_message_tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bot_message_tracking (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES bot_messages (id) ON DELETE CASCADE,
  from_status     VARCHAR(16) NOT NULL,
  to_status       VARCHAR(16) NOT NULL,
  changed_by      VARCHAR(64) NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_bot_message_tracking_message_id ON bot_message_tracking (message_id);

-- -----------------------------------------------------------------------------
-- 23. audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(64) NOT NULL,
  entity_id       UUID NOT NULL,
  action          VARCHAR(64) NOT NULL,
  old_values      JSONB,
  new_values      JSONB,
  performed_by    UUID NOT NULL REFERENCES users (id),
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs (performed_by);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- -----------------------------------------------------------------------------
-- Seed: system user for automated operations
-- -----------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, display_name, is_active)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@thai-bank.internal', 'SYSTEM', 'System', TRUE)
ON CONFLICT (email) DO NOTHING;

COMMIT;
