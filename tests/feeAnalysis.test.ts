import { describe, it, expect } from 'vitest';
import {
  suggestCategory,
  analyzeInput,
  AB_DEFAULT_FEES,
  QUICK_ADD_PRESETS,
  DEFAULT_RED_FLAG_KEYWORDS,
  DEFAULT_NEGOTIABLE_KEYWORDS,
  DEFAULT_PPSA_THRESHOLDS,
  DEFAULT_ADMIN_FEE_THRESHOLDS,
} from '../src/index.js';
import type { LoanInput } from '../src/index.js';

function makeInput(overrides: Partial<LoanInput> = {}): LoanInput {
  return {
    vehiclePrice: 40_000,
    province: 'AB',
    downPayment: 5_000,
    tradeInValue: 0,
    fees: [],
    interestRate: 5.99,
    termMonths: 60,
    frequency: 'monthly',
    ...overrides,
  };
}

// ── Exported constants ────────────────────────────────────────────────────

describe('exported threshold constants', () => {
  it('DEFAULT_PPSA_THRESHOLDS has expected defaults', () => {
    expect(DEFAULT_PPSA_THRESHOLDS.yellowThreshold).toBe(40);
    expect(DEFAULT_PPSA_THRESHOLDS.redThreshold).toBe(100);
  });

  it('DEFAULT_ADMIN_FEE_THRESHOLDS has expected defaults', () => {
    expect(DEFAULT_ADMIN_FEE_THRESHOLDS.yellowThreshold).toBe(499);
    expect(DEFAULT_ADMIN_FEE_THRESHOLDS.redThreshold).toBe(900);
  });

  it('DEFAULT_RED_FLAG_KEYWORDS includes nitrogen and etching', () => {
    expect(DEFAULT_RED_FLAG_KEYWORDS).toContain('nitrogen');
    expect(DEFAULT_RED_FLAG_KEYWORDS).toContain('etching');
  });

  it('DEFAULT_NEGOTIABLE_KEYWORDS includes admin and doc fee', () => {
    expect(DEFAULT_NEGOTIABLE_KEYWORDS).toContain('admin');
    expect(DEFAULT_NEGOTIABLE_KEYWORDS).toContain('doc fee');
  });
});

// ── suggestCategory ────────────────────────────────────────────────────────

describe('suggestCategory — built-in keywords', () => {
  it('classifies nitrogen as watchout', () => expect(suggestCategory('Nitrogen Tires')).toBe('watchout'));
  it('classifies etching as watchout',  () => expect(suggestCategory('Window Etching')).toBe('watchout'));
  it('classifies protection as watchout', () => expect(suggestCategory('Paint Protection Package')).toBe('watchout'));
  it('classifies credit insurance as watchout', () => expect(suggestCategory('Credit Insurance')).toBe('watchout'));
  it('classifies admin as negotiable',  () => expect(suggestCategory('Admin Fee')).toBe('negotiable'));
  it('classifies doc fee as negotiable', () => expect(suggestCategory('Doc Fee')).toBe('negotiable'));
  it('classifies freight as mandatory', () => expect(suggestCategory('Freight + PDI')).toBe('mandatory'));
  it('classifies empty string as mandatory', () => expect(suggestCategory('')).toBe('mandatory'));
});

describe('suggestCategory — extensibility', () => {
  it('extra red-flag keyword classifies matching fee as watchout', () => {
    expect(suggestCategory('Rustproofing Service', { extraRedFlagKeywords: ['rustproofing'] })).toBe('watchout');
  });

  it('extra negotiable keyword classifies matching fee as negotiable', () => {
    expect(suggestCategory('Processing Charge', { extraNegotiableKeywords: ['processing charge'] })).toBe('negotiable');
  });

  it('extra keywords do not affect non-matching fees', () => {
    expect(suggestCategory('Freight + PDI', { extraRedFlagKeywords: ['rustproofing'] })).toBe('mandatory');
  });
});

// ── AB_DEFAULT_FEES / QUICK_ADD_PRESETS ───────────────────────────────────

