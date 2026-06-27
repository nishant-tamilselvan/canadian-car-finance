import type { LoanInput, LoanResult } from './types/index.js';
import { computeFinancedAmount } from './taxes.js';

function amortize(principal: number, periodicRate: number, periods: number): number {
  if (periods <= 0) return 0;
  if (periodicRate === 0) return principal / periods;
  const factor = Math.pow(1 + periodicRate, periods);
  return (principal * periodicRate * factor) / (factor - 1);
}

/**
 * Calculates all loan / financing figures for a vehicle purchase.
 *
 * Uses the standard amortization formula:
 *   payment = P × r(1+r)^n / ((1+r)^n − 1)
 *
 * Bi-weekly rate uses compound conversion:
 *   rate = (1 + APR/2)^(2/26) − 1
 *
 * @param input  Full loan scenario inputs
 * @returns      Payment, totals, interest breakdown, and cost of ownership
 */
export function calculateLoan(input: LoanInput): LoanResult {
  const { vehiclePrice, province, downPayment, tradeInValue, fees, interestRate, termMonths, frequency } = input;

  // Single-pass fee accumulation
  let totalFeesAmount = 0;
  let mandatoryFeesTotal = 0;
  let negotiableFeesTotal = 0;
  let watchoutFeesTotal = 0;
  for (const f of fees) {
    totalFeesAmount += f.amount;
    if (f.category === 'mandatory')  mandatoryFeesTotal  += f.amount;
    else if (f.category === 'negotiable') negotiableFeesTotal += f.amount;
    else if (f.category === 'watchout')   watchoutFeesTotal   += f.amount;
  }

  const { financedAmount, taxAmount, taxRate } = computeFinancedAmount(
    vehiclePrice, province, downPayment, tradeInValue, totalFeesAmount,
  );

  const totalCashPrice = vehiclePrice + taxAmount + totalFeesAmount;

  const annualRate = interestRate / 100;
  let payment: number;
  let totalPayments: number;

  if (frequency === 'monthly') {
    const monthlyRate = annualRate / 12;
    payment = amortize(financedAmount, monthlyRate, termMonths);
    totalPayments = Math.max(0, termMonths);
  } else {
    const biweeklyRate = Math.pow(1 + annualRate / 2, 2 / 26) - 1;
    totalPayments = Math.round((termMonths / 12) * 26);
    payment = amortize(financedAmount, biweeklyRate, totalPayments);
  }

  const totalPaid = payment * totalPayments;
  const totalInterest = totalPaid - financedAmount;
  const totalCostOfOwnership = totalCashPrice + totalInterest;

  return {
    financedAmount,
    taxAmount,
    taxRate,
    totalFeesAmount,
    mandatoryFeesTotal,
    negotiableFeesTotal,
    watchoutFeesTotal,
    totalCashPrice,
    payment,
    totalPayments,
    totalPaid,
    totalInterest,
    totalCostOfOwnership,
  };
}

/**
 * Formats a number as a Canadian dollar string.
 * @example formatCAD(1234.5) // "$1,234.50"
 */
export function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
