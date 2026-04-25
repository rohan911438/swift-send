# Implementation Plan: Transaction Receipt Generation

## Overview

Implement client-side PDF receipt generation for SwiftSend. The work is structured in four incremental steps: (1) install the jsPDF dependency and scaffold the service module with helper functions, (2) implement the two receipt content builders and the PDF renderer/downloader, (3) build the shared `DownloadReceiptButton` component, and (4) wire the button into `TransactionItem` and `RemittanceTracker`. No backend changes are required.

## Tasks

- [x] 1. Install jsPDF and scaffold the receipt generator module
  - Add `jspdf` as a production dependency in `package.json` (use a pinned version, e.g. `"jspdf": "2.5.2"`)
  - Create `src/lib/receiptGenerator.ts` with the exported interfaces (`ReceiptField`, `ReceiptSection`, `ReceiptContent`, `RemittanceReceiptInput`) and empty function stubs for all exported functions
  - Create `src/components/DownloadReceiptButton.tsx` as an empty stub that renders `null`
  - _Requirements: 1.2, 1.6, 4.4_

- [x] 2. Implement formatting helpers and property-test them
  - [x] 2.1 Implement `formatReceiptDate`, `formatReceiptAmount`, and `formatExchangeRate` in `src/lib/receiptGenerator.ts`
    - `formatReceiptDate(date: Date): string` — returns `"YYYY-MM-DD HH:mm:ss"` in local timezone
    - `formatReceiptAmount(amount: number, currency?: string): string` — always 2 decimal places; guard `NaN`/`Infinity` with `"0.00"` fallback
    - `formatExchangeRate(rate: number, destinationCurrency: string): string` — returns `"1 USD = {rate} {currency}"`
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 2.2 Write property test for `formatReceiptAmount` (Property 7)
    - **Property 7: Monetary amounts always have exactly 2 decimal places**
    - **Validates: Requirements 3.1**
    - Use `fc.float({ noNaN: true, noDefaultInfinity: true })` as generator
    - Assert output matches `/^\d+\.\d{2}(?: [A-Z]+)?$/`

  - [ ]* 2.3 Write property test for `formatReceiptDate` (Property 8)
    - **Property 8: Date formatting always produces the correct ISO 8601 pattern**
    - **Validates: Requirements 3.2**
    - Use `fc.date()` as generator
    - Assert output matches `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/`

  - [ ]* 2.4 Write property test for `formatExchangeRate` (Property 9)
    - **Property 9: Exchange rate formatting follows the required pattern**
    - **Validates: Requirements 3.3**
    - Use `fc.float({ min: 0.0001, noNaN: true })` + `fc.string({ minLength: 1 })` as generators
    - Assert output matches `"1 USD = " + rate + " " + currency`

- [x] 3. Implement `buildTransactionReceiptContent`
  - [x] 3.1 Implement `buildTransactionReceiptContent(transaction, senderName)` in `src/lib/receiptGenerator.ts`
    - Build `ReceiptContent` with `header.brandName = "SwiftSend"` and `header.generatedAt` from `formatReceiptDate(new Date())`
    - For `type === "send"`: include all required fields — transaction ID (full, untruncated), date/time, sender, recipient name, recipient phone, type, amount sent, exchange rate (if non-zero), recipient amount + destination currency, network fee and service fee (via `splitFee()`), total fee, total cost, and status
    - For `type === "receive"`: omit the fee breakdown section entirely; include amount received and sender information
    - Set `notice` to `"This transaction was subject to additional review."` when `risk.level` is `"high"` or `"medium"`; omit otherwise
    - _Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property test for send receipt required fields (Property 1)
    - **Property 1: Send receipt contains all required fields**
    - **Validates: Requirements 1.3**
    - Generate arbitrary send transactions with `fc.record({ id: fc.string({ minLength: 1 }), type: fc.constant('send'), amount: fc.float({ min: 0.01, noNaN: true, noDefaultInfinity: true }), fee: fc.float({ min: 0, noNaN: true, noDefaultInfinity: true }), recipientAmount: fc.float({ min: 0, noNaN: true }), recipientName: fc.string({ minLength: 1 }), recipientPhone: fc.string(), status: fc.constantFrom('pending','processing','completed','failed'), timestamp: fc.date() })`
    - Assert all required field labels are present across all sections

  - [ ]* 3.3 Write property test for receive receipt omits fee breakdown (Property 2)
    - **Property 2: Receive receipt omits fee breakdown**
    - **Validates: Requirements 1.4**
    - Same generator but `type: fc.constant('receive')`
    - Assert no section contains field labels for network fee, service fee, total fee, or total cost

  - [ ]* 3.4 Write property test for transaction ID not truncated (Property 10)
    - **Property 10: Transaction ID is never truncated in the receipt**
    - **Validates: Requirements 3.4**
    - Use `fc.string({ minLength: 1, maxLength: 200 })` as the transaction ID
    - Assert the full ID string appears as a field value in the receipt content

  - [ ]* 3.5 Write property test for risk notice (Property 11)
    - **Property 11: Risk notice appears for high/medium risk and is absent for low risk**
    - **Validates: Requirements 3.5**
    - Generate transactions with `risk.level` from `fc.constantFrom('high', 'medium', 'low')`
    - Assert `notice` is set for high/medium and absent/undefined for low or no risk