describe('AB_DEFAULT_FEES', () => {
  it('contains expected AB fees', () => {
    const names = AB_DEFAULT_FEES.map(f => f.name);
    expect(names).toContain('Freight + PDI');
    expect(names).toContain('PPSA / Lien Registration');
    expect(names).toContain('AMVIC Levy');
  });

  it('has no id field (omitted in the type)', () => {
    for (const fee of AB_DEFAULT_FEES) {
      expect((fee as Record<string, unknown>)['id']).toBeUndefined();
    }
  });
});

describe('QUICK_ADD_PRESETS', () => {
  it('contains all three categories', () => {
    const categories = new Set(QUICK_ADD_PRESETS.map(f => f.category));
    expect(categories.has('mandatory')).toBe(true);
    expect(categories.has('negotiable')).toBe(true);
    expect(categories.has('watchout')).toBe(true);
  });
});

// ── analyzeInput — AMVIC ──────────────────────────────────────────────────

describe('analyzeInput — AMVIC all-in pricing', () => {
  it('adds green AMVIC info warning in Alberta', () => {
    const warnings = analyzeInput(makeInput({ province: 'AB' }));
    expect(warnings.some(w => w.severity === 'green' && w.title.includes('AMVIC'))).toBe(true);
  });

  it('adds red violation when fees push total above advertised price in AB', () => {
    const warnings = analyzeInput(makeInput({
      province: 'AB',
      vehiclePrice: 40_000,
      advertisedPrice: 40_000,
      fees: [{ name: 'Freight + PDI', amount: 2_000, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.includes('AMVIC Violation'))).toBe(true);
  });

  it('no violation when total is within advertised price', () => {
    const warnings = analyzeInput(makeInput({
      province: 'AB',
      vehiclePrice: 38_000,
      advertisedPrice: 42_000,
      fees: [{ name: 'Freight + PDI', amount: 2_000, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.title.includes('AMVIC Violation'))).toBe(false);
  });

  it('no AMVIC warnings outside Alberta', () => {
    const warnings = analyzeInput(makeInput({ province: 'ON' }));
    expect(warnings.some(w => w.title.includes('AMVIC'))).toBe(false);
  });

  it('advertisedPrice undefined does not trigger violation check', () => {
    const warnings = analyzeInput(makeInput({ province: 'AB', advertisedPrice: undefined }));
    expect(warnings.some(w => w.title.includes('AMVIC Violation'))).toBe(false);
  });
});

// ── analyzeInput — PPSA ───────────────────────────────────────────────────

describe('analyzeInput — PPSA thresholds', () => {
  it('red warning when PPSA > default red threshold (100)', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'PPSA / Lien Registration', amount: 150, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.includes('PPSA'))).toBe(true);
  });

  it('yellow warning when PPSA between yellow and red thresholds', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'PPSA', amount: 60, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.severity === 'yellow' && w.title.includes('PPSA'))).toBe(true);
  });

  it('no warning for reasonable PPSA ($25)', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'PPSA / Lien Registration', amount: 25, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.title.includes('PPSA'))).toBe(false);
  });

  it('custom redThreshold via FeeAnalysisOptions', () => {
    // Default red is >100; override to >50
    const warnings = analyzeInput(
      makeInput({ fees: [{ name: 'PPSA', amount: 70, category: 'mandatory' }] }),
      { ppsa: { redThreshold: 50 } },
    );
    expect(warnings.some(w => w.severity === 'red' && w.title.includes('PPSA'))).toBe(true);
  });

  it('PPSA warning text does not mention "Alberta" (generic for all provinces)', () => {
    const warnings = analyzeInput(makeInput({
      province: 'ON',
      fees: [{ name: 'PPSA', amount: 150, category: 'mandatory' }],
    }));
    const ppsaWarning = warnings.find(w => w.title.includes('PPSA'));
    expect(ppsaWarning?.detail).not.toContain('Alberta');
  });
});

// ── analyzeInput — Admin fee ──────────────────────────────────────────────

