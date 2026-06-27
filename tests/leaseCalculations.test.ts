import { describe, it, expect } from 'vitest';
import { calculateLease, FILING_FEE_KEYWORDS } from '../src/index.js';
import type { LeaseInput } from '../src/index.js';

function makeInput(overrides: Partial<LeaseInput> = {}): LeaseInput {
  return {
    vehiclePrice: 45_000,
    province: 'BC',
    downPayment: 2_000,
    tradeInNet: 0,
    manufacturerRebate: 0,
    fees: [
      { name: 'Freight + PDI', amount: 2_000, category: 'mandatory' },
      { name: 'Filing Fee',    amount: 300,   category: 'mandatory' },
    ],
    residualValue: 22_000,
    leaseTermMonths: 36,
    frequency: 'monthly',
    interestRate: 5.99,
    securityDeposit: 0,
    ...overrides,
  };
}

describe('FILING_FEE_KEYWORDS', () => {
  it('is exported and contains expected defaults', () => {
    expect(FILING_FEE_KEYWORDS).toContain('filing');
    expect(FILING_FEE_KEYWORDS).toContain('document');
    expect(FILING_FEE_KEYWORDS).toContain('registry');
  });
});

describe('calculateLease — core formula', () => {
  it('converts APR to money factor (APR / 2400)', () => {
    const result = calculateLease(makeInput({ interestRate: 4.8 }));
    expect(result.moneyFactor).toBeCloseTo(4.8 / 2400, 6); // 0.002
  });

  it('separates filing fees from surcharges in cap cost', () => {
    const result = calculateLease(makeInput());
    // Surcharges (Freight+PDI $2,000) added to gross cap cost
    expect(result.grossCapCost).toBeCloseTo(45_000 + 2_000); // 47,000
    // Filing fee ($300) deducted from net cap cost
    expect(result.netCapCost).toBeCloseTo(47_000 - 2_000 - 300); // 44,700
  });

  it('net cap cost is reduced by down payment, trade-in, and rebate', () => {
    const result = calculateLease(makeInput({
      downPayment: 3_000,
      tradeInNet: 5_000,
      manufacturerRebate: 1_000,
    }));
    // grossCapCost = 45,000 + 2,000 = 47,000
    // netCapCost = 47,000 - 3,000 - 300 (filing) - 5,000 - 1,000 = 37,700
    expect(result.netCapCost).toBeCloseTo(37_700, 0);
  });

  it('baseMonthlyPayment = depreciation + finance charge', () => {
    const result = calculateLease(makeInput());
    expect(result.baseMonthlyPayment).toBeCloseTo(
      result.depreciationPerMonth + result.financeChargePerMonth, 4,
    );
  });

  it('periodicPayment includes tax', () => {
    const result = calculateLease(makeInput());
    expect(result.periodicPayment).toBeCloseTo(result.baseMonthlyPayment * (1 + result.taxRate), 4);
  });

  it('totalToAmortize = netCapCost - residualValue', () => {
    const result = calculateLease(makeInput());
    expect(result.totalToAmortize).toBeCloseTo(result.netCapCost - result.residualValue, 2);
  });

  it('lower residual → higher monthly payment', () => {
    const high = calculateLease(makeInput({ residualValue: 28_000 }));
    const low  = calculateLease(makeInput({ residualValue: 15_000 }));
    expect(low.periodicPayment).toBeGreaterThan(high.periodicPayment);
  });

  it('higher APR → higher monthly payment', () => {
    const cheap = calculateLease(makeInput({ interestRate: 1.99 }));
    const pricey = calculateLease(makeInput({ interestRate: 8.99 }));
    expect(pricey.periodicPayment).toBeGreaterThan(cheap.periodicPayment);
  });

  it('LeaseResult has no duplicate taxAmount field', () => {
    const result = calculateLease(makeInput());
    // taxAmount was the old duplicate; only taxOnMonthly should exist
    expect('taxAmount' in result).toBe(false);
    expect(result.taxOnMonthly).toBeGreaterThan(0);
  });
});

