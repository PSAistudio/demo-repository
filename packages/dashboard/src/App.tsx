import { useState, useCallback } from "react";

type NavItem = "dashboard" | "accounts" | "transfers" | "loans" | "cards" | "fx" | "ledger" | "audit";

const NAV_ITEMS: { key: NavItem; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "accounts", label: "Accounts", icon: "🏦" },
  { key: "transfers", label: "Transfers", icon: "💸" },
  { key: "loans", label: "Loans", icon: "📋" },
  { key: "cards", label: "Cards", icon: "💳" },
  { key: "fx", label: "FX Rates", icon: "💱" },
  { key: "ledger", label: "Ledger", icon: "📒" },
  { key: "audit", label: "Audit Log", icon: "📝" },
];

const API_BASE = "/api";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatSatang(amount: number): string {
  const baht = amount / 100;
  return baht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH");
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH");
}

// ---------------------------------------------------------------------------
// Mock data for UI demonstration (would come from API in production)
// ---------------------------------------------------------------------------

const MOCK_ACCOUNTS = [
  { id: "1", account_no: "TH12301001000001X", account_type: "savings", status: "active", currency: "THB", balance: 50000000, available_balance: 48000000, branch_code: "001", product_code: "SAV-01", citizen_id: "1101234567890" },
  { id: "2", account_no: "TH123020010000023", account_type: "current", status: "active", currency: "THB", balance: 120000000, available_balance: 115000000, branch_code: "001", product_code: "CUR-01", citizen_id: "1109876543210" },
  { id: "3", account_no: "TH123050020000045", account_type: "foreign_currency", status: "active", currency: "USD", balance: 150000, available_balance: 140000, branch_code: "002", product_code: "FC-01", citizen_id: "1111111111111" },
  { id: "4", account_no: "TH123010030000067", account_type: "savings", status: "dormant", currency: "THB", balance: 500000, available_balance: 500000, branch_code: "003", product_code: "SAV-01", citizen_id: "1122222222222" },
  { id: "5", account_no: "TH123030010000089", account_type: "fixed_deposit", status: "active", currency: "THB", balance: 300000000, available_balance: 0, branch_code: "001", product_code: "FD-01", citizen_id: "1101234567890" },
];

const MOCK_FX_RATES = [
  { id: "1", base_currency: "THB", quote_currency: "USD", rate_type: "spot", bid_rate: 34.2, ask_rate: 34.5, mid_rate: 34.35, effective_date: "2024-01-15", source: "BOT" },
  { id: "2", base_currency: "THB", quote_currency: "EUR", rate_type: "spot", bid_rate: 37.1, ask_rate: 37.5, mid_rate: 37.3, effective_date: "2024-01-15", source: "BOT" },
  { id: "3", base_currency: "THB", quote_currency: "GBP", rate_type: "spot", bid_rate: 43.2, ask_rate: 43.7, mid_rate: 43.45, effective_date: "2024-01-15", source: "BOT" },
  { id: "4", base_currency: "THB", quote_currency: "JPY", rate_type: "spot", bid_rate: 0.229, ask_rate: 0.231, mid_rate: 0.23, effective_date: "2024-01-15", source: "BOT" },
  { id: "5", base_currency: "THB", quote_currency: "CNY", rate_type: "spot", bid_rate: 4.72, ask_rate: 4.78, mid_rate: 4.75, effective_date: "2024-01-15", source: "BOT" },
];

const MOCK_LEDGER_ENTRIES = [
  { id: "1", batch_id: "B001", ledger_account: "2000", entry_type: "credit", amount: 5000000, currency: "THB", status: "posted", description: "Initial deposit", value_date: "2024-01-10", reference: "OPEN-TH12301" },
  { id: "2", batch_id: "B001", ledger_account: "1000", entry_type: "debit", amount: 5000000, currency: "THB", status: "posted", description: "Initial deposit", value_date: "2024-01-10", reference: "OPEN-TH12301" },
  { id: "3", batch_id: "B002", ledger_account: "2000", entry_type: "debit", amount: 1000000, currency: "THB", status: "posted", description: "PromptPay transfer to 0123456789", value_date: "2024-01-12", reference: "PP-A1B2C3D4" },
  { id: "4", batch_id: "B002", ledger_account: "2000", entry_type: "credit", amount: 1000000, currency: "THB", status: "posted", description: "PromptPay transfer from TH12301", value_date: "2024-01-12", reference: "PP-A1B2C3D4" },
  { id: "5", batch_id: "B003", ledger_account: "1200", entry_type: "debit", amount: 20000000, currency: "THB", status: "posted", description: "Loan disbursement - LN-M1N2O3", value_date: "2024-01-14", reference: "DISB-LN-M1N2O3" },
];

