# Canadian Car Finance

> The calculation engine for Canadian car financing. It keeps tax math accurate, surfaces dealer fees clearly, and exports extensible rules you can update without forking.

<p align="center">
  <img src="assets/banner.svg" alt="Canadian Car Finance banner" width="960" />
</p>

[![npm version](https://img.shields.io/npm/v/canadian-car-finance)](https://www.npmjs.com/package/canadian-car-finance)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/nishant-tamilselvan/canadian-car-finance/ci.yml?branch=main&label=tests)](https://github.com/nishant-tamilselvan/canadian-car-finance/actions/workflows/ci.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/nishant-tamilselvan/canadian-car-finance/ci.yml?branch=main&label=CI)](https://github.com/nishant-tamilselvan/canadian-car-finance/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Node >=18](https://img.shields.io/node/v/canadian-car-finance)](package.json)

Powers the live **[Car Expense Pro](https://car-expense-pro-production.up.railway.app/)** web app.

Designed for developers who need correct Canadian car finance and lease calculations without hidden assumptions.

See [CHANGELOG.md](CHANGELOG.md) for release notes and project history.

---

⚡ [Quickstart](#-quickstart) · 🧮 [API Reference](#-api-reference) · 🔧 [Extensibility](#-extensibility) · 🗺️ [Provincial Taxes](#️-provincial-tax-handling) · 📦 [Exported Constants](#-exported-constants) · 🛠 [Develop](#-development)

---

## Why it exists

Most Canadian car financing calculators on npm either ignore provincial tax split rules or silently use the wrong formula. Three problems compound:

- **BC, MB, and SK charge PST on the full vehicle price** — the trade-in does not reduce the PST base. Every calculator we checked (including major dealer sites) got this wrong and underquoted tax by hundreds of dollars.
- **Dealer fee rules change.** PPSA registration fees, admin fee caps, and AMVIC levy amounts are updated by regulators. Hard-coded thresholds become stale and there is no way to fix them without patching the library.
- **There is no open package that does all three**: loan amortization + lease formula + provincial taxes + fee analysis — with correct math and extensible constants.

This library is the corrected, extensible foundation. All tax rates, fee thresholds, and keyword lists are exported so you can update a single constant when the rules change, without waiting for a new package release.

---

## ⚡ Quickstart

```bash
npm install canadian-car-finance
```

Requires **Node.js ≥ 18**. Ships ESM, CommonJS, and `.d.ts` declarations.

### Loan (financing)

```typescript
import { calculateLoan, formatCAD } from 'canadian-car-finance';

const result = calculateLoan({
  vehiclePrice: 35_000,
  province: 'AB',
  downPayment: 5_000,
  tradeInValue: 0,
  fees: [
    { name: 'Freight + PDI',   amount: 2200, category: 'mandatory'  },
    { name: 'PPSA',            amount: 25,   category: 'mandatory'  },
    { name: 'Admin / Doc Fee', amount: 499,  category: 'negotiable' },
  ],
  interestRate: 5.99,   // APR %
  termMonths: 60,
  frequency: 'bi-weekly',
});

console.log(formatCAD(result.payment));       // "$742.16"
console.log(formatCAD(result.totalInterest)); // "$4,832.10"
```

### Lease

```typescript
import { calculateLease } from 'canadian-car-finance';

const result = calculateLease({
  vehiclePrice: 45_977,
  province: 'ON',
  downPayment: 3_825,
  tradeInNet: 0,
  manufacturerRebate: 0,
  fees: [{ name: 'Freight + PDI', amount: 2200, category: 'mandatory' }],
  residualValue: 32_797,
  leaseTermMonths: 24,
  interestRate: 1.99,
  securityDeposit: 0,
  frequency: 'monthly',
});

console.log(result.basePayment);  // monthly before tax
console.log(result.totalPayment); // monthly all-in
```

### Fee analysis

```typescript
import { analyzeInput } from 'canadian-car-finance';

const warnings = analyzeInput(loanInput);
// FeeWarning[] sorted: red → yellow → green
// Each warning: { severity, title, detail, script? }
```

---

## 🔧 Extensibility

All defaults are exported constants. Override only what changed — no fork, no monkey-patching.

### Override a tax rate

```typescript
import { computeFinancedAmount, type TaxOverrides } from 'canadian-car-finance';

// QC raises QST — combined rate moves to 15.0%
const overrides: TaxOverrides = {
  QC: { label: 'GST+QST', rate: 0.15 },
};

const { financedAmount, taxAmount } =
  computeFinancedAmount(40_000, 'QC', 5_000, 0, 1_800, overrides);
```

### Override fee warning thresholds

```typescript
import { analyzeInput, type FeeAnalysisOptions } from 'canadian-car-finance';

const options: FeeAnalysisOptions = {
  ppsa:     { yellowThreshold: 50,  redThreshold: 120  },
  adminFee: { yellowThreshold: 600, redThreshold: 1100 },
};

const warnings = analyzeInput(input, options);
```

### Add custom red-flag or negotiable keywords

```typescript
const options: FeeAnalysisOptions = {
  extraRedFlagKeywords:    ['rustproofing', 'undercoating', 'dealer markup'],
  extraNegotiableKeywords: ['placement fee'],
};
```

> [!TIP]
> Use `RULES_VERSION` to assert at runtime that the constants your app was built against are still the active set:
> ```typescript
> import { RULES_VERSION } from 'canadian-car-finance';
> // '0.2.0'
> ```

---

## 🧮 API Reference

### `calculateLoan(input: LoanInput): LoanResult`

| Field | Description |
|---|---|
| `payment` | Per-period payment |
| `totalPaid` | Total paid over term |
| `totalInterest` | Interest portion |
| `financedAmount` | Principal financed |
| `taxAmount` | Tax paid on vehicle |
| `totalCashPrice` | Out-of-pocket if paying cash |

### `calculateLease(input: LeaseInput): LeaseResult`

| Field | Description |
|---|---|
| `basePayment` | Payment before tax |
| `taxOnMonthly` | Tax applied per payment |
| `totalPayment` | Payment including tax |
| `totalCost` | Total outflow over term |
| `capitalizedCost` | Net cap cost (depreciation base) |

### `computeFinancedAmount(vehiclePrice, province, downPayment, tradeInValue, totalFees, taxOverrides?)`

Returns `{ financedAmount: number, taxAmount: number }`. Clamped to 0 — never negative.

### `analyzeInput(input: LoanInput | LeaseInput, options?: FeeAnalysisOptions): FeeWarning[]`

Returns warnings sorted `'red' → 'yellow' → 'green'`. Each `FeeWarning`:

```typescript
{ severity: 'red' | 'yellow' | 'green', title: string, detail: string, script?: string }
```

`script` is a dealer negotiation script when present (red/yellow warnings only).

### `suggestCategory(name: string, options?): 'mandatory' | 'negotiable' | 'watchout'`

Keyword-matches a fee name. Merge extra keywords via `options`.

---

## 🗺️ Provincial Tax Handling

The three split-PST provinces are where most calculators get the math wrong:

```
HST / GST-only provinces (AB, ON, QC, Atlantic, territories):
  tax = (vehiclePrice − tradeIn) × rate

Split GST+PST provinces (BC, MB, SK):
  GST = (vehiclePrice − tradeIn) × 0.05   ← trade-in reduces GST base
  PST = vehiclePrice × pstRate             ← PST is on the FULL price
  tax = GST + PST
```

| Province | Tax label | Combined rate | Trade-in reduces PST? |
|---|---|---|---|
| AB, NT, NU, YT | GST | 5% | N/A |
| ON | HST | 13% | Yes |
| NB, NL, NS, PE | HST | 15% | Yes |
| QC | GST+QST | ~14.975% | Yes |
| **BC** | GST+PST | 12% (5+7) | **PST: No** |
| **MB** | GST+PST | 12% (5+7) | **PST: No** |
| **SK** | GST+PST | 11% (5+6) | **PST: No** |

> [!IMPORTANT]
> If a tax rate changes in a provincial budget, update it via `TaxOverrides` in your app — no library update needed. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to submit a rate correction upstream.

---

## 📦 Exported Constants

| Export | Value / Description |
|---|---|
| `RULES_VERSION` | `'0.2.0'` — bump this when any threshold or rate changes |
| `PROVINCE_TAX` | Full `Record<Province, TaxInfo>` — all 13 provinces/territories |
| `PROVINCE_NAMES` | Full English province names |
| `DEFAULT_RED_FLAG_KEYWORDS` | Built-in watchout fee keywords (nitrogen, etching, protection packages…) |
| `DEFAULT_NEGOTIABLE_KEYWORDS` | Built-in negotiable fee keywords (admin, doc fee, processing…) |
| `DEFAULT_PPSA_THRESHOLDS` | `{ yellowThreshold: 40, redThreshold: 100 }` |
| `DEFAULT_ADMIN_FEE_THRESHOLDS` | `{ yellowThreshold: 499, redThreshold: 900 }` |
| `FILING_FEE_KEYWORDS` | `['filing', 'registry', 'licensing', 'document']` — one-time lease fees |
| `AB_DEFAULT_FEES` | Pre-populated Alberta fees (freight, AMVIC levy, PPSA, admin) |
| `QUICK_ADD_PRESETS` | Common fee presets for all provinces |

---

## 🛠 Development

```bash
git clone https://github.com/nishant-tamilselvan/canadian-car-finance
cd canadian-car-finance
npm install

npm test           # vitest — 82 tests across 4 files
npm run build      # tsup → dist/ (ESM + CJS + .d.ts)
npm run lint       # tsc type-check, no emit
npx vitest run --coverage   # coverage report (≥90% statements)
```

The library has **zero runtime dependencies**. The build produces three artifacts:

```
dist/index.js      ESM
dist/index.cjs     CommonJS
dist/index.d.ts    TypeScript declarations
```

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). When submitting a rate or threshold change, link the official government source in your PR description.

---

## License

MIT © [nishant-tamilselvan](https://github.com/nishant-tamilselvan)
