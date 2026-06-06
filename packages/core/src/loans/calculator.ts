/**
 * Loan Schedule Calculator
 *
 * All monetary values are in minor units (satang = 1/100 THB).
 * Interest rates are expressed as annual percentage (e.g. 6.5 = 6.5%).
 * Tenure is always in months.
 */

export interface ScheduleEntry {
  installment_no: number;
  due_date: Date;
  principal: number;
  interest: number;
  total: number;
  balance: number;
}

/**
 * Round to the nearest satang (integer minor unit).
 */
function roundSatang(value: number): number {
  return Math.round(value);
}

/**
 * Calculate the number of periods between two dates given a frequency.
 */
function addPeriods(baseDate: Date, frequency: string, periods: number): Date {
  const d = new Date(baseDate);
  switch (frequency) {
    case "monthly":
      d.setMonth(d.getMonth() + periods);
      break;
    case "bi_weekly":
      d.setDate(d.getDate() + 14 * periods);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * periods);
      break;
    case "semi_annually":
      d.setMonth(d.getMonth() + 6 * periods);
      break;
    case "annually":
      d.setFullYear(d.getFullYear() + periods);
      break;
    default:
      d.setMonth(d.getMonth() + periods);
  }
  return d;
}

/**
 * Return the number of periods per year for a given payment frequency.
 */
function periodsPerYear(frequency: string): number {
  switch (frequency) {
    case "monthly":
      return 12;
    case "bi_weekly":
      return 26;
    case "quarterly":
      return 4;
    case "semi_annually":
      return 2;
    case "annually":
      return 1;
    default:
      return 12;
  }
}

/**
 * Flat Rate Amortization
 *
 * Interest is calculated on the original principal for the entire tenure.
 * Each installment has equal principal + equal interest.
 */
export function calculateFlatRateSchedule(params: {
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  paymentFrequency: string;
  disbursementDate?: Date;
}): ScheduleEntry[] {
  const { principalAmount, interestRate, tenureMonths, paymentFrequency } = params;
  const startDate = params.disbursementDate ?? new Date();
  const ppy = periodsPerYear(paymentFrequency);
  const totalPeriods = Math.ceil((tenureMonths / 12) * ppy);
  const annualInterest = principalAmount * (interestRate / 100);
  const periodicInterest = roundSatang(annualInterest / ppy);
  const periodicPrincipal = roundSatang(principalAmount / totalPeriods);

  const schedule: ScheduleEntry[] = [];
  let remainingBalance = principalAmount;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate = addPeriods(startDate, paymentFrequency, i);
    // Last installment picks up any rounding difference
    const isLast = i === totalPeriods;
    const principalPortion = isLast ? remainingBalance : periodicPrincipal;
    const interestPortion = periodicInterest;
    const totalPayment = principalPortion + interestPortion;
    remainingBalance -= principalPortion;

    schedule.push({
      installment_no: i,
      due_date: dueDate,
      principal: principalPortion,
      interest: interestPortion,
      total: totalPayment,
      balance: Math.max(0, remainingBalance),
    });
  }

  return schedule;
}

/**
 * Reducing Balance Amortization (Equal Installment / EMI)
 *
 * Each installment is equal. Interest is calculated on the outstanding
 * principal balance at the start of each period.
 */
export function calculateReducingBalanceSchedule(params: {
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  paymentFrequency: string;
  disbursementDate?: Date;
}): ScheduleEntry[] {
  const { principalAmount, interestRate, tenureMonths, paymentFrequency } = params;
  const startDate = params.disbursementDate ?? new Date();
  const ppy = periodsPerYear(paymentFrequency);
  const totalPeriods = Math.ceil((tenureMonths / 12) * ppy);
  const periodicRate = interestRate / 100 / ppy;

  // EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + periodicRate, totalPeriods);
  const emi = periodicRate > 0
    ? roundSatang(principalAmount * periodicRate * factor / (factor - 1))
    : roundSatang(principalAmount / totalPeriods);

  const schedule: ScheduleEntry[] = [];
  let remainingBalance = principalAmount;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate = addPeriods(startDate, paymentFrequency, i);
    const interestPortion = roundSatang(remainingBalance * periodicRate);
    const isLast = i === totalPeriods;
    const principalPortion = isLast ? remainingBalance : Math.max(0, emi - interestPortion);
    const totalPayment = isLast ? principalPortion + interestPortion : emi;
    remainingBalance -= principalPortion;

    schedule.push({
      installment_no: i,
      due_date: dueDate,
      principal: principalPortion,
      interest: interestPortion,
      total: totalPayment,
      balance: Math.max(0, remainingBalance),
    });
  }

  return schedule;
}

/**
 * Effective Rate Amortization (Equal Principal)
 *
 * Principal repayment is equal each period. Interest decreases as the
 * outstanding principal declines.
 */
export function calculateEffectiveRateSchedule(params: {
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  paymentFrequency: string;
  disbursementDate?: Date;
}): ScheduleEntry[] {
  const { principalAmount, interestRate, tenureMonths, paymentFrequency } = params;
  const startDate = params.disbursementDate ?? new Date();
  const ppy = periodsPerYear(paymentFrequency);
  const totalPeriods = Math.ceil((tenureMonths / 12) * ppy);
  const periodicRate = interestRate / 100 / ppy;
  const periodicPrincipal = roundSatang(principalAmount / totalPeriods);

  const schedule: ScheduleEntry[] = [];
  let remainingBalance = principalAmount;

  for (let i = 1; i <= totalPeriods; i++) {
    const dueDate = addPeriods(startDate, paymentFrequency, i);
    const isLast = i === totalPeriods;
    const principalPortion = isLast ? remainingBalance : periodicPrincipal;
    const interestPortion = roundSatang(remainingBalance * periodicRate);
    const totalPayment = principalPortion + interestPortion;
    remainingBalance -= principalPortion;

    schedule.push({
      installment_no: i,
      due_date: dueDate,
      principal: principalPortion,
      interest: interestPortion,
      total: totalPayment,
      balance: Math.max(0, remainingBalance),
    });
  }

  return schedule;
}
