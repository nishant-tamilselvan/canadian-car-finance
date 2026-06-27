import type { Province, TaxInfo, TaxOverrides } from './types/index.js';

/** Re-exported for consumers who import directly from taxes.ts */
export type { TaxInfo } from './types/index.js';

export const PROVINCE_TAX: Record<Province, TaxInfo> = {
  AB: { label: 'GST',     rate: 0.05    },
  // BC: GST 5% on (price - trade-in), PST 7% on full price
  BC: { label: 'GST+PST', rate: 0.12,   pstOnFullPrice: true, pstRate: 0.07 },
  // MB: GST 5% on (price - trade-in), PST 7% on full price
  MB: { label: 'GST+PST', rate: 0.12,   pstOnFullPrice: true, pstRate: 0.07 },
  NB: { label: 'HST',     rate: 0.15    },
  NL: { label: 'HST',     rate: 0.15    },
  NS: { label: 'HST',     rate: 0.15    },
  NT: { label: 'GST',     rate: 0.05    },
  NU: { label: 'GST',     rate: 0.05    },
  ON: { label: 'HST',     rate: 0.13    },
  PE: { label: 'HST',     rate: 0.15    },
  QC: { label: 'GST+QST', rate: 0.14975 },
  // SK: GST 5% on (price - trade-in), PST 6% on full price
  SK: { label: 'GST+PST', rate: 0.11,   pstOnFullPrice: true, pstRate: 0.06 },
  YT: { label: 'GST',     rate: 0.05    },
};

export const PROVINCE_NAMES: Record<Province, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland & Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

/**
 * Computes the financed amount and tax for a vehicle purchase.
 *
 * For HST/GST-only provinces (AB, ON, QC, Atlantic, territories):
 *   tax = (vehiclePrice − tradeIn) × rate
 *
 * For split GST+PST provinces (BC, MB, SK):
 *   GST = (vehiclePrice − tradeIn) × 0.05  ← trade-in reduces GST base
 *   PST = vehiclePrice × pstRate            ← PST applies to full price
 *   tax = GST + PST
 *
 * financedAmount = vehiclePrice + tax + totalFees − downPayment − tradeIn
 * financedAmount is clamped to 0 (never negative).
 *
 * @param vehiclePrice  Pre-tax selling price of the vehicle
 * @param province      Canadian province/territory code
 * @param downPayment   Cash down payment amount
 * @param tradeInValue  Net trade-in allowance
 * @param totalFees     Sum of all dealer fees
 * @param taxOverrides  Optional rate overrides — spread PROVINCE_TAX and change only what changed
 */
export function computeFinancedAmount(
  vehiclePrice: number,
  province: Province,
  downPayment: number,
  tradeInValue: number,
  totalFees: number,
  taxOverrides?: TaxOverrides,
): { financedAmount: number; taxAmount: number; taxRate: number } {
  const taxTable = taxOverrides
    ? { ...PROVINCE_TAX, ...taxOverrides }
    : PROVINCE_TAX;

  const info = taxTable[province];
  const taxRate = info.rate;

  let taxAmount: number;
  if (info.pstOnFullPrice && info.pstRate !== undefined) {
    const gstRate = 0.05;
    const gstBase = Math.max(0, vehiclePrice - tradeInValue);
    const gst = gstBase * gstRate;
    const pst = vehiclePrice * info.pstRate;
    taxAmount = gst + pst;
  } else {
    const taxableBase = Math.max(0, vehiclePrice - tradeInValue);
    taxAmount = taxableBase * taxRate;
  }

  const financedAmount =
    vehiclePrice + taxAmount + totalFees - downPayment - tradeInValue;

  return {
    financedAmount: Math.max(0, financedAmount),
    taxAmount,
    taxRate,
  };
}
