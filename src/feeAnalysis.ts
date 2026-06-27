import type { FeeItem, FeeWarning, LoanInput, LeaseInput, FeeAnalysisOptions } from './types/index.js';

/** Default keywords that classify a fee as 'watchout'. Extend via FeeAnalysisOptions. */
export const DEFAULT_RED_FLAG_KEYWORDS: readonly string[] = [
  'nitrogen', 'etching', 'window etch', 'security etch',
  'protection package', 'protection group', 'winter group', 'alberta protection',
  'paint protection', 'fabric protection', 'rust protection',
  'life insurance', 'disability insurance', 'credit insurance',
  'loan insurance', 'loan protection', 'health insurance',
];

/** Default keywords that classify a fee as 'negotiable'. Extend via FeeAnalysisOptions. */
export const DEFAULT_NEGOTIABLE_KEYWORDS: readonly string[] = [
  'admin', 'doc fee', 'documentation', 'arrangement', 'finance placement',
  'processing fee', 'dealer fee',
];

/** Default PPSA warning thresholds (in CAD). Override via FeeAnalysisOptions. */
export const DEFAULT_PPSA_THRESHOLDS = {
  yellowThreshold: 40,
  redThreshold: 100,
} as const;

/** Default admin fee warning thresholds (in CAD). Override via FeeAnalysisOptions. */
export const DEFAULT_ADMIN_FEE_THRESHOLDS = {
  yellowThreshold: 499,
  redThreshold: 900,
} as const;

/**
 * Suggests a fee category based on the fee name using keyword matching.
 * Checks against built-in lists and any extras passed in options.
 *
 * @param name     Fee name entered by the user
 * @param options  Optional overrides — extra keywords merged with defaults
 * @returns        'watchout' | 'negotiable' | 'mandatory'
 */
export function suggestCategory(
  name: string,
  options?: Pick<FeeAnalysisOptions, 'extraRedFlagKeywords' | 'extraNegotiableKeywords'>,
): FeeItem['category'] {
  const lower = name.toLowerCase();
  const redFlags = options?.extraRedFlagKeywords
    ? [...DEFAULT_RED_FLAG_KEYWORDS, ...options.extraRedFlagKeywords]
    : DEFAULT_RED_FLAG_KEYWORDS;
  const negotiable = options?.extraNegotiableKeywords
    ? [...DEFAULT_NEGOTIABLE_KEYWORDS, ...options.extraNegotiableKeywords]
    : DEFAULT_NEGOTIABLE_KEYWORDS;

  if (redFlags.some(k => lower.includes(k))) return 'watchout';
  if (negotiable.some(k => lower.includes(k))) return 'negotiable';
  return 'mandatory';
}

/** AB default fees pre-populated on province switch */
export const AB_DEFAULT_FEES: Omit<FeeItem, 'id'>[] = [
  { name: 'Freight + PDI',              amount: 2200, category: 'mandatory'  },
  { name: 'Federal AC Excise Tax',      amount: 100,  category: 'mandatory'  },
  { name: 'Tire Recycling Levy',        amount: 20,   category: 'mandatory'  },
  { name: 'AMVIC Levy',                 amount: 10,   category: 'mandatory'  },
  { name: 'PPSA / Lien Registration',   amount: 25,   category: 'mandatory'  },
  { name: 'Admin / Doc Fee',            amount: 0,    category: 'negotiable' },
];

/** Quick-add fee presets for all provinces */
export const QUICK_ADD_PRESETS: Omit<FeeItem, 'id'>[] = [
  { name: 'Freight + PDI',              amount: 2200, category: 'mandatory'  },
  { name: 'Federal AC Excise Tax',      amount: 100,  category: 'mandatory'  },
  { name: 'Tire Recycling Levy',        amount: 20,   category: 'mandatory'  },
  { name: 'AMVIC Levy',                 amount: 10,   category: 'mandatory'  },
  { name: 'PPSA / Lien Registration',   amount: 25,   category: 'mandatory'  },
  { name: 'Admin / Doc Fee',            amount: 499,  category: 'negotiable' },
  { name: 'Finance Arrangement Fee',    amount: 300,  category: 'negotiable' },
  { name: 'Nitrogen Tires',             amount: 300,  category: 'watchout'   },
  { name: 'Window / Security Etching',  amount: 400,  category: 'watchout'   },
  { name: 'Protection Package',         amount: 2500, category: 'watchout'   },
  { name: 'Credit / Life Insurance',    amount: 0,    category: 'watchout'   },
];

/** Shared input shape — LoanInput and LeaseInput both have these fields */
type AnalysisInput = Pick<LoanInput | LeaseInput, 'province' | 'fees' | 'advertisedPrice'> & {
  vehiclePrice: number;
};

