# Implementation Plan: Country Transfer UX

## Overview

Implement country-specific transfer context across the send flow. The work is split into three tracks that build on each other: (1) backend `CountryMetadataService` and `GET /countries/:code/transfer-info` route, (2) pure helper functions and shared types, (3) React components and the `useCountryInfo` hook, and (4) wiring everything into `SendMoney.tsx`.

## Tasks

- [x] 1. Define shared types and install fast-check
  - Add `CountryInfo`, `CashOutMethod`, and `RateCacheEntry` TypeScript interfaces to a new `src/types/countryTransfer.ts` file
  - Install `fast-check` as a dev dependency in the root `package.json` (frontend tests) and in `backend/package.json` (backend tests)
  - _Requirements: 4.2_

- [x] 2. Implement pure helper functions
  - [x] 2.1 Implement `formatDeliveryEstimate(minMinutes, maxMinutes): string`
    - Create `src/lib/countryTransferHelpers.ts`
    - Equal min/max → `"~{n} min"` (or hours if ≥ 60); different → `"{min} – {max}"` range string
    - Export as a named function
    - _Requirements: 2.3, 2.4_

  - [ ]* 2.2 Write property test for `formatDeliveryEstimate` — equal min/max (Property 2)
    - **Property 2: Delivery estimate formatting — equal min/max**
    - **Validates: Requirements 2.4**

  - [ ]* 2.3 Write property test for `formatDeliveryEstimate` — consistency through the flow (Property 3)
    - **Property 3: Delivery estimate consistency through the flow**
    - **Validates: Requirements 2.6**

  - [x] 2.4 Implement `convertAmount(amount, totalFee, exchangeRate): number`
    - Add to `src/lib/countryTransferHelpers.ts`
    - Formula: `(amount - totalFee) × exchangeRate`
    - _Requirements: 3.2_

  - [ ]* 2.5 Write property test for `convertAmount` (Property 4)
    - **Property 4: Currency conversion formula correctness**
    - **Validates: Requirements 3.2**

  - [x] 2.6 Implement `formatConvertedAmount(amount, locale): string`
    - Add to `src/lib/countryTransferHelpers.ts`
    - Uses `Intl.NumberFormat` with the provided locale
    - _Requirements: 6.5_

  - [ ]* 2.7 Write property test for locale-aware currency formatting (Property 12)
    - **Property 12: Locale-aware currency formatting**
    - **Validates: Requirements 6.5**

- [x] 3. Implement backend `CountryMetadataService`
  - [x] 3.1 Create `backend/src/modules/countries/countryMetadataService.ts`
    - Define static country registry for MX, PH, GT, SV with `countryName`, `currencyCode`, `cashOutMethods` (with `deliveryMinMinutes`/`deliveryMaxMinutes`), and `complianceRules`
    - Source restricted countries from `ComplianceService.highRiskDestinations` (RU, BY, IR, KP)
    - Implement in-memory `RateCacheEntry` map keyed by country code
    - Implement `getCountryInfo(code: string): Promise<CountryInfo>` — throws `NotFoundError` for unknown codes, returns `isRestricted: true` + `cashOutMethods: []` for restricted codes
    - Implement `refreshRateIfStale(code: string): Promise<void>` — refreshes when `Date.now() - cachedAt > 60 * 60 * 1000`; on upstream failure, keeps cached rate and sets `rateStaleAt`
    - _Requirements: 3.4, 3.5, 4.2, 4.3, 4.4, 4.6_

  - [ ]* 3.2 Write unit tests for `CountryMetadataService`
    - Test known country returns full shape
    - Test unknown country throws `NotFoundError`
    - Test restricted country returns `isRestricted: true` and empty `cashOutMethods`
    - Test stale rate refresh logic (mock `Date.now`)
    - _Requirements: 3.5, 4.3, 4.4, 4.6_