- [x] 4. Implement `buildRemittanceReceiptContent`
  - [x] 4.1 Implement `buildRemittanceReceiptContent(transfer)` in `src/lib/receiptGenerator.ts`
    - Build `ReceiptContent` with the same header pattern (brand name + generation timestamp)
    - Include all required fields: transfer ID, confirmation code, date initiated (`transfer.createdAt`), recipient name, destination country, transfer method (human-readable label), partner name, amount sent, destination currency, and current status (human-readable: `"Processing"`, `"Ready for Pickup"`, `"Completed"`)
    - When `status === "ready_for_pickup"`, place the confirmation code in a `highlighted: true` section with a label indicating it is required for cash pickup
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test for remittance receipt required fields (Property 5)
    - **Property 5: Remittance receipt contains all required fields**
    - **Validates: Requirements 2.3**
    - Generate arbitrary `RemittanceReceiptInput` objects with `fc.record({ id: fc.string({ minLength: 1 }), recipientName: fc.string({ minLength: 1 }), amount: fc.float({ min: 0.01, noNaN: true, noDefaultInfinity: true }), currency: fc.string({ minLength: 1 }), confirmationCode: fc.string({ minLength: 1 }), status: fc.constantFrom('processing','ready_for_pickup','completed'), partnerName: fc.string({ minLength: 1 }), method: fc.constantFrom('cash_pickup','bank_transfer','mobile_money','home_delivery'), country: fc.string({ minLength: 1 }) })`
    - Assert all required field labels are present

  - [ ]* 4.3 Write property test for ready-for-pickup highlighted confirmation code (Property 6)
    - **Property 6: Ready-for-pickup receipts highlight the confirmation code**
    - **Validates: Requirements 2.4**
    - Generate remittance inputs with `status: fc.constant('ready_for_pickup')`
    - Assert a section with `highlighted: true` exists and contains the confirmation code and a pickup label

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `renderReceiptToPdf` and `downloadPdf`
  - [x] 6.1 Implement `renderReceiptToPdf(content: ReceiptContent): jsPDF` in `src/lib/receiptGenerator.ts`
    - Instantiate a `jsPDF` document (portrait, A4)
    - Render the header (brand name + generation timestamp) at the top
    - Iterate over `content.sections`, rendering each section title and its fields as label/value rows
    - Render highlighted sections with a visible border or background box
    - Render `content.notice` (if present) as a distinct notice block near the bottom
    - _Requirements: 1.3, 1.4, 1.5, 2.3, 2.4, 2.5_

  - [x] 6.2 Implement `downloadPdf(doc: jsPDF, filename: string): Promise<void>` in `src/lib/receiptGenerator.ts`
    - If `window.showSaveFilePicker` is available, use the File System Access API to open a native save dialog
    - If the user cancels (`AbortError`), silently return without error
    - If `showSaveFilePicker` throws a non-abort error, fall back to the anchor-tag download path
    - Otherwise (API not available), create a temporary `<a>` element with `href = URL.createObjectURL(blob)` and `download = filename`, click it, then revoke the object URL
    - _Requirements: 1.6, 4.5_

  - [x] 6.3 Implement the convenience wrappers `generateAndDownloadTransactionReceipt` and `generateAndDownloadRemittanceReceipt`
    - Each wrapper calls the appropriate builder, then `renderReceiptToPdf`, then `downloadPdf`
    - Wrap in try/catch; re-throw as a typed `ReceiptGenerationError` so callers can distinguish receipt errors from other errors
    - _Requirements: 1.2, 2.2_

