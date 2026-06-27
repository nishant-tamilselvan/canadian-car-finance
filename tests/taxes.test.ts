import { describe, it, expect } from 'vitest';
import {
  computeFinancedAmount,
  PROVINCE_TAX,
  PROVINCE_NAMES,
} from '../src/index.js';

describe('PROVINCE_TAX', () => {
  it('has all 13 provinces/territories', () => {
    const provinces = Object.keys(PROVINCE_TAX);
    expect(provinces).toHaveLength(13);
    expect(provinces).toContain('AB');
    expect(provinces).toContain('QC');
    expect(provinces).toContain('YT');
  });

  it('has correct rates for known provinces', () => {
    expect(PROVINCE_TAX.AB.rate).toBe(0.05);
    expect(PROVINCE_TAX.ON.rate).toBe(0.13);
    expect(PROVINCE_TAX.QC.rate).toBeCloseTo(0.14975);
    expect(PROVINCE_TAX.NB.rate).toBe(0.15);
    expect(PROVINCE_TAX.BC.rate).toBe(0.12);
  });

  it('marks BC, MB, SK as pstOnFullPrice', () => {
    expect(PROVINCE_TAX.BC.pstOnFullPrice).toBe(true);
    expect(PROVINCE_TAX.MB.pstOnFullPrice).toBe(true);
    expect(PROVINCE_TAX.SK.pstOnFullPrice).toBe(true);
    expect(PROVINCE_TAX.AB.pstOnFullPrice).toBeUndefined();
    expect(PROVINCE_TAX.ON.pstOnFullPrice).toBeUndefined();
  });
});

describe('PROVINCE_NAMES', () => {
  it('has a display name for every province', () => {
    expect(Object.keys(PROVINCE_NAMES)).toHaveLength(13);
    expect(PROVINCE_NAMES.AB).toBe('Alberta');
    expect(PROVINCE_NAMES.ON).toBe('Ontario');
  });
});

describe('computeFinancedAmount — GST/HST provinces', () => {
  it('applies 5% GST on (price - trade-in) in Alberta', () => {
    const result = computeFinancedAmount(40_000, 'AB', 5_000, 0, 2_000);
    expect(result.taxRate).toBe(0.05);
    expect(result.taxAmount).toBeCloseTo(40_000 * 0.05); // 2,000
    // financedAmount = 40,000 + 2,000 + 2,000 - 5,000 = 39,000
    expect(result.financedAmount).toBeCloseTo(39_000);
  });

  it('applies 13% HST on (price - trade-in) in Ontario', () => {
    const result = computeFinancedAmount(30_000, 'ON', 0, 0, 0);
    expect(result.taxRate).toBe(0.13);
    expect(result.taxAmount).toBeCloseTo(30_000 * 0.13); // 3,900
    expect(result.financedAmount).toBeCloseTo(33_900);
  });

  it('offsets trade-in from taxable base in Ontario', () => {
    // tax applies to (30,000 - 10,000) = 20,000
    const result = computeFinancedAmount(30_000, 'ON', 0, 10_000, 0);
    expect(result.taxAmount).toBeCloseTo(20_000 * 0.13); // 2,600
    // financedAmount = 30,000 + 2,600 - 10,000 = 22,600
    expect(result.financedAmount).toBeCloseTo(22_600);
  });

  it('applies GST+QST at ~14.975% in Quebec', () => {
    const result = computeFinancedAmount(25_000, 'QC', 0, 0, 0);
    expect(result.taxRate).toBeCloseTo(0.14975);
    expect(result.taxAmount).toBeCloseTo(25_000 * 0.14975);
  });
});

describe('computeFinancedAmount — split GST+PST provinces (BC, MB, SK)', () => {
  it('BC: GST on (price-trade-in) + PST on full price', () => {
    // $30,000 vehicle, $5,000 trade-in, BC (GST 5%, PST 7%)
    // GST = (30,000 - 5,000) * 0.05 = 1,250
    // PST = 30,000 * 0.07 = 2,100
    // tax = 3,350
    const result = computeFinancedAmount(30_000, 'BC', 0, 5_000, 0);
    const expectedGST = 25_000 * 0.05;  // 1,250
    const expectedPST = 30_000 * 0.07;  // 2,100
    expect(result.taxAmount).toBeCloseTo(expectedGST + expectedPST, 2); // 3,350
    // financedAmount = 30,000 + 3,350 - 5,000 = 28,350
    expect(result.financedAmount).toBeCloseTo(28_350, 0);
  });

  it('SK: GST on (price-trade-in) + PST on full price', () => {
    // SK: GST 5%, PST 6%
    // GST = (20,000 - 5,000) * 0.05 = 750
    // PST = 20,000 * 0.06 = 1,200
    const result = computeFinancedAmount(20_000, 'SK', 0, 5_000, 0);
    const expectedGST = 15_000 * 0.05;  // 750
    const expectedPST = 20_000 * 0.06;  // 1,200
    expect(result.taxAmount).toBeCloseTo(expectedGST + expectedPST, 2); // 1,950
  });

  it('BC with zero trade-in: both GST and PST on full price', () => {
    const result = computeFinancedAmount(40_000, 'BC', 0, 0, 0);
    // GST = 40,000 * 0.05 = 2,000; PST = 40,000 * 0.07 = 2,800 → total 4,800
    expect(result.taxAmount).toBeCloseTo(40_000 * 0.12, 2);
  });
});

describe('computeFinancedAmount — edge cases', () => {
  it('clamps financedAmount to 0 when trade-in exceeds vehicle price', () => {
    const result = computeFinancedAmount(20_000, 'AB', 0, 25_000, 0);
    expect(result.taxAmount).toBe(0);
    expect(result.financedAmount).toBe(0);
  });

  it('TaxOverrides replaces a specific province rate', () => {
    // Override AB from 5% to 6%
    const result = computeFinancedAmount(40_000, 'AB', 0, 0, 0, { AB: { label: 'GST', rate: 0.06 } });
    expect(result.taxAmount).toBeCloseTo(40_000 * 0.06);
  });

  it('TaxOverrides does not affect other provinces', () => {
    const normal = computeFinancedAmount(30_000, 'ON', 0, 0, 0);
    const withOverride = computeFinancedAmount(30_000, 'ON', 0, 0, 0, { AB: { label: 'GST', rate: 0.06 } });
    expect(withOverride.taxAmount).toBeCloseTo(normal.taxAmount);
  });
});

