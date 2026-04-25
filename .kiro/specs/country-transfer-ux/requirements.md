# Requirements Document

## Introduction

SwiftSend's current transfer flow (the `SendMoney` page) treats every destination country identically. Users see no country-specific rules, no meaningful delivery-time estimate, and no currency context before they commit to a transfer. This feature improves the country-based transfer UX by surfacing three categories of contextual information at the right moment in the send flow:

1. **Country-specific rules** — transfer limits, required documents, restricted corridors, and cash-out method availability per destination country.
2. **Estimated delivery time** — a per-country, per-method time range shown before the user confirms, derived from partner data already present in the system.
3. **Currency hints** — the destination currency, a live-or-cached exchange rate, and the converted recipient amount shown inline during amount entry.

The feature touches the React frontend (`src/pages/SendMoney.tsx`, new components) and adds a lightweight backend endpoint that serves country metadata. It builds on existing data already in `mockData.ts`, `complianceService.ts`, and the `TransferRecipient` domain type.

---

## Glossary

- **Send_Flow**: The multi-step UI in `src/pages/SendMoney.tsx` (steps: recipient → amount → confirm → processing → success).
- **Country_Info_Panel**: A new UI component that renders country-specific rules, delivery estimate, and currency hint for a selected destination country.
- **Country_Metadata_Service**: The backend service (new) that provides per-country transfer rules, supported cash-out methods, and delivery time ranges.
- **Country_Metadata_API**: The REST endpoint (`GET /countries/:code/transfer-info`) exposed by the Country_Metadata_Service.
- **Delivery_Estimate**: A human-readable time range (e.g., "15 min – 2 hrs") representing the expected end-to-end delivery time for a given country and cash-out method.
- **Currency_Hint**: An inline display of the destination currency code, exchange rate, and converted recipient amount shown during amount entry.
- **Restricted_Corridor**: A source-to-destination country pair that is blocked or requires additional compliance review (e.g., destinations in `highRiskDestinations` set in `complianceService.ts`).
- **Cash_Out_Method**: One of `cash_pickup`, `bank_transfer`, `mobile_money`, or `home_delivery` as defined in `WithdrawalMethod`.
- **Compliance_Rule**: A transfer limit, document requirement, or restriction that applies to a specific destination country.

---

## Requirements

### Requirement 1: Country Info Panel — Display on Recipient Selection

**User Story:** As a sender, I want to see destination-country rules and available cash-out methods as soon as I select a recipient, so that I can decide whether to proceed before entering an amount.

#### Acceptance Criteria

1. WHEN a contact is selected in the Send_Flow recipient step, THE Country_Info_Panel SHALL display the destination country name, flag emoji, and ISO country code.
2. WHEN a contact is selected in the Send_Flow recipient step, THE Country_Info_Panel SHALL list all Cash_Out_Methods available for that destination country.
3. WHEN a destination country has one or more Compliance_Rules, THE Country_Info_Panel SHALL display each rule as a plain-language statement (e.g., "Government ID required for cash pickup").
4. WHEN a destination country is a Restricted_Corridor, THE Country_Info_Panel SHALL display a prominent warning message and SHALL prevent the user from advancing to the amount step.
5. IF the Country_Metadata_API returns an error, THEN THE Country_Info_Panel SHALL display a fallback message stating that country information is temporarily unavailable and SHALL allow the user to continue.
6. WHEN a new recipient is entered by email or phone (no contact selected), THE Country_Info_Panel SHALL NOT be displayed, because the destination country is unknown.

---

### Requirement 2: Delivery Time Estimate

**User Story:** As a sender, I want to see how long my transfer will take to reach the recipient before I confirm, so that I can set accurate expectations.

#### Acceptance Criteria

1. WHEN a contact is selected and the Send_Flow reaches the amount step, THE Country_Info_Panel SHALL display a Delivery_Estimate for each available Cash_Out_Method.
2. WHEN the user selects a specific Cash_Out_Method on the confirm step, THE Send_Flow SHALL display the Delivery_Estimate for that method prominently in the confirmation summary.
3. THE Country_Metadata_Service SHALL provide a minimum and maximum delivery time in minutes for each country–method pair.
4. WHEN the Delivery_Estimate minimum equals the maximum, THE Country_Info_Panel SHALL display a single duration (e.g., "~15 min") rather than a range.
5. WHEN the Country_Metadata_API is unavailable, THE Send_Flow SHALL display "Delivery time unavailable" in place of the Delivery_Estimate and SHALL NOT block transfer submission.
6. WHEN a transfer reaches the success step, THE Send_Flow SHALL display the Delivery_Estimate for the method used, consistent with what was shown at confirmation.

---

### Requirement 3: Currency Hints During Amount Entry

