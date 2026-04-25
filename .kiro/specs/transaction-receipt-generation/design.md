# Design Document: Transaction Receipt Generation

## Overview

This feature adds client-side PDF receipt generation to SwiftSend. Users can download a receipt for any transaction from the Transaction History page (`/history`) or for any active/completed remittance transfer from the Remittance Status page (`/remittance`). All PDF generation happens entirely in the browser using **jsPDF**, with no data leaving the client.

The design introduces a single `receiptGenerator` service module, a reusable `DownloadReceiptButton` component, and thin integration points in the two existing pages. No backend changes are required.

---

## Architecture

The feature is structured as a pure frontend addition with three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  DownloadReceiptButton  (shared component)                  │
│  ├── TransactionItem    (History page integration)          │
│  └── RemittanceTracker  (Remittance Status integration)     │
└────────────────────────┬────────────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────────────┐
│                   Service Layer                             │
│  src/lib/receiptGenerator.ts                                │
│  ├── buildTransactionReceiptContent(transaction, user)      │
│  ├── buildRemittanceReceiptContent(transfer)                │
│  ├── renderReceiptToPdf(content)  → jsPDF instance          │
│  └── downloadPdf(doc, filename)                             │
└────────────────────────┬────────────────────────────────────┘
                         │ uses
┌────────────────────────▼────────────────────────────────────┐
│                  Library Layer                              │
│  jsPDF  (browser-native PDF rendering)                      │
│  File System Access API  (with anchor-tag fallback)         │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **jsPDF** is chosen because it is the most widely used browser-compatible PDF library, has no server-side dependencies, and produces well-structured PDFs without requiring a canvas or headless browser.
- The receipt content is built as a plain data structure (`ReceiptContent`) before being passed to the renderer. This separation makes the content-building logic independently testable without needing to instantiate jsPDF.
- The `DownloadReceiptButton` component manages its own loading/error state so the parent components remain unchanged in structure.

---

## Components and Interfaces

### `src/lib/receiptGenerator.ts`

The core service. Exports pure functions that are easy to unit-test.

```typescript
// Intermediate representation of receipt content — no PDF dependency
export interface ReceiptField {
  label: string;
  value: string;
}

export interface ReceiptSection {
  title?: string;
  fields: ReceiptField[];
  highlighted?: boolean; // renders with a box/border (e.g. confirmation code)
}

export interface ReceiptContent {
  header: {
    brandName: string;        // "SwiftSend"
    generatedAt: string;      // formatted timestamp
  };
  sections: ReceiptSection[];
  notice?: string;            // optional risk notice
}

// Build receipt content from a Transaction object
export function buildTransactionReceiptContent(
  transaction: Transaction,
  senderName: string
): ReceiptContent

// Build receipt content from a remittance transfer
export function buildRemittanceReceiptContent(
  transfer: RemittanceReceiptInput
): ReceiptContent

// Render a ReceiptContent to a jsPDF document
export function renderReceiptToPdf(content: ReceiptContent): jsPDF

// Trigger browser download of a jsPDF document
export async function downloadPdf(doc: jsPDF, filename: string): Promise<void>

// Convenience: build + render + download in one call
export async function generateAndDownloadTransactionReceipt(
  transaction: Transaction,
  senderName: string
): Promise<void>

export async function generateAndDownloadRemittanceReceipt(
  transfer: RemittanceReceiptInput
): Promise<void>
```

**`RemittanceReceiptInput`** is a plain interface that maps the fields available on the `RemittanceStatus` page's `ActiveTransfer` type:

```typescript
export interface RemittanceReceiptInput {
  id: string;
  recipientName: string;
  amount: number;
  currency: string;
  confirmationCode: string;
  status: 'processing' | 'ready_for_pickup' | 'completed';
  partnerName: string;
  method: 'cash_pickup' | 'bank_transfer' | 'mobile_money' | 'home_delivery';
  country: string;
  createdAt?: Date;
}
```

### `src/components/DownloadReceiptButton.tsx`

A reusable button component that wraps the receipt generation call and manages UI state.