- [x] 7. Implement `DownloadReceiptButton` component
  - [x] 7.1 Implement `src/components/DownloadReceiptButton.tsx`
    - Accept props: `transaction?: Transaction`, `remittanceTransfer?: RemittanceReceiptInput`, `senderName?: string`, `className?: string`
    - Render a `<Button>` with a `Download` icon and the label "Download Receipt"
    - Set `aria-label` to `"Download receipt for transaction " + (transaction.id ?? remittanceTransfer.id)`
    - Manage `isLoading` state: show `Loader2` spinner and disable the button while generating
    - On click, call the appropriate `generateAndDownload*` convenience wrapper
    - On `ReceiptGenerationError`, call `toast.error("Receipt download failed. Please try again.")` and re-enable the button
    - _Requirements: 1.2, 2.2, 4.1, 4.2, 4.3_

  - [ ]* 7.2 Write property test for aria-label pattern (Property 12)
    - **Property 12: Download button aria-label follows the required pattern**
    - **Validates: Requirements 4.1**
    - Use `fc.string({ minLength: 1 })` as the transaction ID
    - Render `DownloadReceiptButton` with a minimal transaction object and assert `aria-label === "Download receipt for transaction " + id`

- [x] 8. Implement receipt header correctness property test (Property 3)
  - [x]* 8.1 Write property test for receipt header brand name and timestamp (Property 3)
    - **Property 3: Receipt header always contains brand name and generation timestamp**
    - **Validates: Requirements 1.5**
    - Run against both `buildTransactionReceiptContent` (with arbitrary send/receive transactions) and `buildRemittanceReceiptContent` (with arbitrary remittance inputs)
    - Assert `header.brandName === "SwiftSend"` and `header.generatedAt` matches `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/`

- [x] 9. Implement filename pattern property test (Property 4)
  - [x]* 9.1 Write property test for filename pattern (Property 4)
    - **Property 4: Filename follows the required pattern**
    - **Validates: Requirements 1.6**
    - Use `fc.string({ minLength: 1 })` as the transaction ID
    - Assert the filename passed to `downloadPdf` equals `"receipt-" + transactionId + ".pdf"`

- [x] 10. Integrate `DownloadReceiptButton` into `TransactionItem`
  - Modify `src/components/TransactionItem.tsx` to import and render `DownloadReceiptButton` inside the `showDetailedView` block, after the fee breakdown section
  - Pass `transaction={transaction}` and `senderName` (sourced from the `useUser` / auth context, or passed as a prop from `History.tsx`)
  - _Requirements: 1.1, 1.2_

- [x] 11. Integrate `DownloadReceiptButton` into `RemittanceTracker`
  - Modify `src/components/RemittanceTracker.tsx` to import and render `DownloadReceiptButton` inside the action buttons row
  - Construct a `RemittanceReceiptInput` object from the tracker's props (`transferId`, `recipientName`, `amount`, `currency`, `confirmationCode`, `status`, `partnerName`, `method`) and pass it as `remittanceTransfer`
  - The button should be visible for all three status values (`processing`, `ready_for_pickup`, `completed`)
  - _Requirements: 2.1, 2.2_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–12 from the design document)
- Unit tests validate specific examples and edge cases
- `fast-check` is already in `devDependencies` at version `4.7.0` — no additional install needed for property tests
- `jsPDF` must be installed before any implementation tasks begin (Task 1)
- The `splitFee` utility already exists at `src/lib/fees.ts` and is used by `TransactionItem` — reuse it in the receipt builder
