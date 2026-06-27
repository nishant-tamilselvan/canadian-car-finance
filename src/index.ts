/** Package version — use to verify which rules set is active. */
export const RULES_VERSION = '0.2.0';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  PaymentFrequency,
  Province,
  FeeCategory,
  FeeItem,
  LoanInput,
  LoanResult,
  LeaseInput,
  LeaseResult,
  FeeWarning,
  TaxInfo,
  TaxOverrides,
  FeeAnalysisOptions,
} from './types/index.js';

// ── Tax utilities ──────────────────────────────────────────────────────────
export {
  PROVINCE_TAX,
  PROVINCE_NAMES,
  computeFinancedAmount,
} from './taxes.js';

// ── Loan / financing calculations ─────────────────────────────────────────
export {
  calculateLoan,
  formatCAD,
} from './calculations.js';

// ── Lease calculations ────────────────────────────────────────────────────
export {
  FILING_FEE_KEYWORDS,
  calculateLease,
} from './leaseCalculations.js';

// ── Fee analysis & buyer protection ───────────────────────────────────────
export {
  DEFAULT_RED_FLAG_KEYWORDS,
  DEFAULT_NEGOTIABLE_KEYWORDS,
  DEFAULT_PPSA_THRESHOLDS,
  DEFAULT_ADMIN_FEE_THRESHOLDS,
  suggestCategory,
  analyzeInput,
  AB_DEFAULT_FEES,
  QUICK_ADD_PRESETS,
} from './feeAnalysis.js';
