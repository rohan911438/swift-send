import ExcelJS from 'exceljs';
import { ActivityTransactionDto } from './activityService';

export class ExportService {
  async generateTransactionExcel(transactions: ActivityTransactionDto[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SwiftSend';
    workbook.lastModifiedBy = 'SwiftSend System';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Transactions');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 35 },
      { header: 'Date', key: 'timestamp', width: 25 },
      { header: 'Recipient', key: 'recipientName', width: 25 },
      { header: 'Phone/Identifier', key: 'recipientPhone', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Fee', key: 'fee', width: 10 },
      { header: 'Recipient Gets', key: 'recipientAmount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    transactions.forEach((tx) => {
      const row = sheet.addRow({
        ...tx,
        timestamp: new Date(tx.timestamp).toLocaleString(),
        status: tx.status.toUpperCase(),
      });

      // Conditional status colors
      const statusCell = row.getCell('status');
      if (tx.status === 'completed') {
        statusCell.font = { color: { argb: 'FF059669' }, bold: true }; // Green-600
      } else if (tx.status === 'failed') {
        statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red-600
      } else {
        statusCell.font = { color: { argb: 'FFD97706' }, bold: true }; // Amber-600
      }
    });

    // Formatting numbers
    sheet.getColumn('amount').numFmt = '"$"#,##0.00';
    sheet.getColumn('fee').numFmt = '"$"#,##0.00';
    sheet.getColumn('recipientAmount').numFmt = '"$"#,##0.00';

    // Borders for all data cells
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
