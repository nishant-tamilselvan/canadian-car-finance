export type PaymentFrequency = 'monthly' | 'biweekly';

export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL'
  | 'NS' | 'NT' | 'NU' | 'ON' | 'PE'
  | 'QC' | 'SK' | 'YT';

export type FeeCategory = 'mandatory' | 'negotiable' | 'watchout';

export interface FeeItem {
  /** Optional UI identifier — not used in any calculation. */
  id?: string;
  name: string;
  amount: number;
  category: FeeCategory;
}

export interface LoanInput {
  vehiclePrice: number;
  /** AMVIC all-in price check (AB only). Omit or set undefined to skip. */
  advertisedPrice?: number;
  province: Province;
  downPayment: number;
  tradeInValue: number;
  fees: FeeItem[];
  /** Annual Percentage Rate, e.g. 5.99 for 5.99% */
  interestRate: number;
  termMonths: number;
  frequency: PaymentFrequency;
}

export interface LoanResult {
  financedAmount: number;
  taxAmount: number;
  taxRate: number;
  totalFeesAmount: number;
  mandatoryFeesTotal: number;
  negotiableFeesTotal: number;
  watchoutFeesTotal: number;
  /** vehiclePrice + tax + all fees (before any financing) */
  totalCashPrice: number;
  /** Payment amount per period (monthly or bi-weekly) */
  payment: number;
  /** Total number of payment periods */
  totalPayments: number;
  totalPaid: number;
  totalInterest: number;
  /** totalCashPrice + totalInterest — true cost of owning the vehicle */
  totalCostOfOwnership: number;
}

// ── Lease types ────────────────────────────────────────────────────────────

export interface LeaseInput {
  // Section 1 — Capitalized Cost
  /** 1a: Selling price of the vehicle */
  vehiclePrice: number;
  province: Province;
  /** 1h-i: Cash down payment */
  downPayment: number;
  /** 1h-v: Net trade-in allowance */
  tradeInNet: number;
  /** 1h-vi: Manufacturer rebate */
  manufacturerRebate: number;
  /** 1b–1g: All dealer fees. Category 'mandatory' surcharges add to cap cost;
   *  fees matched by FILING_FEE_KEYWORDS are deducted from cap cost instead. */
  fees: FeeItem[];

  // Section 1j — Residual
  /** Residual value in absolute dollars */
  residualValue: number;

  // Section 2 — Term
  leaseTermMonths: number;
  frequency: PaymentFrequency;

  // Section 3 — Rate
  /** Annual Percentage Rate, e.g. 4.99 for 4.99% */
  interestRate: number;

  // Section 4 — Due at signing
  securityDeposit: number;

  /** AMVIC all-in price check (AB only). Omit or set undefined to skip. */
  advertisedPrice?: number;
}

export interface LeaseResult {
  // Section 1
  /** vehiclePrice + surcharge fees (before adjustments) */
  grossCapCost: number;
  /** 1i: Net cap cost after down payment, trade-in, rebates, and filing fees */
  netCapCost: number;
  residualValue: number;
  /** 1k = netCapCost − residualValue */
  totalToAmortize: number;
  taxRate: number;

  // Section 2
  /** totalToAmortize / leaseTermMonths */
  depreciationPerMonth: number;
  /** APR / 2400 */
  moneyFactor: number;
  /** (netCapCost + residualValue) × moneyFactor */
  financeChargePerMonth: number;
  /** depreciationPerMonth + financeChargePerMonth */
  baseMonthlyPayment: number;
  /** baseMonthlyPayment × taxRate */
  taxOnMonthly: number;
  /** baseMonthlyPayment + taxOnMonthly */
  periodicPayment: number;

  // Section 3
  /** Total finance charges over the full term */
  leaseCharges: number;
  /** Number of payment periods (months or bi-weekly count) */
  totalPayments: number;

  // Section 4
  /** Total due at signing (4l) */
  totalDueAtSigning: number;

  // Section 5
  /** periodicPayment × totalPayments */
  totalOfPayments: number;
  /** True total cost: totalOfPayments + dueAtSigning − firstPayment − securityDeposit */
  totalCostOfLease: number;
}

export interface FeeWarning {
  severity: 'red' | 'yellow' | 'green';
  title: string;
  detail: string;
  /** Ready-to-use dealer negotiation script for this warning */
  script?: string;
}

// ── Extensibility types ────────────────────────────────────────────────────

/**
 * Tax component information for a province/territory.
 * Exported from this module so TaxOverrides can reference it without circular imports.
 */
export interface TaxInfo {
  /** Display label, e.g. "HST", "GST+PST" */
  label: string;
  /** Combined effective tax rate as a decimal, e.g. 0.13 */
  rate: number;
  /**
   * When true, the PST portion applies to the full vehicle price without the
   * trade-in offset. Only true for BC, MB, and SK.
   */
  pstOnFullPrice?: true;
  /** PST-only rate used when pstOnFullPrice is true (e.g. 0.07 for BC) */
  pstRate?: number;
}

/** Override one or more provincial tax rates without replacing the full table.
 *  Spread PROVINCE_TAX and override only the provinces that changed:
 *  @example
 *  const myRates: TaxOverrides = { SK: { label: 'GST+PST', rate: 0.11 } };
 */
export type TaxOverrides = Partial<Record<Province, TaxInfo>>;

/** Options to customise fee-analysis thresholds and keyword lists.
 *  All fields are optional — unset fields fall back to built-in defaults.
 *  @example
 *  analyzeInput(input, {
 *    ppsa:    { yellowThreshold: 50, redThreshold: 120 },
 *    adminFee: { yellowThreshold: 600, redThreshold: 1000 },
 *    extraRedFlagKeywords: ['rustproofing', 'undercoating'],
 *    extraNegotiableKeywords: ['processing charge'],
 *  });
 */
export interface FeeAnalysisOptions {
  ppsa?: {
    /** Warn yellow above this amount (default: 40) */
    yellowThreshold?: number;
    /** Warn red above this amount (default: 100) */
    redThreshold?: number;
  };
  adminFee?: {
    /** Warn yellow at or above this amount (default: 499) */
    yellowThreshold?: number;
    /** Warn red above this amount (default: 900) */
    redThreshold?: number;
  };
  /** Additional fee name substrings to classify as 'watchout' */
  extraRedFlagKeywords?: string[];
  /** Additional fee name substrings to classify as 'negotiable' */
  extraNegotiableKeywords?: string[];
}
