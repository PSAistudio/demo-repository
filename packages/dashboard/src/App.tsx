import { useState } from "react";

type NavItem = "dashboard" | "accounts" | "transfers" | "loans" | "cards" | "fx" | "audit";

const NAV_ITEMS: { key: NavItem; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "accounts", label: "Accounts", icon: "🏦" },
  { key: "transfers", label: "Transfers", icon: "💸" },
  { key: "loans", label: "Loans", icon: "📋" },
  { key: "cards", label: "Cards", icon: "💳" },
  { key: "fx", label: "FX Rates", icon: "💱" },
  { key: "audit", label: "Audit Log", icon: "📝" },
];

function DashboardPanel() {
  return (
    <div className="panel">
      <h2>System Overview</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">0</span>
          <span className="stat-label">Active Accounts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">0</span>
          <span className="stat-label">Pending Transfers</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">0</span>
          <span className="stat-label">Active Loans</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">0</span>
          <span className="stat-label">BOT Messages</span>
        </div>
      </div>
    </div>
  );
}

function AccountsPanel() {
  return (
    <div className="panel">
      <h2>Accounts Management</h2>
      <p>View and manage customer accounts, account lifecycle, and balances.</p>
      <div className="action-bar">
        <button className="btn btn-primary">Open New Account</button>
        <button className="btn btn-secondary">Search Accounts</button>
      </div>
    </div>
  );
}

function TransfersPanel() {
  return (
    <div className="panel">
      <h2>Transfers</h2>
      <p>Initiate PromptPay, interbank (BAHTNET/ITMX), and internal transfers.</p>
      <div className="action-bar">
        <button className="btn btn-primary">PromptPay Transfer</button>
        <button className="btn btn-secondary">Interbank Transfer</button>
        <button className="btn btn-secondary">Inquiry</button>
      </div>
    </div>
  );
}

function LoansPanel() {
  return (
    <div className="panel">
      <h2>Loan Management</h2>
      <p>Manage loan applications, disbursements, and repayment schedules.</p>
      <div className="action-bar">
        <button className="btn btn-primary">New Loan Application</button>
        <button className="btn btn-secondary">View Schedules</button>
      </div>
    </div>
  );
}

function CardsPanel() {
  return (
    <div className="panel">
      <h2>Card Management</h2>
      <p>Manage credit, debit, and prepaid cards including activation and limits.</p>
    </div>
  );
}

function FxPanel() {
  return (
    <div className="panel">
      <h2>FX Rates</h2>
      <p>View and manage foreign exchange rates and FX transactions.</p>
    </div>
  );
}

function AuditPanel() {
  return (
    <div className="panel">
      <h2>Audit Log</h2>
      <p>View system audit trail and compliance records.</p>
    </div>
  );
}

const PANEL_MAP: Record<NavItem, JSX.Element> = {
  dashboard: <DashboardPanel />,
  accounts: <AccountsPanel />,
  transfers: <TransfersPanel />,
  loans: <LoansPanel />,
  cards: <CardsPanel />,
  fx: <FxPanel />,
  audit: <AuditPanel />,
};

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
