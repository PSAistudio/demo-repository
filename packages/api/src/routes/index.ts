import { handleListAccounts, handleGetAccount, handleCreateAccount, handleUpdateAccountStatus } from "./accounts.js";
import { handlePromptPayTransfer, handlePromptPayInquiry, handleInterbankTransfer } from "./transfers.js";
import { handleListLoans, handleGetLoan, handleCreateLoan, handleUpdateLoanStatus } from "./loans.js";
import {
  handleListCards,
  handleGetCard,
  handleIssueCard,
  handleActivateCard,
  handleBlockCard,
  handleCheckCreditLimit,
  handleCardTransaction,
  handleListCardTransactions,
} from "./cards.js";
import {
  handleListFxRates,
  handleGetFxRate,
  handleExecuteFxTransaction,
  handleListFxTransactions,
  handleBotReportingCheck,
} from "./fx.js";
import {
  handleListBotMessages,
  handleGetBotMessage,
  handleSendBotMessage,
  handleGetBotMessageTracking,
} from "./bot.js";
import {
  handleTrialBalance,
  handleAccountStatement,
  handleListLedgerEntries,
} from "./reports.js";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RouteMatch {
  method: string;
  pattern: string;
  handler: (request: Request, params: Record<string, string>) => Promise<Response>;
}

const routes: RouteMatch[] = [
  // Accounts
  { method: "GET", pattern: "^/api/accounts$", handler: (req) => handleListAccounts(req) },
  { method: "GET", pattern: "^/api/accounts/([^/]+)$", handler: (req, p) => handleGetAccount(req, p[1]) },
  { method: "POST", pattern: "^/api/accounts$", handler: (req) => handleCreateAccount(req) },
  {
    method: "PATCH",
    pattern: "^/api/accounts/([^/]+)/status$",
    handler: (req, p) => handleUpdateAccountStatus(req, p[1]),
  },
  // Transfers - PromptPay
  { method: "POST", pattern: "^/api/transfers/promptpay$", handler: (req) => handlePromptPayTransfer(req) },
  { method: "GET", pattern: "^/api/transfers/promptpay/inquiry$", handler: (req) => handlePromptPayInquiry(req) },
  // Transfers - Interbank
  { method: "POST", pattern: "^/api/transfers/interbank$", handler: (req) => handleInterbankTransfer(req) },
  // Loans
  { method: "GET", pattern: "^/api/loans$", handler: (req) => handleListLoans(req) },
  { method: "GET", pattern: "^/api/loans/([^/]+)$", handler: (req, p) => handleGetLoan(p[1]) },
  { method: "POST", pattern: "^/api/loans$", handler: (req) => handleCreateLoan(req) },
  {
    method: "PATCH",
    pattern: "^/api/loans/([^/]+)/status$",
    handler: (req, p) => handleUpdateLoanStatus(p[1], req),
  },
  // Cards
  { method: "GET", pattern: "^/api/cards$", handler: (req) => handleListCards(req) },
  { method: "GET", pattern: "^/api/cards/([^/]+)$", handler: (req, p) => handleGetCard(req, p[1]) },
  { method: "POST", pattern: "^/api/cards$", handler: (req) => handleIssueCard(req) },
  { method: "POST", pattern: "^/api/cards/([^/]+)/activate$", handler: (req, p) => handleActivateCard(req, p[1]) },
  { method: "POST", pattern: "^/api/cards/([^/]+)/block$", handler: (req, p) => handleBlockCard(req, p[1]) },
  { method: "GET", pattern: "^/api/cards/([^/]+)/credit-limit$", handler: (req, p) => handleCheckCreditLimit(req, p[1]) },
  { method: "POST", pattern: "^/api/cards/([^/]+)/transactions$", handler: (req, p) => handleCardTransaction(req, p[1]) },
  { method: "GET", pattern: "^/api/cards/([^/]+)/transactions$", handler: (req, p) => handleListCardTransactions(req, p[1]) },
  // FX
  { method: "GET", pattern: "^/api/fx/rates$", handler: (req) => handleListFxRates(req) },
  { method: "GET", pattern: "^/api/fx/rates/([^/]+)/([^/]+)$", handler: (req, p) => handleGetFxRate(req, p[1], p[2]) },
  { method: "POST", pattern: "^/api/fx/transactions$", handler: (req) => handleExecuteFxTransaction(req) },
  { method: "GET", pattern: "^/api/fx/transactions$", handler: (req) => handleListFxTransactions(req) },
  { method: "GET", pattern: "^/api/fx/bot-check$", handler: (req) => handleBotReportingCheck(req) },
  // BOT Messages
  { method: "GET", pattern: "^/api/bot/messages$", handler: (req) => handleListBotMessages(req) },
  { method: "GET", pattern: "^/api/bot/messages/([^/]+)$", handler: (req, p) => handleGetBotMessage(req, p[1]) },
  { method: "POST", pattern: "^/api/bot/messages/send$", handler: (req) => handleSendBotMessage(req) },
  { method: "GET", pattern: "^/api/bot/messages/([^/]+)/tracking$", handler: (req, p) => handleGetBotMessageTracking(req, p[1]) },
  // Reports
  { method: "GET", pattern: "^/api/reports/trial-balance$", handler: (req) => handleTrialBalance(req) },
  { method: "GET", pattern: "^/api/reports/account-statement$", handler: (req) => handleAccountStatement(req) },
  { method: "GET", pattern: "^/api/reports/ledger-entries$", handler: (req) => handleListLedgerEntries(req) },
];

export function matchRoute(
  method: string,
  pathname: string
): { handler: RouteMatch["handler"]; params: string[] } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = pathname.match(route.pattern);
    if (match) {
      return { handler: route.handler, params: match.slice(1) };
    }
  }
  return null;
}

export { handleListAccounts, handleGetAccount, handleCreateAccount, handleUpdateAccountStatus } from "./accounts.js";
export { handlePromptPayTransfer, handlePromptPayInquiry, handleInterbankTransfer } from "./transfers.js";
export { handleListLoans, handleGetLoan, handleCreateLoan, handleUpdateLoanStatus } from "./loans.js";
export {
  handleListCards,
  handleGetCard,
  handleIssueCard,
  handleActivateCard,
  handleBlockCard,
  handleCheckCreditLimit,
  handleCardTransaction,
  handleListCardTransactions,
} from "./cards.js";
export {
  handleListFxRates,
  handleGetFxRate,
  handleExecuteFxTransaction,
  handleListFxTransactions,
  handleBotReportingCheck,
} from "./fx.js";
export {
  handleListBotMessages,
  handleGetBotMessage,
  handleSendBotMessage,
  handleGetBotMessageTracking,
} from "./bot.js";
export {
  handleTrialBalance,
  handleAccountStatement,
  handleListLedgerEntries,
} from "./reports.js";
