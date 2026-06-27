import { describe, it, expect } from 'vitest';
import { calculateLoan, formatCAD } from '../src/index.js';
import type { LoanInput } from '../src/index.js';

function makeInput(overrides: Partial<LoanInput> = {}): LoanInput {
  return {
    vehiclePrice: 40_000,
    province: 'AB',
    downPayment: 5_000,
    tradeInValue: 0,
    fees: [{ name: 'Freight + PDI', amount: 2_200, category: 'mandatory' }],
    interestRate: 6.99,
    termMonths: 60,
    frequency: 'monthly',
    ...overrides,
  };
}

describe('calculateLoan — monthly payments', () => {
  it('computes correct tax, financed amount, and payment structure for AB', () => {
    const result = calculateLoan(makeInput());
    expect(result.taxRate).toBe(0.05);
    expect(result.taxAmount).toBeCloseTo(2_000, 0);
    // financedAmount = 40,000 + 2,000 (tax) + 2,200 (fees) - 5,000 (down) = 39,200
    expect(result.financedAmount).toBeCloseTo(39_200, 0);
    // payment × periods = totalPaid
    expect(result.payment * result.totalPayments).toBeCloseTo(result.totalPaid, 1);
    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalCostOfOwnership).toBeCloseTo(result.totalCashPrice + result.totalInterest, 1);
  });

  it('returns principal/term payment when interestRate is 0%', () => {
    const result = calculateLoan(makeInput({ interestRate: 0 }));
    expect(result.payment).toBeCloseTo(result.financedAmount / 60, 0);
    expect(result.totalInterest).toBeCloseTo(0, 1);
  });

  it('higher APR → more interest', () => {
    const low  = calculateLoan(makeInput({ interestRate: 3.0 }));
    const high = calculateLoan(makeInput({ interestRate: 9.0 }));
    expect(high.totalInterest).toBeGreaterThan(low.totalInterest);
  });

  it('longer term → smaller payment, more interest', () => {
    const short = calculateLoan(makeInput({ termMonths: 36 }));
    const long  = calculateLoan(makeInput({ termMonths: 84 }));
    expect(long.payment).toBeLessThan(short.payment);
    expect(long.totalInterest).toBeGreaterThan(short.totalInterest);
  });

  it('accumulates fee categories in a single pass', () => {
    const result = calculateLoan(makeInput({
      fees: [
        { name: 'Freight',   amount: 2_000, category: 'mandatory'  },
        { name: 'Admin Fee', amount: 500,   category: 'negotiable' },
        { name: 'Nitrogen',  amount: 300,   category: 'watchout'   },
      ],
    }));
    expect(result.mandatoryFeesTotal).toBe(2_000);
    expect(result.negotiableFeesTotal).toBe(500);
    expect(result.watchoutFeesTotal).toBe(300);
    expect(result.totalFeesAmount).toBe(2_800);
  });
});

describe('calculateLoan — bi-weekly payments', () => {
  it('produces 130 payment periods for a 60-month term', () => {
    const result = calculateLoan(makeInput({ frequency: 'biweekly', termMonths: 60 }));
    expect(result.totalPayments).toBe(Math.round((60 / 12) * 26)); // 130
  });

  it('bi-weekly total paid is within 1% of monthly total paid', () => {
    const monthly  = calculateLoan(makeInput({ frequency: 'monthly'  }));
    const biweekly = calculateLoan(makeInput({ frequency: 'biweekly' }));
    const diff = Math.abs(monthly.totalPaid - biweekly.totalPaid) / monthly.totalPaid;
    expect(diff).toBeLessThan(0.01);
  });
});

describe('calculateLoan — edge cases / input validation', () => {
  it('termMonths = 0 returns 0 payment, 0 total paid, and 0 total payments', () => {
    const result = calculateLoan(makeInput({ termMonths: 0 }));
    expect(result.payment).toBe(0);
    expect(result.totalPayments).toBe(0);
    expect(result.totalPaid).toBe(0);
  });

  it('empty fees array does not throw', () => {
    expect(() => calculateLoan(makeInput({ fees: [] }))).not.toThrow();
  });

  it('very high APR (99%) does not throw', () => {
    expect(() => calculateLoan(makeInput({ interestRate: 99 }))).not.toThrow();
  });
});

describe('formatCAD', () => {
  it('formats typical amounts correctly', () => {
    expect(formatCAD(1234.56)).toBe('$1,234.56');
    expect(formatCAD(0)).toBe('$0.00');
    expect(formatCAD(1_000_000)).toBe('$1,000,000.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCAD(9.999)).toBe('$10.00');
    expect(formatCAD(0.001)).toBe('$0.00');
  });
});

