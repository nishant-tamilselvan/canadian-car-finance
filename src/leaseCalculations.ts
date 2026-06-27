import type { LeaseInput, LeaseResult } from './types/index.js';
import { PROVINCE_TAX } from './taxes.js';

/**
 * Fee names containing any of these substrings are treated as **filing/documentary fees**:
 * they are deducted from the Net Cap Cost (per contract section 1h-ii) rather than
 * added to the Gross Cap Cost as surcharges.
 *
 * Extend this list if your lender uses different terminology:
 * @example
 * import { FILING_FEE_KEYWORDS } from 'canadian-car-finance';
 * const myKeywords = [...FILING_FEE_KEYWORDS, 'registration charge'];
 */
export const FILING_FEE_KEYWORDS: readonly string[] = [
  'filing',
  'registry',
  'licensing',
  'document',
];

/**
 * Calculates all lease figures using the standard Canadian lease formula.
 *
 * Formula reference:
 *   Money Factor      = APR / 2400
 *   Gross Cap Cost    = vehiclePrice + surcharge fees (all fees NOT in FILING_FEE_KEYWORDS)
 *   Net Cap Cost (1i) = Gross Cap Cost − downPayment − filingFees − tradeInNet − manufacturerRebate
 *   Depreciation/mo   = (Net Cap Cost − Residual) / n
 *   Finance Charge/mo = (Net Cap Cost + Residual) × Money Factor
 *   Base Monthly      = Depreciation/mo + Finance Charge/mo
 *   Total Monthly     = Base Monthly × (1 + taxRate)
 *   Bi-weekly payment = Monthly × 12 / 26 (Canadian standard)
 *   Lease Charges     = Finance Charge/mo × n
 *   Due at Signing    = downPayment + firstPayment + filingFees + tax on (downPayment + filingFees)
 *   Total Cost        = totalOfPayments + dueAtSigning − firstPayment − securityDeposit
 *
 * Fee classification:
 *   Fees whose `category` is 'mandatory' and whose name matches FILING_FEE_KEYWORDS → filing fee
 *   All other fees → surcharge (added to Gross Cap Cost)
 *
 * @param input  Full lease scenario inputs
 * @returns      Complete lease breakdown matching standard contract sections 1–5
 * @throws       Never — returns 0-valued result for degenerate inputs (zero term, etc.)
 */
export function calculateLease(input: LeaseInput): LeaseResult {
  const {
    vehiclePrice,
    province,
    downPayment,
    tradeInNet,
    manufacturerRebate,
    fees,
    residualValue,
    leaseTermMonths,
    frequency,
    interestRate,
    securityDeposit,
  } = input;

  if (leaseTermMonths <= 0) {
    return {
      grossCapCost: vehiclePrice,
      netCapCost: vehiclePrice,
      residualValue,
      totalToAmortize: 0,
      taxRate: PROVINCE_TAX[province].rate,
      depreciationPerMonth: 0,
      moneyFactor: 0,
      financeChargePerMonth: 0,
      baseMonthlyPayment: 0,
      taxOnMonthly: 0,
      periodicPayment: 0,
      leaseCharges: 0,
      totalPayments: 0,
      totalDueAtSigning: 0,
      totalOfPayments: 0,
      totalCostOfLease: 0,
    };
  }

  const taxRate = PROVINCE_TAX[province].rate;

  // ── Section 1: Capitalization ──────────────────────────────────────────
  // Use FeeCategory + FILING_FEE_KEYWORDS to classify fees.
  // A fee is a filing fee if its name matches any FILING_FEE_KEYWORDS substring.
  // Everything else is a surcharge added to Gross Cap Cost.
  let filingFees = 0;
  let surcharges = 0;
  for (const f of fees) {
    const lower = f.name.toLowerCase();
    const isFiling = FILING_FEE_KEYWORDS.some(k => lower.includes(k));
    if (isFiling) {
      filingFees += f.amount;
    } else {
      surcharges += f.amount;
    }
  }

  // Gross Cap Cost = selling price + surcharges (1a + 1g items)
  const grossCapCost = vehiclePrice + surcharges;

  // Net Cap Cost = Gross − downPayment − filingFees − tradeIn − rebates (1i)
  const netCapCost = grossCapCost - downPayment - filingFees - tradeInNet - manufacturerRebate;

  // Total to amortize (1k)
  const totalToAmortize = netCapCost - residualValue;

  // ── Section 2: Payment Calculation ────────────────────────────────────
  const moneyFactor = interestRate / 2400;
  const depreciationPerMonth = totalToAmortize / leaseTermMonths;
  const financeChargePerMonth = (netCapCost + residualValue) * moneyFactor;
  const baseMonthlyPayment = depreciationPerMonth + financeChargePerMonth;
  const taxOnMonthly = baseMonthlyPayment * taxRate;
  const monthlyPayment = baseMonthlyPayment + taxOnMonthly;

  // Bi-weekly: Canadian standard conversion (monthly × 12 / 26)
  const isBiweekly = frequency === 'biweekly';
  const totalPayments = isBiweekly
    ? Math.round((leaseTermMonths / 12) * 26)
    : leaseTermMonths;
  const periodicPayment = isBiweekly
    ? (monthlyPayment * 12) / 26
    : monthlyPayment;
  const totalOfPayments = periodicPayment * totalPayments;

  // ── Section 3: Lease Charges ──────────────────────────────────────────
  const leaseCharges = financeChargePerMonth * leaseTermMonths;

  // ── Section 4: Due at Signing ─────────────────────────────────────────
  // Tax on: downPayment + filingFees (per contract section 4i)
  const taxOnSigning = (downPayment + filingFees) * taxRate;
  const totalDueAtSigning =
    downPayment +
    periodicPayment +   // first payment
    filingFees +
    securityDeposit +
    taxOnSigning;

  // ── Section 5: Total Cost of Lease ────────────────────────────────────
  // Formula: (2f + 4l) − firstPayment − securityDeposit
  const totalCostOfLease =
    totalOfPayments + totalDueAtSigning - periodicPayment - securityDeposit;

  return {
    grossCapCost,
    netCapCost,
    residualValue,
    totalToAmortize,
    taxRate,
    depreciationPerMonth,
    moneyFactor,
    financeChargePerMonth,
    baseMonthlyPayment,
    taxOnMonthly,
    periodicPayment,
    leaseCharges,
    totalPayments,
    totalDueAtSigning,
    totalOfPayments,
    totalCostOfLease,
  };
}
