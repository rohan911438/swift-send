import { TransferLifecycle } from '../transferLifecycle';
import { InMemoryTransferRepository } from '../inMemoryTransferRepository';
import { CreateTransferCommand, TransferRecord } from '../domain';

// Mock services
const mockWalletService = {
  reserveFunds: jest.fn().mockResolvedValue({ id: 'escrow-123' }),
  settleEscrow: jest.fn().mockResolvedValue({}),
  refundEscrow: jest.fn().mockResolvedValue({}),
};

const mockComplianceService = {
  evaluateTransfer: jest.fn().mockResolvedValue({
    canProceed: true,
    warnings: [],
    requiresEnhancedVerification: false,
  }),
  recordSuccessfulTransfer: jest.fn().mockResolvedValue({}),
};

const mockEventBus = {
  publish: jest.fn().mockResolvedValue({}),
};

describe('TransferLifecycle', () => {
  let transferLifecycle: TransferLifecycle;
  let mockRepository: InMemoryTransferRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = new InMemoryTransferRepository();
    transferLifecycle = new TransferLifecycle(
      mockRepository,
      mockWalletService as any,
      mockComplianceService as any,
      mockEventBus as any
    );
  });

  describe('createTransfer', () => {
    const validCommand: CreateTransferCommand = {
      idempotencyKey: 'test-key-123',
      fromWalletId: 'wallet-1',
      userId: 'user-1',
      amount: 100,
      currency: 'USDC',
      recipient: {
        type: 'wallet',
        walletPublicKey: 'GTEST123...',
      },
    };

    it('should create a new transfer successfully', async () => {
      const result = await transferLifecycle.createTransfer(validCommand);

      expect(result.id).toBe('test-key-123');
      expect(result.state).toBe('held');
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('USDC');
      expect(result.fromWalletId).toBe('wallet-1');
      expect(result.userId).toBe('user-1');
      expect(result.clientReference).toBe('test-key-123');
    });

    it('should return existing transfer for duplicate idempotency key', async () => {
      // Create first transfer
      const firstResult = await transferLifecycle.createTransfer(validCommand);

      // Attempt to create with same idempotency key
      const secondResult = await transferLifecycle.createTransfer(validCommand);

      expect(secondResult.id).toBe(firstResult.id);
      expect(secondResult.state).toBe(firstResult.state);
    });

    it('should validate required fields', async () => {
      const invalidCommand = {
        ...validCommand,
        amount: 0, // Invalid amount
      };

      await expect(transferLifecycle.createTransfer(invalidCommand))
        .rejects.toThrow('amount must be greater than zero');
    });

    it('should validate currency', async () => {
      const invalidCommand = {
        ...validCommand,
        currency: 'INVALID',
      };

      await expect(transferLifecycle.createTransfer(invalidCommand))
        .rejects.toThrow('Unsupported currency: INVALID');
    });

    it('should validate recipient type', async () => {
      const invalidCommand = {
        ...validCommand,
        recipient: {
          type: 'invalid' as any,
        },
      };

      await expect(transferLifecycle.createTransfer(invalidCommand))
        .rejects.toThrow('Invalid recipient type: invalid');
    });

    it('should validate wallet recipient has public key', async () => {
      const invalidCommand = {
        ...validCommand,
        recipient: {
          type: 'wallet' as const,
          // Missing walletPublicKey
        },
      };

      await expect(transferLifecycle.createTransfer(invalidCommand))
        .rejects.toThrow('Wallet recipient must have walletPublicKey');
    });

    it('should validate cash pickup recipient has required fields', async () => {
      const invalidCommand = {
        ...validCommand,
        recipient: {
          type: 'cash_pickup' as const,
          // Missing partnerCode and country
        },
      };

      await expect(transferLifecycle.createTransfer(invalidCommand))
        .rejects.toThrow('Cash pickup recipient must have partnerCode and country');
    });

    it('should set initial status entries', async () => {
      const result = await transferLifecycle.createTransfer(validCommand);

      expect(result.statusHistory).toHaveLength(3); // created + validated + held
      expect(result.statusHistory[0].state).toBe('created');
      expect(result.statusHistory[0].at).toBeDefined();
      expect(result.statusHistory[1].state).toBe('validated');
      expect(result.statusHistory[2].state).toBe('held');
    });

    it('should handle different recipient types', async () => {
      // Test cash pickup recipient
      const cashPickupCommand = {
        ...validCommand,
        idempotencyKey: 'cash-pickup-test',
        recipient: {
          type: 'cash_pickup' as const,
          partnerCode: 'MONEYGRAM',
          country: 'US',
        },
      };

      const cashPickupResult = await transferLifecycle.createTransfer(cashPickupCommand);
      expect(cashPickupResult.recipient.type).toBe('cash_pickup');
      expect(cashPickupResult.recipient.partnerCode).toBe('MONEYGRAM');

      // Test bank recipient
      const bankCommand = {
        ...validCommand,
        idempotencyKey: 'bank-test-key',
        recipient: {
          type: 'bank' as const,
          partnerCode: 'WISE',
          country: 'UK',
        },
      };

      const bankResult = await transferLifecycle.createTransfer(bankCommand);
      expect(bankResult.recipient.type).toBe('bank');
      expect(bankResult.recipient.partnerCode).toBe('WISE');
    });

    it('should call compliance service', async () => {
      await transferLifecycle.createTransfer(validCommand);

      expect(mockComplianceService.evaluateTransfer).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: 100,
        currency: 'USDC',
        destinationCountry: undefined,
        tierId: undefined,
      });
    });

    it('should reserve funds through wallet service', async () => {
      await transferLifecycle.createTransfer(validCommand);

      expect(mockWalletService.reserveFunds).toHaveBeenCalledWith({
        userId: 'user-1',
        walletId: 'wallet-1',
        transferId: 'test-key-123',
        amount: 100,
        currency: 'USDC',
        metadata: { reason: 'transfer_hold' },
      });
    });

    it('should publish transfer created event', async () => {
      await transferLifecycle.createTransfer(validCommand);

      expect(mockEventBus.publish).toHaveBeenCalledWith({
        type: 'transfer.created',
        timestamp: expect.any(String),
        payload: { transferId: 'test-key-123', amount: 100, currency: 'USDC' },
      });
    });
  });

  describe('getTransfer', () => {
    it('should retrieve existing transfer', async () => {
      const command: CreateTransferCommand = {
        idempotencyKey: 'test-key-123',
        fromWalletId: 'wallet-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet',
          walletPublicKey: 'GTEST123...',
        },
      };

      const created = await transferLifecycle.createTransfer(command);
      const retrieved = await transferLifecycle.getTransfer(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent transfer', async () => {
      const result = await transferLifecycle.getTransfer('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('validation edge cases', () => {
    it('should reject negative amounts', async () => {
      const command = {
        idempotencyKey: 'test-key',
        fromWalletId: 'wallet-1',
        userId: 'user-1',
        amount: -100,
        currency: 'USDC',
        recipient: {
          type: 'wallet' as const,
          walletPublicKey: 'GTEST123...',
        },
      };

      await expect(transferLifecycle.createTransfer(command))
        .rejects.toThrow('amount must be greater than zero');
    });

    it('should reject very large amounts', async () => {
      const command = {
        idempotencyKey: 'test-key',
        fromWalletId: 'wallet-1',
        userId: 'user-1',
        amount: 1000000000, // Very large amount
        currency: 'USDC',
        recipient: {
          type: 'wallet' as const,
          walletPublicKey: 'GTEST123...',
        },
      };

      await expect(transferLifecycle.createTransfer(command))
        .rejects.toThrow('Amount exceeds maximum limit');
    });

    it('should handle missing required fields', async () => {
      const command = {
        idempotencyKey: '',
        fromWalletId: 'wallet-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USDC',
        recipient: {
          type: 'wallet' as const,
          walletPublicKey: 'GTEST123...',
        },
      };

      await expect(transferLifecycle.createTransfer(command))
        .rejects.toThrow('idempotency_key is required');
    });
  });
});