/**
 * Analyses a loan or lease scenario for predatory dealer fees, regulatory violations,
 * and negotiation opportunities. Returns an array of warnings sorted by severity.
 *
 * Works with both `LoanInput` and `LeaseInput`.
 *
 * @param input    Loan or lease input containing province, fees, vehiclePrice
 * @param options  Optional threshold and keyword overrides
 * @returns        Array of FeeWarning sorted red → yellow → green
 *
 * @example
 * const warnings = analyzeInput(loanInput, {
 *   ppsa: { redThreshold: 120 },
 *   adminFee: { yellowThreshold: 600 },
 *   extraRedFlagKeywords: ['rustproofing'],
 * });
 */
export function analyzeInput(
  input: AnalysisInput,
  options?: FeeAnalysisOptions,
): FeeWarning[] {
  const warnings: FeeWarning[] = [];
  const isAB = input.province === 'AB';

  const ppsaYellow = options?.ppsa?.yellowThreshold  ?? DEFAULT_PPSA_THRESHOLDS.yellowThreshold;
  const ppsaRed    = options?.ppsa?.redThreshold     ?? DEFAULT_PPSA_THRESHOLDS.redThreshold;
  const adminYellow = options?.adminFee?.yellowThreshold ?? DEFAULT_ADMIN_FEE_THRESHOLDS.yellowThreshold;
  const adminRed    = options?.adminFee?.redThreshold    ?? DEFAULT_ADMIN_FEE_THRESHOLDS.redThreshold;

  // ── AB: AMVIC all-in pricing ───────────────────────────────────────────
  if (isAB) {
    warnings.push({
      severity: 'green',
      title: 'AMVIC All-In Pricing Law (Alberta)',
      detail:
        'Under AMVIC regulations, the advertised price must include ALL dealer fees. ' +
        'Only GST and financing costs may be added on top. If you took a screenshot of ' +
        'the online listing, the dealer cannot legally add surprise fees.',
    });
  }

  if (isAB && input.advertisedPrice != null && input.advertisedPrice > 0) {
    const feesOnlyTotal =
      input.fees.reduce((s, f) => s + f.amount, 0) -
      input.fees
        .filter(f => f.name.toLowerCase().includes('gst') || f.name.toLowerCase().includes('hst'))
        .reduce((s, f) => s + f.amount, 0);
    const preTaxTotal = input.vehiclePrice + feesOnlyTotal;

    if (preTaxTotal > input.advertisedPrice + 0.01) {
      warnings.push({
        severity: 'red',
        title: 'AMVIC Violation: Fees Exceed Advertised Price',
        detail:
          `The dealer's advertised price was $${input.advertisedPrice.toLocaleString('en-CA')} ` +
          `but the vehicle price + fees (before GST) total ` +
          `$${preTaxTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}. ` +
          'This may violate AMVIC All-In Pricing rules.',
        script:
          '"I have a screenshot of your listing at $' +
          input.advertisedPrice.toLocaleString('en-CA') +
          '. Under AMVIC All-In Pricing, you cannot add fees that weren\'t in the advertised ' +
          'price. I need this corrected before I sign anything."',
      });
    }
  }

  // ── Per-fee rule checks ───────────────────────────────────────────────────
  for (const fee of input.fees) {
    const lower = fee.name.toLowerCase();
    const amt = fee.amount;

    // PPSA / Lien Registration
    if (lower.includes('ppsa') || lower.includes('lien registration')) {
      if (amt > ppsaRed) {
        warnings.push({
          severity: 'red',
          title: `PPSA Fee Heavily Inflated ($${amt})`,
          detail:
            `The actual government PPSA / personal property registry fee is typically $20–$40. ` +
            `You are being charged $${amt} — the dealer is pocketing the difference as profit.`,
          script:
            '"The actual government PPSA registration fee is typically $20–$40. ' +
            'I\'d like this reduced to the actual registry cost. Can you adjust that now?"',
        });
      } else if (amt > ppsaYellow) {
        warnings.push({
          severity: 'yellow',
          title: `PPSA Fee Above Typical ($${amt})`,
          detail:
            `The government PPSA registration fee is typically $20–$40. ` +
            `Anything above $${ppsaYellow} suggests a markup.`,
          script:
            '"The PPSA registration fee is typically $20–$40. ' +
            'Can you bring this down to the actual cost?"',
        });
      }
    }

    // Admin / Doc fee — using >= for yellowThreshold (inclusive)
    if (lower.includes('admin') || lower.includes('doc fee') || lower.includes('documentation')) {
      if (amt > adminRed) {
        warnings.push({
          severity: 'red',
          title: `Admin Fee Very High ($${amt})`,
          detail:
            `Admin fees above $${adminRed} are at the top end of the market range. ` +
            'This is pure dealer profit for printing paperwork. Push back firmly.',
          script:
            `"Your admin fee of $${amt} is unusually high. ` +
            `I'd like the vehicle price reduced by $${amt} to offset this fee, or remove it entirely."`,
        });
      } else if (amt >= adminYellow) {
        warnings.push({
          severity: 'yellow',
          title: `Admin Fee Negotiable ($${amt})`,
          detail:
            'Documentation fees are 100% dealer profit. ' +
            'You can negotiate this down or ask for the vehicle price to be reduced by the same amount.',
          script:
            `"I'm fine with your sales price, but I'd like you to reduce the vehicle price ` +
            `by $${amt} to offset the admin fee, or waive it entirely."`,
        });
      }
    }

    // Finance placement / arrangement fee
    if (lower.includes('arrangement') || lower.includes('placement') || lower.includes('finance fee')) {
      if (amt > 0) {
        warnings.push({
          severity: 'yellow',
          title: `Finance Arrangement Fee ($${amt}) — Negotiable`,
          detail:
            'This fee for "setting up" your loan is entirely dealer-imposed. ' +
            'Many Tier-1 lenders (RBC, TD, Scotiabank) do not require it.',
          script:
            '"I\'d like the finance arrangement fee removed. Tier-1 lenders don\'t require this. ' +
            'If it can\'t be removed, please reduce the vehicle price accordingly."',
        });
      }
    }

    // Nitrogen tires
    if (lower.includes('nitrogen')) {
      warnings.push({
        severity: 'red',
        title: `Nitrogen Tires ($${amt}) — Low-Value Add-On`,
        detail:
          'Regular air is already 78% nitrogen. This fee offers no real-world benefit. ' +
          'DIY kits cost ~$20 online.',
        script: '"Please remove the nitrogen tire charge. I\'ll pass on that."',
      });
    }

    // Window / security etching
    if (lower.includes('etch') || lower.includes('etching')) {
      warnings.push({
        severity: 'red',
        title: `Window Etching ($${amt}) — Remove This`,
        detail:
          'A trace ID is glued to your windows. DIY kits are available online for ~$20. ' +
          'This is near-pure profit for the dealer.',
        script: '"Please remove the window etching charge. I don\'t want that service."',
      });
    }

    // Protection packages
    if (
      lower.includes('protection package') ||
      lower.includes('protection group') ||
      lower.includes('winter group') ||
      lower.includes('alberta protection') ||
      lower.includes('paint protection') ||
      lower.includes('fabric protection')
    ) {
      warnings.push({
        severity: 'red',
        title: `Protection Package ($${amt}) — May Be Forced Sale`,
        detail:
          'Dealers sometimes claim these are "mandatory" or "already installed." ' +
          'Under AMVIC rules, you cannot be forced to buy unadvertised accessories.',
        script:
          '"Under AMVIC regulations, I cannot be forced to purchase unadvertised accessories. ' +
          'Please remove this package from the bill of sale."',
      });
    }

    // Catch-all for extra red-flag keywords passed via options
    if (options?.extraRedFlagKeywords) {
      const matched = options.extraRedFlagKeywords.find(k => lower.includes(k));
      if (matched && !warnings.some(w => w.title.includes(fee.name))) {
        warnings.push({
          severity: 'red',
          title: `Flagged Fee: "${fee.name}" ($${amt})`,
          detail: `This fee matches a custom red-flag keyword ("${matched}"). Review carefully before signing.`,
        });
      }
    }

    // Credit / life / disability insurance (tied-selling)
    if (
      lower.includes('insurance') ||
      lower.includes('loan protection') ||
      lower.includes('credit protection') ||
      lower.includes('disability')
    ) {
      warnings.push({
        severity: 'red',
        title: `Possible Tied-Selling: "${fee.name}" ($${amt})`,
        detail:
          'It is illegal in Canada for a lender to condition your interest rate on purchasing ' +
          'their life or disability insurance (tied-selling). This product is voluntary.',
        script:
          '"I understand this insurance is optional and I\'m choosing to decline it. ' +
          'My interest rate cannot be conditional on purchasing this — that is tied-selling ' +
          'and illegal under the Bank Act."',
      });
    }
  }

  // ── Prepayment reminder (always shown) ────────────────────────────────────
  warnings.push({
    severity: 'green',
    title: 'Verify: Open Loan With No Prepayment Penalty',
    detail:
      'Ensure your retail finance agreement explicitly states the loan is open-ended with no ' +
      'prepayment penalties. This lets you make lump-sum payments or pay off early at no cost.',
  });

  // Sort: red first, then yellow, then green
  const order = { red: 0, yellow: 1, green: 2 };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}
