import type { AccountType, AccountCurrency, LoanType, LoanStatus } from "@thai-bank/db/schemas";

interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export function validateRequest(
  body: Record<string, unknown>,
  rules: ValidationRule[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const value = body[rule.field];
    const isUndefined = value === undefined;
    const isNull = value === null;

    if (rule.required && (isUndefined || isNull)) {
      errors.push({
        field: rule.field,
        message: `${rule.field} is required`,
        value,
      });
      continue;
    }

    if (isUndefined || isNull) continue;

    // Type check
    const actualType = Array.isArray(value)
      ? "array"
      : typeof value;

    if (actualType !== rule.type) {
      errors.push({
        field: rule.field,
        message: `${rule.field} must be of type ${rule.type}, got ${actualType}`,
        value,
      });
      continue;
    }

    // Enum check
    if (rule.enum && typeof value === "string" && !rule.enum.includes(value)) {
      errors.push({
        field: rule.field,
        message: `${rule.field} must be one of: ${rule.enum.join(", ")}`,
        value,
      });
    }

    // Number range checks
    if (rule.type === "number" && typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at least ${rule.min}`,
          value,
        });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at most ${rule.max}`,
          value,
        });
      }
    }

    // String length checks
    if (rule.type === "string" && typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at least ${rule.minLength} characters`,
          value,
        });
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at most ${rule.maxLength} characters`,
          value,
        });
      }
    }
  }

  return errors;
}

export const accountValidationRules: ValidationRule[] = [
  { field: "accountType", type: "string", required: true, enum: ["savings", "current", "fixed_deposit", "money_market", "foreign_currency"] },
  { field: "currency", type: "string", required: true, enum: ["THB", "USD", "EUR", "GBP", "JPY", "CNY"] },
  { field: "branchCode", type: "string", required: true, minLength: 3, maxLength: 5 },
  { field: "productCode", type: "string", required: true, minLength: 2, maxLength: 20 },
  { field: "citizenId", type: "string", required: false, minLength: 13, maxLength: 13 },
  { field: "taxId", type: "string", required: false, minLength: 10, maxLength: 13 },
  { field: "phoneNumber", type: "string", required: false, minLength: 10, maxLength: 15 },
  { field: "initialDeposit", type: "number", required: false, min: 0 },
];

export const transferValidationRules: ValidationRule[] = [
  { field: "fromAccountId", type: "string", required: true },
  { field: "amount", type: "number", required: true, min: 0.01 },
  { field: "currency", type: "string", required: true, enum: ["THB", "USD", "EUR", "GBP", "JPY", "CNY"] },
  { field: "description", type: "string", required: false, maxLength: 200 },
];

export const loanValidationRules: ValidationRule[] = [
  { field: "loanType", type: "string", required: true, enum: ["personal", "housing", "auto", "business", "overdraft", "agricultural"] },
  { field: "borrowerId", type: "string", required: true },
  { field: "principalAmount", type: "number", required: true, min: 1 },
  { field: "interestRate", type: "number", required: true, min: 0, max: 100 },
  { field: "repaymentMethod", type: "string", required: true, enum: ["equal_installment", "equal_principal", "bullet", "interest_only"] },
  { field: "paymentFrequency", type: "string", required: true, enum: ["monthly", "bi_weekly", "quarterly", "semi_annually", "annually"] },
  { field: "tenureMonths", type: "number", required: true, min: 1, max: 360 },
];
