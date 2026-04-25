import { RecurringPaymentRepository } from './repository';
import { CreateRecurringPaymentCommand, RecurringPaymentSchedule, frequencyToSeconds } from './domain';
import { ContractService } from '../../services/contractService';
import { logger } from '../../logger';
import { ValidationError } from '../../errors';

export class RecurringPaymentService {
  constructor(
    private readonly repository: RecurringPaymentRepository,
    private readonly contracts: ContractService
  ) {}

  async schedulePayment(command: CreateRecurringPaymentCommand): Promise<RecurringPaymentSchedule> {
    const frequencySeconds = frequencyToSeconds(command.frequency, command.customFrequencySeconds);
    if (frequencySeconds <= 0) {
      throw new ValidationError('Invalid frequency');
    }

    const now = new Date();
    const id = `recur_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const schedule: RecurringPaymentSchedule = {
      id,
      userId: command.userId,
      senderWallet: command.fromWalletId,
      recipientWallet: command.recipientWallet,
      amount: command.amount,
      currency: command.currency,
      frequency: command.frequency,
      frequencySeconds,
      nextRunAt: now.toISOString(), // Start immediately or at next interval? Let's say immediately.
      endDate: command.endDate,
      status: 'active',
      metadata: command.metadata,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Store in our DB
    await this.repository.save(schedule);

    // Call contract to register schedule on-chain
    try {
      await this.contracts.invoke('recurring-payments', 'schedule_payment', [
        id,
        command.fromWalletId,
        command.recipientWallet,
        'USDC_ASSET_ID', // Mock asset ID
        command.amount,
        frequencySeconds,
        Math.floor(new Date(command.endDate).getTime() / 1000),
      ]);
    } catch (err) {
      logger.error({ err, id }, 'failed to register schedule on-chain');
      // We still keep it in our DB, but mark as failed or just log? 
      // For this demo, we'll proceed.
    }

    return schedule;
  }

  async getSchedulesForUser(userId: string): Promise<RecurringPaymentSchedule[]> {
    return this.repository.findByUserId(userId);
  }

  async cancelSchedule(id: string, userId: string): Promise<void> {
    const schedule = await this.repository.findById(id);
    if (!schedule || schedule.userId !== userId) {
      throw new ValidationError('Schedule not found');
    }

    schedule.status = 'cancelled';
    schedule.updatedAt = new Date().toISOString();
    await this.repository.update(schedule);

    try {
      await this.contracts.invoke('recurring-payments', 'cancel_payment', [id]);
    } catch (err) {
      logger.error({ err, id }, 'failed to cancel schedule on-chain');
    }
  }

  async processDuePayments(): Promise<number> {
    const now = new Date();
    const dueSchedules = await this.repository.findDue(now.toISOString());
    
    let processedCount = 0;
    for (const schedule of dueSchedules) {
      try {
        logger.info({ scheduleId: schedule.id }, 'processing due recurring payment');
        
        // 1. Execute on-chain
        await this.contracts.invoke('recurring-payments', 'execute_payment', [schedule.id]);
        
        // 2. Update schedule in DB
        schedule.lastRunAt = now.toISOString();
        const nextRun = new Date(now.getTime() + schedule.frequencySeconds * 1000);
        schedule.nextRunAt = nextRun.toISOString();
        
        if (nextRun.getTime() >= new Date(schedule.endDate).getTime()) {
          schedule.status = 'completed';
        }
        
        schedule.updatedAt = now.toISOString();
        await this.repository.update(schedule);
        processedCount++;
        
      } catch (err) {
        logger.error({ err, scheduleId: schedule.id }, 'failed to process recurring payment');
        // Optionally mark as failed after N retries
      }
    }
    
    return processedCount;
  }
}
