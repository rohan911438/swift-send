import type { Transaction } from '@/types';
import { splitFee } from '@/lib/fees';
import { jsPDF } from 'jspdf';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

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
    brandName: string;    // "SwiftSend"
    generatedAt: string;  // formatted timestamp
  };
  sections: ReceiptSection[];
  notice?: string;        // optional risk notice
}

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

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ReceiptGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ReceiptGenerationError';
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (stubs — implemented in Task 2)
// ---------------------------------------------------------------------------

/**
 * Format a Date as "YYYY-MM-DD HH:mm:ss" in the user's local timezone.
 */
export function formatReceiptDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format a monetary amount to exactly 2 decimal places.
 * Optionally appends the currency code.
 * Guards NaN/Infinity with a "0.00" fallback.
 */
export function formatReceiptAmount(amount: number, currency?: string): string {
  if (!Number.isFinite(amount)) {
    return currency ? `0.00 ${currency}` : '0.00';
  }
  // toFixed(2) produces scientific notation for |amount| >= 1e21.
  // For such large values, convert to a plain decimal string first.
  let formatted: string;
  if (Math.abs(amount) >= 1e21) {
    // Use toPrecision with enough significant digits, then strip trailing zeros
    // and ensure exactly 2 decimal places.
    // toPrecision(21) gives a plain decimal string for numbers up to ~1e20.
    // For numbers >= 1e21, we accept integer-level precision (no fractional cents).
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    // Convert to integer string (these numbers have no meaningful fractional part)
    const intStr = abs.toLocaleString('fullwide', { maximumFractionDigits: 0, useGrouping: false });
    formatted = `${sign}${intStr}.00`;
  } else {
    formatted = amount.toFixed(2);
  }
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Format an exchange rate as "1 USD = {rate} {destinationCurrency}".
 */
export function formatExchangeRate(rate: number, destinationCurrency: string): string {
  return `1 USD = ${rate} ${destinationCurrency}`;
}

// ---------------------------------------------------------------------------
// Content builders (stubs — implemented in Tasks 3 & 4)
// ---------------------------------------------------------------------------

/**
 * Build a ReceiptContent from a Transaction object.
 * For send transactions, includes fee breakdown.
 * For receive transactions, omits fee breakdown.
 */
export function buildTransactionReceiptContent(
  transaction: Transaction,
  senderName: string
): ReceiptContent {
  const header = {
    brandName: 'SwiftSend',
    generatedAt: formatReceiptDate(new Date()),
  };

  const sections: ReceiptSection[] = [];

  if (transaction.type === 'send') {
    // Section: Transaction Details
    const detailsFields: ReceiptField[] = [
      { label: 'Transaction ID', value: transaction.id },
      { label: 'Date & Time', value: formatReceiptDate(transaction.timestamp) },
      { label: 'Type', value: 'Send' },
      { label: 'Status', value: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) },
    ];
    sections.push({ title: 'Transaction Details', fields: detailsFields });

    // Section: Parties
    const partiesFields: ReceiptField[] = [
      { label: 'Sender', value: senderName },
      { label: 'Recipient', value: transaction.recipientName },
      { label: 'Recipient Phone', value: transaction.recipientPhone },
    ];
    sections.push({ title: 'Parties', fields: partiesFields });

    // Section: Amount
    const amountFields: ReceiptField[] = [
      { label: 'Amount Sent', value: formatReceiptAmount(transaction.amount, 'USDC') },
    ];
    if (transaction.exchangeRate && transaction.exchangeRate > 0) {
      amountFields.push({
        label: 'Exchange Rate',
        value: formatExchangeRate(transaction.exchangeRate, transaction.destinationCurrency ?? ''),
      });
    }
    if (transaction.recipientAmount != null && transaction.destinationCurrency) {
      amountFields.push({
        label: 'Recipient Receives',
        value: formatReceiptAmount(transaction.recipientAmount, transaction.destinationCurrency),
      });
    }
    sections.push({ title: 'Amount', fields: amountFields });

    // Section: Fee Breakdown
    const { networkFee, serviceFee } = splitFee(transaction.fee, { network: 1, service: 4 });
    const feeFields: ReceiptField[] = [
      { label: 'Network Fee', value: formatReceiptAmount(networkFee, 'USDC') },
      { label: 'Service Fee', value: formatReceiptAmount(serviceFee, 'USDC') },
      { label: 'Total Fee', value: formatReceiptAmount(transaction.fee, 'USDC') },
      { label: 'Total Cost', value: formatReceiptAmount(transaction.amount + transaction.fee, 'USDC') },
    ];
    sections.push({ title: 'Fee Breakdown', fields: feeFields });
  } else {
    // type === 'receive'

    // Section: Transaction Details
    const detailsFields: ReceiptField[] = [
      { label: 'Transaction ID', value: transaction.id },
      { label: 'Date & Time', value: formatReceiptDate(transaction.timestamp) },
      { label: 'Type', value: 'Receive' },
      { label: 'Status', value: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1) },
    ];
    sections.push({ title: 'Transaction Details', fields: detailsFields });

    // Section: Parties
    const partiesFields: ReceiptField[] = [
      { label: 'Sender', value: senderName },
      { label: 'Recipient', value: transaction.recipientName },
      { label: 'Recipient Phone', value: transaction.recipientPhone },
    ];
    sections.push({ title: 'Parties', fields: partiesFields });

    // Section: Amount (no fee breakdown)
    const amountFields: ReceiptField[] = [
      { label: 'Amount Received', value: formatReceiptAmount(transaction.amount, 'USDC') },
    ];
    sections.push({ title: 'Amount', fields: amountFields });
  }

  // Risk notice
  const riskLevel = transaction.risk?.level;
  const notice =
    riskLevel === 'high' || riskLevel === 'medium'
      ? 'This transaction was subject to additional review.'
      : undefined;

  return { header, sections, notice };
}