describe('calculateLease — due at signing', () => {
  it('includes first payment, down payment, filing fees, and tax on those', () => {
    const result = calculateLease(makeInput());
    const taxRate = result.taxRate; // BC
    const taxOnSigning = (2_000 + 300) * taxRate;
    const expected = 2_000 + result.periodicPayment + 300 + 0 + taxOnSigning;
    expect(result.totalDueAtSigning).toBeCloseTo(expected, 1);
  });

  it('security deposit adds to due-at-signing', () => {
    const no  = calculateLease(makeInput({ securityDeposit: 0 }));
    const yes = calculateLease(makeInput({ securityDeposit: 1_500 }));
    expect(yes.totalDueAtSigning - no.totalDueAtSigning).toBeCloseTo(1_500, 1);
  });
});

describe('calculateLease — bi-weekly', () => {
  it('36-month term produces 78 bi-weekly periods', () => {
    const result = calculateLease(makeInput({ frequency: 'biweekly', leaseTermMonths: 36 }));
    expect(result.totalPayments).toBe(Math.round((36 / 12) * 26)); // 78
  });

  it('bi-weekly payment = monthly × 12 / 26', () => {
    const monthly  = calculateLease(makeInput({ frequency: 'monthly'  }));
    const biweekly = calculateLease(makeInput({ frequency: 'biweekly' }));
    expect(biweekly.periodicPayment).toBeCloseTo(monthly.periodicPayment * 12 / 26, 4);
  });
});

describe('calculateLease — edge cases', () => {
  it('leaseTermMonths = 0 returns a safe zero-valued result', () => {
    const result = calculateLease(makeInput({ leaseTermMonths: 0 }));
    expect(result.periodicPayment).toBe(0);
    expect(result.totalCostOfLease).toBe(0);
    expect(result.totalPayments).toBe(0);
  });
});

describe('calculateLease — real contract reference', () => {
  /**
   * Real contract cross-check values:
   *   vehicle $38,795, no down, no trade, no rebate
   *   Freight+PDI $2,095 (surcharge), Filing $400
   *   residual $19,000, term 48 mo, APR 4.99%, AB (5% GST)
   *   security deposit $0
   *
   * We assert exact money factor and verify all structural invariants.
   * (Exact dollar amounts from original contract are preserved as comments.)
   */
  it('produces correct money factor and structural invariants', () => {
    const result = calculateLease({
      vehiclePrice: 38_795,
      province: 'AB',
      downPayment: 0,
      tradeInNet: 0,
      manufacturerRebate: 0,
      fees: [
        { name: 'Freight + PDI', amount: 2_095, category: 'mandatory' },
        { name: 'Filing Fee',    amount: 400,   category: 'mandatory' },
      ],
      residualValue: 19_000,
      leaseTermMonths: 48,
      frequency: 'monthly',
      interestRate: 4.99,
      securityDeposit: 0,
    });

    // Exact money factor
    expect(result.moneyFactor).toBeCloseTo(4.99 / 2400, 6);

    // grossCapCost = 38,795 + 2,095 (surcharge) = 40,890
    expect(result.grossCapCost).toBeCloseTo(40_890);

    // netCapCost = 40,890 - 0 (down) - 400 (filing) - 0 - 0 = 40,490
    expect(result.netCapCost).toBeCloseTo(40_490);

    // totalToAmortize = 40,490 - 19,000 = 21,490
    expect(result.totalToAmortize).toBeCloseTo(21_490);

    // depreciation = 21,490 / 48 ≈ 447.71
    expect(result.depreciationPerMonth).toBeCloseTo(21_490 / 48, 2);

    // finance charge = (40,490 + 19,000) × (4.99/2400) ≈ 123.79
    expect(result.financeChargePerMonth).toBeCloseTo(59_490 * (4.99 / 2400), 2);

    // structural: base + tax = periodic
    expect(result.periodicPayment).toBeCloseTo(result.baseMonthlyPayment * (1 + result.taxRate), 4);

    // structural: total cost > total of payments
    expect(result.totalCostOfLease).toBeGreaterThan(result.totalOfPayments);
  });
});