describe('analyzeInput — admin fee thresholds', () => {
  it('red warning when admin > 900', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Admin Fee', amount: 999, category: 'negotiable' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.includes('Admin'))).toBe(true);
  });

  it('yellow warning when admin >= 499 and <= 900', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Admin Fee', amount: 499, category: 'negotiable' }],
    }));
    expect(warnings.some(w => w.severity === 'yellow' && w.title.includes('Admin'))).toBe(true);
  });

  it('no warning for admin fee below 499', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Admin Fee', amount: 300, category: 'negotiable' }],
    }));
    expect(warnings.some(w => w.title.includes('Admin'))).toBe(false);
  });

  it('custom yellowThreshold via FeeAnalysisOptions', () => {
    const warnings = analyzeInput(
      makeInput({ fees: [{ name: 'Admin Fee', amount: 700, category: 'negotiable' }] }),
      { adminFee: { yellowThreshold: 650 } },
    );
    expect(warnings.some(w => w.severity === 'yellow' && w.title.includes('Admin'))).toBe(true);
  });

  it('"doc" alone does not trigger admin fee warning (too broad)', () => {
    // "doc" substring check was replaced with "doc fee"
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Doctor Inspection', amount: 600, category: 'mandatory' }],
    }));
    expect(warnings.some(w => w.title.includes('Admin'))).toBe(false);
  });
});

// ── analyzeInput — other fee checks ──────────────────────────────────────

describe('analyzeInput — predatory fee checks', () => {
  it('flags nitrogen tires as red', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Nitrogen Tires', amount: 300, category: 'watchout' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.toLowerCase().includes('nitrogen'))).toBe(true);
  });

  it('flags window etching as red', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Window Etching', amount: 400, category: 'watchout' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.toLowerCase().includes('etch'))).toBe(true);
  });

  it('flags protection package as red', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'Alberta Protection Package', amount: 2_500, category: 'watchout' }],
    }));
    expect(warnings.some(w => w.severity === 'red' && w.title.toLowerCase().includes('protection'))).toBe(true);
  });

  it('red warnings have negotiation scripts', () => {
    const warnings = analyzeInput(makeInput({
      fees: [{ name: 'PPSA', amount: 150, category: 'mandatory' }],
    }));
    const red = warnings.filter(w => w.severity === 'red');
    expect(red.length).toBeGreaterThan(0);
    expect(red.every(w => typeof w.script === 'string' && w.script.length > 0)).toBe(true);
  });
});

// ── analyzeInput — extensibility ─────────────────────────────────────────

describe('analyzeInput — FeeAnalysisOptions extensibility', () => {
  it('extraRedFlagKeywords flags a custom fee as red', () => {
    const warnings = analyzeInput(
      makeInput({ fees: [{ name: 'Rustproofing Service', amount: 600, category: 'mandatory' }] }),
      { extraRedFlagKeywords: ['rustproofing'] },
    );
    expect(warnings.some(w => w.severity === 'red')).toBe(true);
  });

  it('warnings are sorted red → yellow → green', () => {
    const warnings = analyzeInput(makeInput({
      province: 'AB',
      fees: [
        { name: 'PPSA', amount: 150, category: 'mandatory' },
        { name: 'Admin Fee', amount: 600, category: 'negotiable' },
      ],
    }));
    const severities = warnings.map(w => w.severity);
    const firstYellow = severities.indexOf('yellow');
    const firstGreen  = severities.indexOf('green');
    const lastRed     = severities.lastIndexOf('red');
    if (firstYellow !== -1 && lastRed !== -1) expect(lastRed).toBeLessThan(firstYellow);
    if (firstGreen  !== -1 && firstYellow !== -1) expect(firstYellow).toBeLessThan(firstGreen);
  });
});

// ── analyzeInput — LeaseInput compatibility ───────────────────────────────

describe('analyzeInput — accepts LeaseInput', () => {
  it('works with a lease input object (fees + province + vehiclePrice)', () => {
    const leaseInput = {
      vehiclePrice: 40_000,
      province: 'AB' as const,
      fees: [{ name: 'Nitrogen Tires', amount: 300, category: 'watchout' as const }],
    };
    expect(() => analyzeInput(leaseInput)).not.toThrow();
    const warnings = analyzeInput(leaseInput);
    expect(warnings.some(w => w.title.toLowerCase().includes('nitrogen'))).toBe(true);
  });
});

