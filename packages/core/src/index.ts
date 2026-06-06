// Ledger engine
export {
  createBatch,
  addEntry,
  postBatch,
  reverseBatch,
  getAccountBalance,
  getBatch,
  type LedgerBatch,
  type LedgerEntry,
  type BatchStatus,
} from "./ledger/engine.js";

// Account lifecycle
export {
  openAccount,
  closeAccount,
  freezeAccount,
  unfreezeAccount,
  markDormant,
  type OpenAccountParams,
  type AccountResult,
} from "./accounts/lifecycle.js";

// PromptPay transfers
export {
  initiatePromptPayTransfer,
  inquiryPromptPay,
  type PromptPayTransferParams,
  type PromptPayTransferResult,
  type PromptPayInquiryResult,
} from "./transfers/promptpay.js";

// Interbank transfers
export {
  initiateInterbankTransfer,
  type InterbankChannel,
  type InterbankTransferParams,
  type InterbankTransferResult,
} from "./transfers/interbank.js";

// ISO 20022 BOT adapter
export {
  buildPacs008,
  parsePacs008,
  buildPacs002,
  generateMessageId,
  type Pacs008Message,
  type Pacs002Message,
} from "./bot-adapter/iso20022.js";

// Loan schedule calculator
export {
  calculateFlatRateSchedule,
  calculateReducingBalanceSchedule,
  calculateEffectiveRateSchedule,
  type ScheduleEntry,
} from "./loans/calculator.js";

// Loan lifecycle
export {
  createLoan,
  approveLoan,
  disburseLoan,
  recordPayment,
  classifyNPA,
  type CreateLoanParams,
  type LoanResult,
  type NPAClassification,
} from "./loans/lifecycle.js";

// Card lifecycle
export {
  issueCard,
  activateCard,
  blockCard,
  recordCardTransaction,
  checkCreditLimit,
  maskCardNumber,
  type IssueCardParams,
  type CardResult,
} from "./cards/lifecycle.js";

// FX operations
export {
  getFxRate,
  executeFxTransaction,
  checkBotReportingThreshold,
  type FxRateResult,
  type FxTransactionResult,
} from "./fx/operations.js";
