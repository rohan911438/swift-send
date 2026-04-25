import { RecurringPaymentService } from '../recurringPaymentService';
import { InMemoryRecurringPaymentRepository } from '../inMemoryRecurringPaymentRepository';
import { CreateRecurringPaymentCommand } from '../domain';

const mockContractService = {
  invoke: jest.fn().mockResolvedValue({ status: 'success' }),
};

describe('RecurringPaymentService', () => {
  let service: RecurringPaymentService;
  let repository: InMemoryRecurringPaymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new InMemoryRecurringPaymentRepository();
    service = new RecurringPaymentService(repository, mockContractService as any);
  });

  const validCommand: CreateRecurringPaymentCommand = {
    userId: 'user-1',
    fromWalletId: 'wallet-1',
    recipientWallet: 'wallet-2',
    amount: 100,
    currency: 'USDC',
    frequency: 'daily',
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  describe('schedulePayment', () => {
    it('should schedule a payment successfully', async () => {
      const result = await service.schedulePayment(validCommand);

      expect(result.id).toBeDefined();
      expect(result.status).toBe('active');
      expect(result.amount).toBe(100);
      expect(result.frequency).toBe('daily');
      expect(result.frequencySeconds).toBe(86400);

      const saved = await repository.findById(result.id);
      expect(saved).toBeTruthy();
    });

    it('should call the contract service to register on-chain', async () => {
      const result = await service.schedulePayment(validCommand);

      expect(mockContractService.invoke).toHaveBeenCalledWith(
        'recurring-payments',
        'schedule_payment',
        expect.arrayContaining([result.id, 'wallet-1', 'wallet-2'])
      );
    });

    it('should throw for invalid frequency', async () => {
      const invalidCommand = { ...validCommand, frequency: 'invalid' as any };
      await expect(service.schedulePayment(invalidCommand)).rejects.toThrow('Invalid frequency');
    });
  });

  describe('processDuePayments', () => {
    it('should process due payments', async () => {
      // Create a schedule that is due
      const schedule = await service.schedulePayment(validCommand);
      
      // Simulate time passed by manually updating nextRunAt
      const pastDate = new Date(Date.now() - 1000).toISOString();
      (schedule as any).nextRunAt = pastDate;
      await repository.update(schedule);

      const processedCount = await service.processDuePayments();
      expect(processedCount).toBe(1);

      const updated = await repository.findById(schedule.id);
      expect(updated?.lastRunAt).toBeDefined();
      expect(new Date(updated!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      
      expect(mockContractService.invoke).toHaveBeenCalledWith(
        'recurring-payments',
        'execute_payment',
        [schedule.id]
      );
    });

    it('should not process payments that are not due', async () => {
      await service.schedulePayment(validCommand);
      
      // Manually update nextRunAt to future
      const futureDate = new Date(Date.now() + 100000).toISOString();
      const schedules = await repository.findByUserId('user-1');
      schedules[0].nextRunAt = futureDate;
      await repository.update(schedules[0]);

      const processedCount = await service.processDuePayments();
      expect(processedCount).toBe(0);
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel a schedule', async () => {
      const schedule = await service.schedulePayment(validCommand);
      await service.cancelSchedule(schedule.id, 'user-1');

      const updated = await repository.findById(schedule.id);
      expect(updated?.status).toBe('cancelled');
      
      expect(mockContractService.invoke).toHaveBeenCalledWith(
        'recurring-payments',
        'cancel_payment',
        [schedule.id]
      );
    });

    it('should throw if schedule not found or wrong user', async () => {
      const schedule = await service.schedulePayment(validCommand);
      await expect(service.cancelSchedule(schedule.id, 'user-2')).rejects.toThrow('Schedule not found');
    });
  });
});