**User Story:** As a sender, I want to see the destination currency and converted amount as I type, so that I know exactly how much the recipient will receive in their local currency.

#### Acceptance Criteria

1. WHEN a contact is selected and the Send_Flow is on the amount step, THE Currency_Hint SHALL display the destination currency code (e.g., "MXN", "PHP") next to the amount input.
2. WHEN the user types a numeric amount greater than zero, THE Currency_Hint SHALL display the converted recipient amount in the destination currency, calculated as `(amount - totalFee) × exchangeRate`.
3. WHEN the exchange rate for a destination country is not available, THE Currency_Hint SHALL display the destination currency code only, without a converted amount, and SHALL NOT display a zero or placeholder value.
4. THE Country_Metadata_Service SHALL provide the exchange rate as a decimal multiplier (USDC → destination currency) for each supported country.
5. WHEN the exchange rate data is older than 60 minutes, THE Country_Metadata_Service SHALL refresh the rate from its upstream source before responding.
6. WHEN the exchange rate is displayed, THE Currency_Hint SHALL show the rate in the format "1 USDC = {rate} {currencyCode}" as a secondary label below the converted amount.
7. WHEN the amount is zero or the input is empty, THE Currency_Hint SHALL display only the destination currency code and SHALL NOT display a converted amount.

---

### Requirement 4: Country Metadata API

**User Story:** As a frontend developer, I want a single API endpoint that returns all country-specific transfer information, so that the UI can render rules, delivery estimates, and currency hints from one source of truth.

#### Acceptance Criteria

1. THE Country_Metadata_API SHALL accept a GET request to `/countries/:code/transfer-info` where `:code` is a two-letter ISO 3166-1 alpha-2 country code.
2. WHEN a valid country code is provided, THE Country_Metadata_API SHALL return a JSON object containing: `countryCode`, `countryName`, `currencyCode`, `exchangeRate`, `isRestricted`, `complianceRules` (array of strings), `cashOutMethods` (array of objects with `type`, `partnerName`, `deliveryMinMinutes`, `deliveryMaxMinutes`).
3. WHEN an unsupported or unknown country code is provided, THE Country_Metadata_API SHALL return HTTP 404 with a descriptive error message.
4. WHEN a restricted country code is provided, THE Country_Metadata_API SHALL return HTTP 200 with `isRestricted: true` and an empty `cashOutMethods` array.
5. THE Country_Metadata_API SHALL respond within 300ms for cached data.
6. IF the upstream exchange rate source is unavailable, THEN THE Country_Metadata_API SHALL return the most recently cached rate and SHALL include a `rateStaleAt` timestamp in the response.
7. THE Country_Metadata_API SHALL validate that `:code` matches the pattern `^[A-Z]{2}$`; IF the pattern does not match, THEN THE Country_Metadata_API SHALL return HTTP 400.

---

### Requirement 5: Confirm Step — Integrated Country Summary

**User Story:** As a sender, I want the confirmation screen to show a concise summary of country rules, delivery time, and converted amount, so that I have all the information I need before I tap "Send".

#### Acceptance Criteria

1. WHEN the Send_Flow reaches the confirm step with a contact selected, THE Send_Flow SHALL display a country summary section containing: destination country name and flag, selected Cash_Out_Method, Delivery_Estimate, and Currency_Hint with converted amount.
2. WHEN the Send_Flow reaches the confirm step, THE Send_Flow SHALL display any Compliance_Rules for the destination country as a checklist the user must acknowledge before the send button is enabled.
3. WHEN the destination country has no Compliance_Rules, THE Send_Flow SHALL NOT display the compliance checklist.
4. WHEN the user has not acknowledged all Compliance_Rules, THE Send_Flow SHALL disable the confirm/send button and SHALL display a message indicating acknowledgement is required.
5. WHEN the user acknowledges all Compliance_Rules and all other validations pass, THE Send_Flow SHALL enable the confirm/send button.

---

### Requirement 6: Accessibility and Internationalisation

**User Story:** As a user with assistive technology, I want the country-specific information to be fully accessible, so that I can use the send flow without barriers.

#### Acceptance Criteria

1. THE Country_Info_Panel SHALL include ARIA labels on all interactive elements and SHALL use semantic HTML landmark roles.
2. WHEN a Restricted_Corridor warning is displayed, THE Country_Info_Panel SHALL set `role="alert"` on the warning container so that screen readers announce it immediately.
3. THE Currency_Hint converted amount SHALL be wrapped in an `aria-live="polite"` region so that screen readers announce updates as the user types.
4. THE Country_Info_Panel SHALL render correctly at viewport widths from 320px to 1280px without horizontal overflow.
5. WHERE the user's device locale differs from the destination country locale, THE Currency_Hint SHALL format the converted amount using the destination country's locale conventions (e.g., period vs comma as decimal separator).
