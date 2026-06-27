# Contributing to canadian-car-finance

Thanks for your interest in contributing! This library powers real-world car financing calculations for Canadians, so accuracy and maintainability are the top priorities.

---

## Getting Started

```bash
git clone https://github.com/nishant-tamilselvan/canadian-car-finance
cd canadian-car-finance
npm install
```

Run the full test suite before making any changes to confirm you have a clean baseline:

```bash
npm test
```

---

## Project Structure

```
src/
  types/index.ts       — All shared TypeScript interfaces and types
  taxes.ts             — Provincial tax rates + computeFinancedAmount
  calculations.ts      — Loan amortization (calculateLoan, formatCAD)
  leaseCalculations.ts — Lease payment formula (calculateLease)
  feeAnalysis.ts       — Dealer fee warnings (analyzeInput, suggestCategory)
  index.ts             — Barrel export (the public API)
tests/
  taxes.test.ts
  calculations.test.ts
  leaseCalculations.test.ts
  feeAnalysis.test.ts
```

---

## Updating Constants That Change Over Time

The most common contribution is updating a tax rate, fee threshold, or keyword list that has changed due to new regulations. All the values you may need to update are in specific files:

### Tax rates (`src/taxes.ts`)

`PROVINCE_TAX` maps each `Province` code to a `TaxInfo`. Update the `rate` (combined) and `pstRate` (split-PST provinces only):

```typescript
// Example: BC raises PST from 7% to 8% in a future budget
BC: { label: 'GST+PST', rate: 0.13, pstOnFullPrice: true, pstRate: 0.08 },
```

After editing, update the tests in `tests/taxes.test.ts` to match the new expected values.

### Fee thresholds (`src/feeAnalysis.ts`)

`DEFAULT_PPSA_THRESHOLDS` and `DEFAULT_ADMIN_FEE_THRESHOLDS` define when a fee triggers a yellow or red warning. If the market or regulation shifts, update these two `const` objects:

```typescript
export const DEFAULT_PPSA_THRESHOLDS = {
  yellowThreshold: 40,   // raises a warning above this amount
  redThreshold: 100,     // raises a red flag above this amount
} as const;
```

### Fee keywords (`src/feeAnalysis.ts`)

`DEFAULT_RED_FLAG_KEYWORDS` and `DEFAULT_NEGOTIABLE_KEYWORDS` are `readonly string[]`. Add or remove entries when dealers introduce new add-on names or rename existing ones. Keywords are matched case-insensitively and as substrings.

### Lease filing-fee keywords (`src/leaseCalculations.ts`)

`FILING_FEE_KEYWORDS` classifies which fees are one-time registration charges vs. recurring surcharges during a lease. Update this list if new fee names appear in lease contracts.

---

## Writing Tests

- All tests live in `tests/` and import from the barrel: `import { ... } from '../src/index.js'`
- Use concrete numeric assertions over just "truthy/non-negative" wherever a formula has an exact known output
- Aim to keep coverage above the thresholds set in `vitest.config.ts` (90% statements/functions/lines, 85% branches)
- Run coverage locally: `npx vitest run --coverage`

---

## Pull Request Guidelines

1. **One concern per PR** — tax rate change, new keyword, bug fix, or feature, not all at once
2. **Tests required** — every change to a formula, constant, or threshold must be covered by a corresponding test update or new test
3. **No breaking changes without a version bump** — if you change a function signature, update `RULES_VERSION` in `src/index.ts` and note it in the PR description
4. **Describe the source** — for regulation or rate changes, link to the government source (e.g. CRA page, provincial budget bulletin) in the PR description so the change is auditable
5. Open an issue first for large changes (new province, new calculation type)

---

## Building

```bash
npm run build   # outputs dist/index.js (ESM), dist/index.cjs (CJS), dist/index.d.ts
npm run lint    # tsc type-check only, no emit
```

The build uses [tsup](https://tsup.egoist.dev). Configuration is in `tsup.config.ts` (or the `tsup` key in `package.json`).

---

## Code Style

- TypeScript strict mode (`strict: true`)
- No runtime dependencies — keep this a zero-dependency library
- Exported constants are `readonly` — this lets consumers rely on the literal types
- JSDoc on all exported functions (`@param`, `@returns`, `@example`)

---

## License

By contributing, you agree your contributions will be licensed under the MIT License.