- [x] 4. Implement backend countries route
  - [x] 4.1 Create `backend/src/routes/countries.ts`
    - Register `GET /countries/:code/transfer-info` on the Fastify instance (no auth required)
    - Validate `:code` against `^[A-Z]{2}$`; return HTTP 400 with `{ error: "Invalid country code" }` on mismatch
    - Call `CountryMetadataService.getCountryInfo(code)`; return HTTP 404 with `{ error: "Country not supported" }` on `NotFoundError`
    - Return HTTP 200 with `CountryInfo` JSON for all other cases
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

  - [x] 4.2 Register the countries route in `backend/src/app.ts`
    - Import `countriesRoutes` and register with the existing `prefix`
    - _Requirements: 4.1_

  - [x] 4.3 Add `CountryMetadataService` to the DI container in `backend/src/container.ts`
    - Instantiate and expose as `container.services.countryMetadata`
    - _Requirements: 4.1_

  - [ ]* 4.4 Write integration tests for the countries route (Properties 7, 8, 9)
    - Use Fastify `inject` for all assertions
    - **Property 7: API response schema completeness for supported countries** — Validates: Requirements 4.2
    - **Property 8: Restricted country API response shape** — Validates: Requirements 4.4
    - **Property 9: Country code validation rejects non-alpha-2** — Validates: Requirements 4.7
    - Also test HTTP 404 for unknown code and HTTP 400 for invalid code (example-based)
    - _Requirements: 4.2, 4.4, 4.7_

  - [ ]* 4.5 Write property test for stale rate cache (Property 13)
    - **Property 13: Stale rate cache still returns a rate**
    - Seed cache with a rate timestamped 61 minutes ago; mock upstream as unavailable
    - **Validates: Requirements 3.5, 4.6**

- [x] 5. Checkpoint — backend tests pass
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 6. Implement `useCountryInfo` hook
  - Create `src/hooks/useCountryInfo.ts`
  - Wraps a `@tanstack/react-query` `useQuery` call to `GET /countries/:code/transfer-info`
  - Returns `{ data: CountryInfo | null, isLoading: boolean, isError: boolean }`
  - Returns `{ data: null, isLoading: false, isError: false }` when `countryCode` is `null`
  - Caches results with a 5-minute stale time (`staleTime: 5 * 60 * 1000`)
  - On error, sets `isError: true` and returns `data: null` (never throws to component tree)
  - _Requirements: 1.5, 1.6_

- [x] 7. Implement `CountryInfoPanel` component
  - [x] 7.1 Create `src/components/CountryInfoPanel.tsx`
    - Accept `CountryInfoPanelProps`: `{ countryInfo: CountryInfo | null, isLoading: boolean, isError: boolean }`
    - Render country name, flag emoji, ISO code
    - Render each `CashOutMethod` with its `partnerName` and formatted delivery estimate (using `formatDeliveryEstimate`)
    - Render each `complianceRule` as a plain-language statement
    - Render restricted corridor warning with `role="alert"` when `isRestricted` is true
    - Render skeleton loader while `isLoading` is true
    - Render fallback message "Country information is temporarily unavailable." when `isError` is true
    - Include ARIA labels on interactive elements and semantic HTML landmark roles
    - Render correctly at 320px–1280px viewport widths (no horizontal overflow)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 6.1, 6.2, 6.4_

  - [ ]* 7.2 Write property test for `CountryInfoPanel` renders complete country data (Property 1)
    - **Property 1: CountryInfoPanel renders complete country data**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1**

  - [ ]* 7.3 Write unit tests for `CountryInfoPanel`
    - Test loading state (skeleton present)
    - Test error state (fallback message present)
    - Test restricted corridor warning (`role="alert"` present)
    - Test normal state with rules and methods
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Implement `CurrencyHint` component
  - [x] 8.1 Create `src/components/CurrencyHint.tsx`
    - Accept `CurrencyHintProps`: `{ currencyCode: string | null, exchangeRate: number | null, amount: number, totalFee: number, locale?: string }`
    - Show only `currencyCode` when `exchangeRate` is null or `amount <= 0`
    - Show converted amount (via `convertAmount`) and rate label `"1 USDC = {rate} {currencyCode}"` when `amount > 0` and `exchangeRate` is available
    - Wrap converted amount in `aria-live="polite"` region with `data-testid="converted-amount"`
    - Add `data-testid="rate-label"` to the rate label element
    - Format numbers using `formatConvertedAmount` with the destination locale
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 6.3, 6.5_

  - [ ]* 8.2 Write property test for `CurrencyHint` suppresses converted amount (Property 5)
    - **Property 5: CurrencyHint suppresses converted amount when amount ≤ 0 or rate is null**
    - **Validates: Requirements 3.3, 3.7**

  - [ ]* 8.3 Write property test for rate label format (Property 6)
    - **Property 6: Rate label format**
    - **Validates: Requirements 3.6**

  - [ ]* 8.4 Write unit tests for `CurrencyHint`
    - Test null exchange rate (no converted amount)
    - Test zero amount (no converted amount)
    - Test positive amount with rate (converted amount and rate label present)
    - Test locale formatting (es-MX vs en-US decimal separator)
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7_