// ---------------------------------------------------------------------------
// Human-readable label helpers
// ---------------------------------------------------------------------------

function formatRemittanceStatus(status: RemittanceReceiptInput['status']): string {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'ready_for_pickup':
      return 'Ready for Pickup';
    case 'completed':
      return 'Completed';
  }
}

function formatTransferMethod(method: RemittanceReceiptInput['method']): string {
  switch (method) {
    case 'cash_pickup':
      return 'Cash Pickup';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'mobile_money':
      return 'Mobile Money';
    case 'home_delivery':
      return 'Home Delivery';
  }
}

/**
 * Build a ReceiptContent from a RemittanceReceiptInput.
 */
export function buildRemittanceReceiptContent(
  transfer: RemittanceReceiptInput
): ReceiptContent {
  const header = {
    brandName: 'SwiftSend',
    generatedAt: formatReceiptDate(new Date()),
  };

  const sections: ReceiptSection[] = [];

  // Section: Transfer Details
  const transferDetailsFields: ReceiptField[] = [
    { label: 'Transfer ID', value: transfer.id },
    {
      label: 'Date Initiated',
      value: transfer.createdAt ? formatReceiptDate(transfer.createdAt) : 'N/A',
    },
    { label: 'Status', value: formatRemittanceStatus(transfer.status) },
  ];

  // Confirmation code placement depends on status
  if (transfer.status !== 'ready_for_pickup') {
    transferDetailsFields.push({
      label: 'Confirmation Code',
      value: transfer.confirmationCode,
    });
  }

  sections.push({ title: 'Transfer Details', fields: transferDetailsFields });

  // Section: Recipient
  const recipientFields: ReceiptField[] = [
    { label: 'Recipient Name', value: transfer.recipientName },
    { label: 'Destination Country', value: transfer.country },
    { label: 'Transfer Method', value: formatTransferMethod(transfer.method) },
    { label: 'Partner', value: transfer.partnerName },
  ];
  sections.push({ title: 'Recipient', fields: recipientFields });

  // Section: Amount
  const amountFields: ReceiptField[] = [
    { label: 'Amount Sent', value: formatReceiptAmount(transfer.amount, 'USDC') },
    { label: 'Destination Currency', value: transfer.currency },
  ];
  sections.push({ title: 'Amount', fields: amountFields });

  // Confirmation Code section (highlighted) — only for ready_for_pickup
  if (transfer.status === 'ready_for_pickup') {
    sections.push({
      title: 'Confirmation Code',
      highlighted: true,
      fields: [
        { label: 'Code', value: transfer.confirmationCode },
        { label: 'Required for', value: 'Cash Pickup' },
      ],
    });
  }

  return { header, sections };
}

// ---------------------------------------------------------------------------
// PDF rendering and download (Task 6)
// ---------------------------------------------------------------------------

