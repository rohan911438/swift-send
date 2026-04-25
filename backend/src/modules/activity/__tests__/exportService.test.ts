import { ExportService } from '../exportService';
import { ActivityTransactionDto } from '../activityService';

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  const mockTransactions: ActivityTransactionDto[] = [
    {
      id: 'tx_123',
      type: 'send',
      amount: 100.5,
      fee: 2.5,
      recipientAmount: 98,
      recipientName: 'John Doe',
      recipientPhone: '+123456789',
      status: 'completed',
      timestamp: new Date().toISOString(),
      category: 'General transfers',
      notes: 'Test payment',
    },
    {
      id: 'tx_456',
      type: 'send',
      amount: 50,
      fee: 1,
      recipientAmount: 49,
      recipientName: 'Jane Smith',
      recipientPhone: '+987654321',
      status: 'pending',
      timestamp: new Date().toISOString(),
      category: 'Rent',
    },
  ];

  it('should generate an Excel buffer successfully', async () => {
    const buffer = await exportService.generateTransactionExcel(mockTransactions);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    // Excel files (xlsx) start with 'PK' (0x50 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4B);
  });

  it('should handle empty transaction list', async () => {
    const buffer = await exportService.generateTransactionExcel([]);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });
});