const MOCK_LOANS = [
  { id: "1", loan_no: "LN-M1N2O3P4", loan_type: "housing", status: "active", borrower_id: "u1", principal_amount: 500000000, outstanding_principal: 480000000, outstanding_interest: 15000000, interest_rate: 6.5, tenure_months: 360, next_payment_date: "2024-02-01", npa_flag: false },
  { id: "2", loan_no: "LN-Q5R6S7T8", loan_type: "personal", status: "active", borrower_id: "u2", principal_amount: 100000000, outstanding_principal: 75000000, outstanding_interest: 3200000, interest_rate: 8.5, tenure_months: 60, next_payment_date: "2024-02-01", npa_flag: false },
  { id: "3", loan_no: "LN-U9V0W1X2", loan_type: "auto", status: "past_due", borrower_id: "u3", principal_amount: 300000000, outstanding_principal: 250000000, outstanding_interest: 8500000, interest_rate: 5.9, tenure_months: 84, next_payment_date: "2024-01-05", npa_flag: true },
  { id: "4", loan_no: "LN-Y3Z4A5B6", loan_type: "business", status: "approved", borrower_id: "u4", principal_amount: 1000000000, outstanding_principal: 0, outstanding_interest: 0, interest_rate: 7.25, tenure_months: 120, next_payment_date: null, npa_flag: false },
];

const MOCK_CARDS = [
  { id: "1", card_no_masked: "411111******1111", card_type: "credit", status: "active", network: "visa", account_id: "1", cardholder_name: "SOMCHAI P.", credit_limit: 5000000, available_credit: 3200000, expiry_month: 12, expiry_year: 2027 },
  { id: "2", card_no_masked: "550000******4444", card_type: "credit", status: "active", network: "mastercard", account_id: "2", cardholder_name: "SUKUMA T.", credit_limit: 10000000, available_credit: 8500000, expiry_month: 6, expiry_year: 2026 },
  { id: "3", card_no_masked: "422222******3333", card_type: "debit", status: "active", network: "visa", account_id: "1", cardholder_name: "SOMCHAI P.", credit_limit: null, available_credit: null, expiry_month: 3, expiry_year: 2028 },
  { id: "4", card_no_masked: "356611******5555", card_type: "credit", status: "frozen", network: "jcb", account_id: "3", cardholder_name: "WICHAI K.", credit_limit: 3000000, available_credit: 3000000, expiry_month: 9, expiry_year: 2025 },
];

// ---------------------------------------------------------------------------
// Dashboard Panel
// ---------------------------------------------------------------------------

