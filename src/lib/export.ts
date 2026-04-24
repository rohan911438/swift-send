import { Transaction } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * Downloads the given transactions as a CSV file.
 */
export function exportToCSV(transactions: Transaction[], filename: string = 'transaction_history.csv') {
  if (transactions.length === 0) return;

  const headers = ['Date', 'Type', 'Amount', 'Recipient Name', 'Recipient Phone', 'Status', 'Transaction ID'];
  
  const rows = transactions.map(t => [
    new Date(t.timestamp).toISOString(),
    t.type,
    t.amount.toString(),
    // Escape string in case commas are present
    `"${t.recipientName}"`,
    `"${t.recipientPhone}"`,
    t.status,
    t.id
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads the given transactions as a styled PDF file.
 */
export function exportToPDF(transactions: Transaction[], filename: string = 'transaction_history.pdf') {
  if (transactions.length === 0) return;

  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('Transaction History Report', 14, 22);

  // Subtitle
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 30);
  doc.text(`Total Records: ${transactions.length}`, 14, 36);

  // Table Data
  const tableColumn = ['Date', 'Type', 'Amount', 'Recipient', 'Status'];
  const tableRows = transactions.map(t => [
    format(new Date(t.timestamp), 'PP'),
    t.type.toUpperCase(),
    `$${t.amount.toFixed(2)}`,
    t.recipientName,
    t.status.toUpperCase(),
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 44,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [40, 116, 166] },
    alternateRowStyles: { fillColor: [242, 243, 244] },
  });

  doc.save(filename);
}
