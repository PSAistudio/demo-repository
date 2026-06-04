import { handleListAccounts, handleGetAccount, handleCreateAccount, handleUpdateAccountStatus } from "./accounts.js";
import { handlePromptPayTransfer, handlePromptPayInquiry, handleInterbankTransfer } from "./transfers.js";
import { handleListLoans, handleGetLoan, handleCreateLoan, handleUpdateLoanStatus } from "./loans.js";

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
  { method: "GET", pattern: "^/api/loans$", handler: () => handleListLoans(new Request("http://localhost")) },
  { method: "GET", pattern: "^/api/loans/([^/]+)$", handler: (_req, p) => handleGetLoan(p[1]) },
  { method: "POST", pattern: "^/api/loans$", handler: (req) => handleCreateLoan(req) },
  {
    method: "PATCH",
    pattern: "^/api/loans/([^/]+)/status$",
    handler: (req, p) => handleUpdateLoanStatus(p[1], req),
  },
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