```typescript
interface DownloadReceiptButtonProps {
  // One of these two must be provided
  transaction?: Transaction;
  remittanceTransfer?: RemittanceReceiptInput;
  senderName?: string;   // required when transaction is provided
  className?: string;
}
```

The component:
- Renders a `<Button>` with a `Download` icon and the label "Download Receipt"
- Sets `aria-label` to `"Download receipt for transaction {id}"` (using `transaction.id` or `remittanceTransfer.id`)
- Shows a `Loader2` spinner and disables itself while generating
- On error, calls `toast.error("Receipt download failed. Please try again.")` and re-enables
- Is keyboard-navigable (inherits from the existing `Button` component)

### Integration points

**`TransactionItem.tsx`** — add `DownloadReceiptButton` inside the `showDetailedView` block, after the fee breakdown section. The `senderName` is sourced from the authenticated user context (or passed as a prop from the History page).

**`RemittanceTracker.tsx`** — add `DownloadReceiptButton` inside the action buttons row at the bottom of the card.

---

## Data Models

### Receipt content for a `Transaction` (type: `send`)

| Field | Source | Format |
|---|---|---|
| Transaction ID | `transaction.id` | Full string, no truncation |
| Date & Time | `transaction.timestamp` | `YYYY-MM-DD HH:mm:ss` (local timezone) |
| Sender | `senderName` prop | String |
| Recipient | `transaction.recipientName` | String |
| Recipient Phone | `transaction.recipientPhone` | String |
| Type | `transaction.type` | `"Send"` |
| Amount Sent | `transaction.amount` | 2 decimal places, e.g. `100.00 USD` |
| Exchange Rate | `transaction.exchangeRate` | `1 USD = {rate} {destinationCurrency}` (omitted if zero/absent) |
| Recipient Receives | `transaction.recipientAmount` + `transaction.destinationCurrency` | 2 decimal places |
| Network Fee | derived via `splitFee()` | 2 decimal places |
| Service Fee | derived via `splitFee()` | 2 decimal places |
| Total Fee | `transaction.fee` | 2 decimal places |
| Total Cost | `transaction.amount + transaction.fee` | 2 decimal places |
| Status | `transaction.status` | Capitalised string |
| Risk Notice | `transaction.risk?.level` | Shown if level is `"high"` or `"medium"` |

### Receipt content for a `Transaction` (type: `receive`)

Same as above but the fee breakdown section (network fee, service fee, total fee, total cost) is **omitted**. Only amount received and sender information are shown.

### Receipt content for a remittance transfer

| Field | Source | Format |
|---|---|---|
| Transfer ID | `transfer.id` | Full string |
| Confirmation Code | `transfer.confirmationCode` | Highlighted section if status is `ready_for_pickup` |
| Date Initiated | `transfer.createdAt` | `YYYY-MM-DD HH:mm:ss` (local timezone) |
| Recipient | `transfer.recipientName` | String |
| Destination Country | `transfer.country` | String |
| Transfer Method | `transfer.method` | Human-readable: `"Cash Pickup"`, `"Bank Transfer"`, `"Mobile Money"`, `"Home Delivery"` |
| Partner | `transfer.partnerName` | String |
| Amount Sent | `transfer.amount` | 2 decimal places |
| Destination Currency | `transfer.currency` | String |
| Status | `transfer.status` | `"Processing"`, `"Ready for Pickup"`, `"Completed"` |

### Filename convention

```
receipt-{transactionId}.pdf
```

where `transactionId` is the full `transaction.id` or `transfer.id` value.

### Date formatting helper

```typescript
export function formatReceiptDate(date: Date): string
// Returns: "YYYY-MM-DD HH:mm:ss" in the user's local timezone
// Example: "2024-07-15 14:32:07"
```

### Amount formatting helper

```typescript
export function formatReceiptAmount(amount: number, currency?: string): string
// Returns: "100.00" or "100.00 MXN"
// Always 2 decimal places
```

### Exchange rate formatting helper

