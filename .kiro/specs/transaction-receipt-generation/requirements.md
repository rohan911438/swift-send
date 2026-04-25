# Requirements Document

## Introduction

SwiftSend users currently have no way to download or save proof of their transactions. This feature adds transaction receipt generation to the SwiftSend remittance application, allowing users to generate and download a PDF receipt for any completed or in-progress transaction. Receipts are accessible from the Transaction History page and the Remittance Status page, and include all relevant transaction details needed for record-keeping or dispute resolution.

## Glossary

- **Receipt**: A PDF document summarising the details of a single transaction, suitable for record-keeping or sharing.
- **Receipt_Generator**: The client-side service responsible for composing and rendering receipt content into a downloadable PDF file.
- **Transaction**: A record of a send or receive money operation, as represented by the `Transaction` type in the application.
- **Transaction_History_Page**: The `/history` route in the SwiftSend application where users view past transactions.
- **Remittance_Status_Page**: The `/remittance` route where users track active transfers.
- **Download_Button**: The UI control that triggers receipt generation and initiates a file download.
- **Fee_Breakdown**: The itemised list of network fee, service fee, and total cost associated with a sent transaction.
- **Confirmation_Code**: The unique alphanumeric code assigned to a remittance transfer (e.g. `SWJG7890`).
- **Sender**: The authenticated user who initiated the transaction.
- **Recipient**: The person or entity receiving the funds.

---

## Requirements

### Requirement 1: Download Receipt from Transaction History

**User Story:** As a SwiftSend user, I want to download a receipt for any transaction in my history, so that I have a record of my transfers for personal or financial purposes.

#### Acceptance Criteria

1. WHEN a user expands a transaction in the Transaction_History_Page, THE Download_Button SHALL be displayed within the detailed view of that transaction.
2. WHEN a user clicks the Download_Button for a transaction, THE Receipt_Generator SHALL produce a PDF receipt and initiate a browser file download within 3 seconds.
3. THE Receipt_Generator SHALL include the following fields in every receipt: transaction ID, transaction date and time, sender name, recipient name, recipient phone number, transaction type (send or receive), amount sent, destination currency and amount received, exchange rate, fee breakdown (network fee, service fee, total fee), total cost to sender, and transaction status.
4. IF the transaction type is "receive", THEN THE Receipt_Generator SHALL omit the fee breakdown section and display only the amount received and sender information.
5. THE Receipt_Generator SHALL display the SwiftSend brand name and a receipt generation timestamp in the PDF header.
6. THE Receipt_Generator SHALL name the downloaded file using the pattern `receipt-{transactionId}.pdf`.

---

### Requirement 2: Download Receipt from Remittance Status

**User Story:** As a SwiftSend user, I want to download a receipt for an active or completed remittance transfer, so that I can share proof of payment with the recipient or a third party.

#### Acceptance Criteria

1. WHEN a transfer is displayed on the Remittance_Status_Page, THE Download_Button SHALL be visible on the transfer card regardless of the transfer's current status.
2. WHEN a user clicks the Download_Button on a remittance transfer card, THE Receipt_Generator SHALL produce a PDF receipt and initiate a browser file download within 3 seconds.
3. THE Receipt_Generator SHALL include the following fields for remittance receipts: transfer ID, confirmation code, date and time initiated, recipient name, destination country, transfer method (e.g. cash pickup, mobile money), partner name, amount sent, destination currency and amount received, and current transfer status.
4. WHEN the transfer status is "ready_for_pickup", THE Receipt_Generator SHALL include the confirmation code prominently in the receipt with a label indicating it is required for cash pickup.
5. THE Receipt_Generator SHALL display the current transfer status in the receipt using human-readable labels: "Processing", "Ready for Pickup", or "Completed".

---

### Requirement 3: Receipt Content Accuracy

**User Story:** As a SwiftSend user, I want the receipt to accurately reflect the transaction data shown in the application, so that I can trust the document for financial record-keeping.

#### Acceptance Criteria

1. THE Receipt_Generator SHALL render all monetary amounts in the receipt to exactly 2 decimal places.
2. THE Receipt_Generator SHALL render the transaction date and time in the user's local timezone using the ISO 8601 format `YYYY-MM-DD HH:mm:ss`.
3. WHEN a transaction has a non-zero exchange rate, THE Receipt_Generator SHALL display the exchange rate in the format `1 USD = {rate} {destinationCurrency}`.
4. THE Receipt_Generator SHALL display the transaction ID in full without truncation.
5. IF a transaction has a risk flag with level "high" or "medium", THEN THE Receipt_Generator SHALL include a notice in the receipt stating "This transaction was subject to additional review."

---

### Requirement 4: Receipt Accessibility and Usability

**User Story:** As a SwiftSend user, I want the receipt download to work reliably across devices, so that I can save receipts on both mobile and desktop.

#### Acceptance Criteria

1. THE Download_Button SHALL be accessible via keyboard navigation and SHALL have an accessible label of "Download receipt for transaction {transactionId}".
2. WHEN the Receipt_Generator is producing a PDF, THE Download_Button SHALL display a loading indicator and SHALL be disabled to prevent duplicate downloads.
3. WHEN PDF generation fails for any reason, THE Receipt_Generator SHALL display an error notification to the user with the message "Receipt download failed. Please try again." and SHALL re-enable the Download_Button.
4. THE Receipt_Generator SHALL generate the PDF entirely in the browser without transmitting transaction data to any external third-party service.
5. WHERE the user's browser supports the File System Access API, THE Receipt_Generator SHALL use the browser's native save dialog; otherwise THE Receipt_Generator SHALL fall back to an anchor-tag download.