function DashboardPanel() {
  return (
    <div className="panel">
      <h2>System Overview</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{MOCK_ACCOUNTS.filter(a => a.status === "active").length}</span>
          <span className="stat-label">Active Accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{MOCK_LOANS.filter(l => l.status === "active").length}</span>
          <span className="stat-label">Active Loans</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{MOCK_CARDS.filter(c => c.status === "active").length}</span>
          <span className="stat-label">Active Cards</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{MOCK_FX_RATES.length}</span>
          <span className="stat-label">FX Rate Pairs</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{MOCK_LEDGER_ENTRIES.length}</span>
          <span className="stat-label">Ledger Entries</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{MOCK_LOANS.filter(l => l.npa_flag).length}</span>
          <span className="stat-label">NPA Loans</span>
        </div>
      </div>
      <div className="panel-section">
        <h3>Quick Actions</h3>
        <div className="action-bar">
          <button className="btn btn-primary">Open Account</button>
          <button className="btn btn-secondary">New Loan</button>
          <button className="btn btn-secondary">Transfer</button>
          <button className="btn btn-secondary">FX Transaction</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounts Panel
// ---------------------------------------------------------------------------

function AccountsPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const filtered = MOCK_ACCOUNTS.filter((a) => {
    const matchesSearch =
      !searchTerm ||
      a.account_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.citizen_id?.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    const matchesType = filterType === "all" || a.account_type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="panel">
      <h2>Accounts Management</h2>
      <div className="filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search by account no. or citizen ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="dormant">Dormant</option>
          <option value="frozen">Frozen</option>
          <option value="closed">Closed</option>
        </select>
        <select className="select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="savings">Savings</option>
          <option value="current">Current</option>
          <option value="fixed_deposit">Fixed Deposit</option>
          <option value="foreign_currency">Foreign Currency</option>
          <option value="money_market">Money Market</option>
        </select>
        <button className="btn btn-primary">Search</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account No.</th>
              <th>Type</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Balance</th>
              <th>Available</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.account_no}</td>
                <td><span className="badge badge-type">{a.account_type}</span></td>
                <td><span className={`badge badge-status badge-${a.status}`}>{a.status}</span></td>
                <td>{a.currency}</td>
                <td className="number">{formatSatang(a.balance)}</td>
                <td className="number">{formatSatang(a.available_balance)}</td>
                <td>{a.branch_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="empty-state">No accounts match your search criteria.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transfers Panel
// ---------------------------------------------------------------------------

function TransfersPanel() {
  const [transferType, setTransferType] = useState<"promptpay" | "interbank">("promptpay");
  const [formState, setFormState] = useState({
    fromAccountId: "",
    toIdentifier: "",
    toAccountNo: "",
    toBankCode: "",
    toAccountName: "",
    amount: "",
    currency: "THB",
    channel: "ITMX" as "BAHTNET" | "ITMX",
    description: "",
  });

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <div className="panel">
      <h2>Transfers</h2>
      <div className="tab-bar">
        <button
          className={`tab ${transferType === "promptpay" ? "active" : ""}`}
          onClick={() => setTransferType("promptpay")}
        >
          PromptPay
        </button>
        <button
          className={`tab ${transferType === "interbank" ? "active" : ""}`}
          onClick={() => setTransferType("interbank")}
        >
          Interbank
        </button>
      </div>

      {transferType === "promptpay" ? (
        <div className="form-section">
          <h3>PromptPay Transfer</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">From Account ID</label>
              <input className="input" value={formState.fromAccountId} onChange={(e) => handleFieldChange("fromAccountId", e.target.value)} placeholder="Account UUID" />
            </div>
            <div className="form-group">
              <label className="label">To Identifier (Citizen ID / Tax ID / Phone)</label>
              <input className="input" value={formState.toIdentifier} onChange={(e) => handleFieldChange("toIdentifier", e.target.value)} placeholder="e.g. 0812345678" />
            </div>
            <div className="form-group">
              <label className="label">Amount (Satang)</label>
              <input className="input" type="number" value={formState.amount} onChange={(e) => handleFieldChange("amount", e.target.value)} placeholder="e.g. 100000" />
            </div>
            <div className="form-group">
              <label className="label">Currency</label>
              <select className="select" value={formState.currency} onChange={(e) => handleFieldChange("currency", e.target.value)}>
                <option value="THB">THB</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="label">Description</label>
              <input className="input" value={formState.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Transfer description" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">Inquiry</button>
            <button className="btn btn-primary">Transfer</button>
          </div>
        </div>
      ) : (
        <div className="form-section">
          <h3>Interbank Transfer</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">From Account ID</label>
              <input className="input" value={formState.fromAccountId} onChange={(e) => handleFieldChange("fromAccountId", e.target.value)} placeholder="Account UUID" />
            </div>
            <div className="form-group">
              <label className="label">To Account No.</label>
              <input className="input" value={formState.toAccountNo} onChange={(e) => handleFieldChange("toAccountNo", e.target.value)} placeholder="e.g. 1234567890" />
            </div>
            <div className="form-group">
              <label className="label">To Bank Code</label>
              <input className="input" value={formState.toBankCode} onChange={(e) => handleFieldChange("toBankCode", e.target.value)} placeholder="e.g. 002" />
            </div>
            <div className="form-group">
              <label className="label">To Account Name</label>
              <input className="input" value={formState.toAccountName} onChange={(e) => handleFieldChange("toAccountName", e.target.value)} placeholder="Recipient name" />
            </div>
            <div className="form-group">
              <label className="label">Amount (Satang)</label>
              <input className="input" type="number" value={formState.amount} onChange={(e) => handleFieldChange("amount", e.target.value)} placeholder="e.g. 2000000" />
            </div>
            <div className="form-group">
              <label className="label">Channel</label>
              <select className="select" value={formState.channel} onChange={(e) => handleFieldChange("channel", e.target.value)}>
                <option value="ITMX">ITMX</option>
                <option value="BAHTNET">BAHTNET</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="label">Description</label>
              <input className="input" value={formState.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Transfer description" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary">Transfer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loans Panel
// ---------------------------------------------------------------------------

function LoansPanel() {
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);

  const loan = MOCK_LOANS.find((l) => l.id === selectedLoan);

  return (
    <div className="panel">
      <h2>Loan Management</h2>
      <div className="action-bar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary">New Loan Application</button>
        <button className="btn btn-secondary">Classify NPA</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Loan No.</th>
              <th>Type</th>
              <th>Status</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Interest Rate</th>
              <th>NPA</th>
              <th>Next Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LOANS.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.loan_no}</td>
                <td><span className="badge badge-type">{l.loan_type}</span></td>
                <td><span className={`badge badge-status badge-${l.status}`}>{l.status}</span></td>
                <td className="number">{formatSatang(l.principal_amount)}</td>
                <td className="number">{formatSatang(l.outstanding_principal)}</td>
                <td className="number">{l.interest_rate}%</td>
                <td>{l.npa_flag ? <span className="badge badge-status badge-past_due">Yes</span> : "No"}</td>
                <td>{formatDate(l.next_payment_date)}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setSelectedLoan(l.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loan && (
        <div className="detail-card">
          <h3>Loan Detail: {loan.loan_no}</h3>
          <div className="detail-grid">
            <div><span className="detail-label">Status:</span> {loan.status}</div>
            <div><span className="detail-label">Type:</span> {loan.loan_type}</div>
            <div><span className="detail-label">Principal:</span> {formatSatang(loan.principal_amount)}</div>
            <div><span className="detail-label">Outstanding Principal:</span> {formatSatang(loan.outstanding_principal)}</div>
            <div><span className="detail-label">Outstanding Interest:</span> {formatSatang(loan.outstanding_interest)}</div>
            <div><span className="detail-label">Interest Rate:</span> {loan.interest_rate}%</div>
            <div><span className="detail-label">Tenure:</span> {loan.tenure_months} months</div>
            <div><span className="detail-label">NPA Flag:</span> {loan.npa_flag ? "Yes" : "No"}</div>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            {loan.status === "approved" && <button className="btn btn-primary">Disburse</button>}
            {loan.status === "active" && <button className="btn btn-primary">Record Payment</button>}
            <button className="btn btn-secondary" onClick={() => setSelectedLoan(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards Panel
// ---------------------------------------------------------------------------

function CardsPanel() {
  return (
    <div className="panel">
      <h2>Card Management</h2>
      <div className="action-bar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary">Issue New Card</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Card Number</th>
              <th>Type</th>
              <th>Network</th>
              <th>Status</th>
              <th>Cardholder</th>
              <th>Credit Limit</th>
              <th>Available</th>
              <th>Expiry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CARDS.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.card_no_masked}</td>
                <td><span className="badge badge-type">{c.card_type}</span></td>
                <td><span className="badge badge-network">{c.network}</span></td>
                <td><span className={`badge badge-status badge-${c.status}`}>{c.status}</span></td>
                <td>{c.cardholder_name}</td>
                <td className="number">{c.credit_limit ? formatSatang(c.credit_limit) : "-"}</td>
                <td className="number">{c.available_credit ? formatSatang(c.available_credit) : "-"}</td>
                <td>{String(c.expiry_month).padStart(2, "0")}/{c.expiry_year}</td>
                <td>
                  {c.status === "pending_activation" && <button className="btn btn-sm btn-primary">Activate</button>}
                  {c.status === "active" && <button className="btn btn-sm btn-danger">Block</button>}
                  {c.status === "frozen" && <button className="btn btn-sm btn-secondary">Unblock</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FX Panel
// ---------------------------------------------------------------------------

function FxPanel() {
  return (
    <div className="panel">
      <h2>FX Rates</h2>
      <div className="action-bar" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary">New FX Transaction</button>
        <button className="btn btn-secondary">Refresh Rates</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Base</th>
              <th>Quote</th>
              <th>Type</th>
              <th>Bid Rate</th>
              <th>Ask Rate</th>
              <th>Mid Rate</th>
              <th>Effective Date</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_FX_RATES.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.base_currency}</strong></td>
                <td><strong>{r.quote_currency}</strong></td>
                <td><span className="badge badge-type">{r.rate_type}</span></td>
                <td className="number">{r.bid_rate.toFixed(4)}</td>
                <td className="number">{r.ask_rate.toFixed(4)}</td>
                <td className="number">{r.mid_rate.toFixed(4)}</td>
                <td>{r.effective_date}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-section">
        <h3>FX Conversion Calculator</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Sell Currency</label>
            <select className="select">
              <option value="THB">THB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Buy Currency</label>
            <select className="select">
              <option value="USD">USD</option>
              <option value="THB">THB</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Sell Amount (Satang)</label>
            <input className="input" type="number" placeholder="e.g. 10000000" />
          </div>
          <div className="form-group">
            <label className="label">Estimated Buy Amount</label>
            <input className="input" type="text" readOnly value="-" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary">Calculate</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger Panel
// ---------------------------------------------------------------------------

function LedgerPanel() {
  return (
    <div className="panel">
      <h2>Ledger Entries</h2>
      <div className="filter-bar">
        <input className="input" type="text" placeholder="Filter by reference..." />
        <select className="select">
          <option value="">All Accounts</option>
          <option value="1000">1000 - Cash</option>
          <option value="1200">1200 - Loans</option>
          <option value="2000">2000 - Deposits</option>
          <option value="4000">4000 - Interest Income</option>
          <option value="4100">4100 - Fee Income</option>
        </select>
        <select className="select">
          <option value="">All Status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
          <option value="reversed">Reversed</option>
        </select>
        <input className="input" type="date" />
        <input className="input" type="date" />
        <button className="btn btn-primary">Filter</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>GL Account</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Value Date</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEDGER_ENTRIES.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.batch_id}</td>
                <td className="mono">{e.ledger_account}</td>
                <td><span className={`badge badge-${e.entry_type}`}>{e.entry_type}</span></td>
                <td className="number">{formatSatang(e.amount)}</td>
                <td>{e.currency}</td>
                <td><span className={`badge badge-status badge-${e.status}`}>{e.status}</span></td>
                <td className="mono">{e.reference}</td>
                <td className="description-cell">{e.description}</td>
                <td>{e.value_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Panel
// ---------------------------------------------------------------------------

function AuditPanel() {
  return (
    <div className="panel">
      <h2>Audit Log</h2>
      <p>View system audit trail and compliance records.</p>
      <div className="filter-bar">
        <input className="input" type="text" placeholder="Filter by entity..." />
        <select className="select">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="approve">Approve</option>
          <option value="activate">Activate</option>
          <option value="block">Block</option>
        </select>
        <button className="btn btn-primary">Search</button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Entity Type</th>
              <th>Entity ID</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="empty-state">No audit records to display</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel map
// ---------------------------------------------------------------------------

const PANEL_MAP: Record<NavItem, JSX.Element> = {
  dashboard: <DashboardPanel />,
  accounts: <AccountsPanel />,
  transfers: <TransfersPanel />,
  loans: <LoansPanel />,
  cards: <CardsPanel />,
  fx: <FxPanel />,
  ledger: <LedgerPanel />,
  audit: <AuditPanel />,
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("dashboard");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">🏦 THB</h1>
          <span className="logo-sub">Thai Bank Platform</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeNav === item.key ? "active" : ""}`}
              onClick={() => setActiveNav(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="version">v1.0.0</span>
        </div>
      </aside>
      <main className="main-content">
        <header className="top-bar">
          <h2 className="page-title">{NAV_ITEMS.find((n) => n.key === activeNav)?.label}</h2>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <div className="user-avatar">A</div>
          </div>
        </header>
        <div className="content-area">{PANEL_MAP[activeNav]}</div>
      </main>
    </div>
  );
}