```typescript
export function formatExchangeRate(rate: number, destinationCurrency: string): string
// Returns: "1 USD = 17.25 MXN"
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Send receipt contains all required fields

*For any* `Transaction` with `type === "send"`, the `ReceiptContent` produced by `buildTransactionReceiptContent` SHALL contain fields for transaction ID, date/time, sender name, recipient name, recipient phone, transaction type, amount sent, recipient amount, fee breakdown (network fee, service fee, total fee), total cost, and transaction status.

**Validates: Requirements 1.3**

---

### Property 2: Receive receipt omits fee breakdown

*For any* `Transaction` with `type === "receive"`, the `ReceiptContent` produced by `buildTransactionReceiptContent` SHALL NOT contain any fee breakdown fields (network fee, service fee, total fee, total cost), and SHALL contain the amount received and sender information.

**Validates: Requirements 1.4**

---

### Property 3: Receipt header always contains brand name and generation timestamp

*For any* transaction or remittance transfer, the `ReceiptContent` produced by either builder function SHALL have `header.brandName === "SwiftSend"` and `header.generatedAt` matching the `YYYY-MM-DD HH:mm:ss` format.

**Validates: Requirements 1.5**

---

### Property 4: Filename follows the required pattern

*For any* transaction ID string, the filename produced for the receipt SHALL equal `"receipt-" + transactionId + ".pdf"`.

**Validates: Requirements 1.6**

---

### Property 5: Remittance receipt contains all required fields

*For any* `RemittanceReceiptInput`, the `ReceiptContent` produced by `buildRemittanceReceiptContent` SHALL contain fields for transfer ID, confirmation code, recipient name, destination country, transfer method, partner name, amount sent, destination currency, and current status.

**Validates: Requirements 2.3**

---

### Property 6: Ready-for-pickup receipts highlight the confirmation code

*For any* `RemittanceReceiptInput` with `status === "ready_for_pickup"`, the `ReceiptContent` SHALL contain a highlighted section with the confirmation code and a label indicating it is required for cash pickup.

**Validates: Requirements 2.4**

---

### Property 7: Monetary amounts always have exactly 2 decimal places

*For any* finite number passed to `formatReceiptAmount`, the returned string SHALL contain a decimal point followed by exactly 2 digits.

**Validates: Requirements 3.1**

---

### Property 8: Date formatting always produces the correct ISO 8601 pattern

*For any* `Date` object passed to `formatReceiptDate`, the returned string SHALL match the regular expression `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/`.

**Validates: Requirements 3.2**

---

### Property 9: Exchange rate formatting follows the required pattern

*For any* non-zero exchange rate and any non-empty destination currency string, `formatExchangeRate` SHALL return a string matching `"1 USD = {rate} {currency}"`.

**Validates: Requirements 3.3**

---

### Property 10: Transaction ID is never truncated in the receipt

*For any* transaction ID of any length, the `ReceiptContent` produced by `buildTransactionReceiptContent` SHALL contain the full ID string as a field value without truncation.

**Validates: Requirements 3.4**

---

### Property 11: Risk notice appears for high/medium risk and is absent for low risk

*For any* `Transaction` with `risk.level === "high"` or `risk.level === "medium"`, the `ReceiptContent` SHALL include `notice === "This transaction was subject to additional review."`. For any transaction with `risk.level === "low"` or no risk field, the `notice` field SHALL be absent or undefined.

**Validates: Requirements 3.5**

---

### Property 12: Download button aria-label follows the required pattern

*For any* transaction ID string, the `DownloadReceiptButton` rendered with that ID SHALL have an `aria-label` attribute equal to `"Download receipt for transaction " + transactionId`.

**Validates: Requirements 4.1**

---

**Property Reflection — redundancy check:**

- Properties 7 and 8 are distinct: one covers amount formatting, the other date formatting. No redundancy.
- Properties 1 and 5 cover different data shapes (Transaction vs RemittanceReceiptInput). No redundancy.
- Properties 3 and 1/5 overlap slightly on header content, but Property 3 specifically tests the header fields which are not covered by the field-presence properties. Kept separate.
- Properties 6 and 5 are complementary: Property 5 checks all fields are present, Property 6 checks the highlighted presentation of the confirmation code for a specific status. No redundancy.
- Properties 11 covers both the positive case (notice present) and negative case (notice absent), so no need for a separate property for the absence case.

---

## Error Handling

| Scenario | Handling |
|---|---|
| jsPDF throws during PDF rendering | Caught in `generateAndDownload*`, re-thrown as a typed `ReceiptGenerationError`; `DownloadReceiptButton` catches it, shows `toast.error("Receipt download failed. Please try again.")`, re-enables the button |
| `showSaveFilePicker` is rejected by the user (cancel) | Silently ignored — no error toast, button re-enabled |
| `showSaveFilePicker` throws a non-abort error | Falls back to anchor-tag download |
| Transaction data has missing optional fields (e.g. no `exchangeRate`, no `destinationCurrency`) | Fields are conditionally omitted from the receipt rather than rendering `undefined` or `NaN` |
| `amount` or `fee` is `NaN` or `Infinity` | `formatReceiptAmount` guards with `Number.isFinite`; renders `"0.00"` as a safe fallback |

---

## Testing Strategy

### Unit tests (Jest + Testing Library)

Focus on specific examples, edge cases, and error conditions:

- `buildTransactionReceiptContent` with a send transaction — verify all required fields are present
- `buildTransactionReceiptContent` with a receive transaction — verify fee breakdown is absent
- `buildRemittanceReceiptContent` with `status === "ready_for_pickup"` — verify highlighted confirmation code section
- `buildRemittanceReceiptContent` with each of the 3 status values — verify human-readable status labels
- `formatReceiptDate` with a known date — verify exact output string
- `formatExchangeRate` with a known rate and currency — verify exact output string
- `DownloadReceiptButton` — verify loading state during generation, error toast on failure, re-enable on failure
- `DownloadReceiptButton` — verify `aria-label` for a given transaction ID
- `downloadPdf` — verify File System Access API path when `showSaveFilePicker` is available, anchor-tag fallback when it is not

### Property-based tests (fast-check, already in devDependencies)

The project already uses `fast-check@4.7.0`. Each property test runs a minimum of 100 iterations.

Each test is tagged with a comment in the format:
`// Feature: transaction-receipt-generation, Property {N}: {property_text}`

