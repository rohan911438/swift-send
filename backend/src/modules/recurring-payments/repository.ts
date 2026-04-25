import { RecurringPaymentSchedule } from './domain';

export interface RecurringPaymentRepository {
  save(schedule: RecurringPaymentSchedule): Promise<void>;
  findById(id: string): Promise<RecurringPaymentSchedule | null>;
  findByUserId(userId: string): Promise<RecurringPaymentSchedule[]>;
  findDue(now: string): Promise<RecurringPaymentSchedule[]>;
  update(schedule: RecurringPaymentSchedule): Promise<void>;
  delete(id: string): Promise<void>;
}