// A4 dimensions in mm
const PAGE_WIDTH = 210;
// PAGE_HEIGHT = 297 (not used directly; PAGE_OVERFLOW_THRESHOLD guards page breaks)
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PAGE_OVERFLOW_THRESHOLD = 270;

/**
 * Render a ReceiptContent to a jsPDF document instance.
 */
export function renderReceiptToPdf(content: ReceiptContent): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = MARGIN_TOP;

  // ---- Header ----
  // Brand name: bold, size 18
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(content.header.brandName, MARGIN_LEFT, y);
  y += 8;

  // "Receipt" label: normal, size 12
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Receipt', MARGIN_LEFT, y);

  // "Generated: ..." right-aligned, size 9
  doc.setFontSize(9);
  const generatedText = `Generated: ${content.header.generatedAt}`;
  const textWidth = doc.getTextWidth(generatedText);
  doc.text(generatedText, PAGE_WIDTH - MARGIN_RIGHT - textWidth, y);
  y += 6;

  // Horizontal line below header
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6;

  // ---- Sections ----
  for (const section of content.sections) {
    // Page overflow check before starting a section
    if (y > PAGE_OVERFLOW_THRESHOLD) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    if (section.highlighted) {
      // Draw a light gray background rectangle behind the section
      const sectionHeight = (section.title ? 7 : 0) + section.fields.length * 6 + 4;
      doc.setFillColor(240, 240, 240);
      doc.rect(MARGIN_LEFT - 2, y - 3, CONTENT_WIDTH + 4, sectionHeight, 'F');
    }

    // Section title
    if (section.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(section.title, MARGIN_LEFT, y);
      y += 7;
    }

    // Fields
    for (const field of section.fields) {
      // Page overflow check per field
      if (y > PAGE_OVERFLOW_THRESHOLD) {
        doc.addPage();
        y = MARGIN_TOP;
      }

      doc.setFontSize(10);
      // Label in bold
      doc.setFont('helvetica', 'bold');
      const labelText = `${field.label}: `;
      doc.text(labelText, MARGIN_LEFT, y);
      // Value in normal, offset by label width
      doc.setFont('helvetica', 'normal');
      const labelWidth = doc.getTextWidth(labelText);
      doc.text(field.value, MARGIN_LEFT + labelWidth, y);
      y += 6;
    }

    // Spacing between sections
    y += 4;
  }

  // ---- Notice ----
  if (content.notice) {
    // Place near the bottom; if we're already past the threshold, add a new page
    if (y > PAGE_OVERFLOW_THRESHOLD) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    // Draw a separator line before the notice
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(`\u26A0 ${content.notice}`, MARGIN_LEFT, y);
  }

  return doc;
}

/**
 * Trigger a browser download of a jsPDF document.
 * Uses the File System Access API when available, with an anchor-tag fallback.
 */
export async function downloadPdf(doc: jsPDF, filename: string): Promise<void> {
  // Try File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as Window & typeof globalThis & {
        showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'PDF files',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      const blob = doc.output('blob');
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled — silently return
        return;
      }
      // Non-abort error: fall through to anchor-tag fallback
    }
  }

  // Anchor-tag fallback
  const blob = doc.output('blob');
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

// ---------------------------------------------------------------------------
// Convenience wrappers (Task 6)
// ---------------------------------------------------------------------------

/**
 * Build, render, and download a receipt for a Transaction in one call.
 */
export async function generateAndDownloadTransactionReceipt(
  transaction: Transaction,
  senderName: string
): Promise<void> {
  try {
    const content = buildTransactionReceiptContent(transaction, senderName);
    const doc = renderReceiptToPdf(content);
    await downloadPdf(doc, `receipt-${transaction.id}.pdf`);
  } catch (error) {
    throw new ReceiptGenerationError('Failed to generate receipt', error);
  }
}

/**
 * Build, render, and download a receipt for a remittance transfer in one call.
 */
export async function generateAndDownloadRemittanceReceipt(
  transfer: RemittanceReceiptInput
): Promise<void> {
  try {
    const content = buildRemittanceReceiptContent(transfer);
    const doc = renderReceiptToPdf(content);
    await downloadPdf(doc, `receipt-${transfer.id}.pdf`);
  } catch (error) {
    throw new ReceiptGenerationError('Failed to generate receipt', error);
  }
}