| Property | Generator | Assertion |
|---|---|---|
| P1: Send receipt fields | `fc.record({ id: fc.string(), type: fc.constant('send'), amount: fc.float({ min: 0.01 }), fee: fc.float({ min: 0 }), ... })` | All required field labels present in sections |
| P2: Receive receipt omits fees | Same but `type: fc.constant('receive')` | No fee-related field labels in any section |
| P3: Header brand + timestamp | Either transaction or remittance input | `header.brandName === "SwiftSend"` and timestamp matches regex |
| P4: Filename pattern | `fc.string({ minLength: 1 })` as transaction ID | `filename === "receipt-" + id + ".pdf"` |
| P5: Remittance receipt fields | `fc.record({ id: fc.string(), recipientName: fc.string(), ... })` | All required field labels present |
| P6: Ready-for-pickup highlight | Remittance input with `status: fc.constant('ready_for_pickup')` | Highlighted section contains confirmation code and pickup label |
| P7: Amount formatting | `fc.float({ noNaN: true, noDefaultInfinity: true })` | Output matches `/^\d+\.\d{2}$/` |
| P8: Date formatting | `fc.date()` | Output matches `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/` |
| P9: Exchange rate formatting | `fc.float({ min: 0.0001, noNaN: true })` + `fc.string({ minLength: 1 })` | Output matches `"1 USD = {rate} {currency}"` |
| P10: ID not truncated | `fc.string({ minLength: 1, maxLength: 200 })` | Full ID string appears in receipt content |
| P11: Risk notice | Transaction with `risk.level` from `fc.constantFrom('high', 'medium', 'low')` | Notice present for high/medium, absent for low |
| P12: Aria-label pattern | `fc.string({ minLength: 1 })` as transaction ID | `aria-label === "Download receipt for transaction " + id` |

### Integration / smoke tests

- Verify `DownloadReceiptButton` appears in `TransactionItem` when `showDetailedView=true`
- Verify `DownloadReceiptButton` appears in `RemittanceTracker` for all 3 status values
- Verify no outbound network requests are made during PDF generation (mock `fetch` and `XMLHttpRequest`, assert they are never called)