- [x] 9. Implement `ComplianceRulesList` component
  - [x] 9.1 Create `src/components/ComplianceRulesList.tsx`
    - Accept `ComplianceRulesListProps`: `{ rules: string[], onAllAcknowledged: (acknowledged: boolean) => void }`
    - Render each rule as a labelled checkbox
    - Call `onAllAcknowledged(true)` when every checkbox is checked; `onAllAcknowledged(false)` otherwise
    - _Requirements: 5.2, 5.4, 5.5_

  - [ ]* 9.2 Write unit tests for `ComplianceRulesList`
    - Test all boxes checked → `onAllAcknowledged(true)`
    - Test one unchecked → `onAllAcknowledged(false)`
    - _Requirements: 5.2, 5.4, 5.5_

- [x] 10. Implement `CountrySummary` component
  - [x] 10.1 Create `src/components/CountrySummary.tsx`
    - Accept `CountrySummaryProps`: `{ countryInfo: CountryInfo, selectedMethod: CashOutMethod, amount: number, totalFee: number }`
    - Render country name and flag emoji
    - Render selected method `partnerName`
    - Render delivery estimate using `formatDeliveryEstimate`
    - Render `CurrencyHint` with converted amount
    - _Requirements: 5.1, 2.2, 2.6_

  - [ ]* 10.2 Write property test for confirm step renders all required summary elements (Property 10)
    - **Property 10: Confirm step renders all required summary elements**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 10.3 Write unit tests for `CountrySummary`
    - Test country name and flag are rendered
    - Test delivery estimate is rendered
    - Test currency hint is rendered
    - _Requirements: 5.1, 2.2_

- [x] 11. Checkpoint — frontend component tests pass
  - Ensure all frontend component tests pass, ask the user if questions arise.

- [x] 12. Wire components into `SendMoney.tsx`
  - [x] 12.1 Add `useCountryInfo` hook call in `SendMoney.tsx`
    - Derive `countryCode` from `selectedContact?.countryCode ?? null`
    - Call `useCountryInfo(countryCode)` and destructure `{ data: countryInfo, isLoading: countryInfoLoading, isError: countryInfoError }`
    - _Requirements: 1.6_

  - [x] 12.2 Integrate `CountryInfoPanel` into the recipient step
    - Render `<CountryInfoPanel>` below the contact list when `selectedContact` is set
    - Hide the "Continue" button when `countryInfo?.isRestricted` is true
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 12.3 Integrate `CountryInfoPanel` and `CurrencyHint` into the amount step
    - Render `<CountryInfoPanel>` above the amount input when `selectedContact` is set
    - Render `<CurrencyHint>` inline below the amount input, passing `countryInfo?.currencyCode`, `countryInfo?.exchangeRate`, `amountValue`, `fees.totalFee`, and the destination locale
    - _Requirements: 2.1, 3.1, 3.2, 3.3_

  - [x] 12.4 Integrate `CountrySummary` and `ComplianceRulesList` into the confirm step
    - Render `<CountrySummary>` when `countryInfo` is available and a `CashOutMethod` is selected
    - Render `<ComplianceRulesList>` when `countryInfo?.complianceRules.length > 0`
    - Track `allRulesAcknowledged` state; disable the send button when `complianceRules.length > 0 && !allRulesAcknowledged`
    - Show acknowledgement-required message when rules are present but not all acknowledged
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 12.5 Update the success step to show delivery estimate
    - Replace the static `"~5 seconds"` estimate with the formatted delivery estimate from `countryInfo` and the selected method
    - Fall back to `"Delivery time unavailable"` when `countryInfo` is null
    - _Requirements: 2.5, 2.6_

  - [x] 12.6 Remove static `CASH_PICKUP_PARTNER_BY_COUNTRY` and `DESTINATION_CURRENCY_BY_COUNTRY` maps from `SendMoney.tsx`
    - Replace usages in `submitTransfer` with values from `countryInfo` (partner code from selected method, currency from `countryInfo.currencyCode`)
    - Fall back to existing hardcoded values only when `countryInfo` is null
    - _Requirements: 4.2_

  - [ ]* 12.7 Write property test for compliance rules gate disables send button (Property 11)
    - **Property 11: Compliance rules gate disables send button**
    - **Validates: Requirements 5.4**

- [x] 13. Final checkpoint — all tests pass
  - Ensure all frontend and backend tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–13 from the design document)
- Unit tests validate specific examples and edge cases
- The `useCountryInfo` hook never throws to the component tree — all errors are surfaced via `isError: true`
- Graceful degradation is required at every layer: API errors must never block a transfer
