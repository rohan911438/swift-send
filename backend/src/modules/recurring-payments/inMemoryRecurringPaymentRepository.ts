import { RecurringPaymentRepository } from './repository';
import { RecurringPaymentSchedule } from './domain';

export class InMemoryRecurringPaymentRepository implements RecurringPaymentRepository {
  private schedules: Map<string, RecurringPaymentSchedule> = new Map();

  constructor(initialData: RecurringPaymentSchedule[] = []) {
    for (const item of initialData) {
      this.schedules.set(item.id, item);
    }
  }

  async save(schedule: RecurringPaymentSchedule): Promise<void> {
    this.schedules.set(schedule.id, schedule);
  }

  async findById(id: string): Promise<RecurringPaymentSchedule | null> {
    return this.schedules.get(id) || null;
  }

  async findByUserId(userId: string): Promise<RecurringPaymentSchedule[]> {
    return Array.from(this.schedules.values()).filter((s) => s.userId === userId);
  }

  async findDue(now: string): Promise<RecurringPaymentSchedule[]> {
    const nowDate = new Date(now).getTime();
    return Array.from(this.schedules.values()).filter(
      (s) => s.status === 'active' && new Date(s.nextRunAt).getTime() <= nowDate
    );
  }

  async update(schedule: RecurringPaymentSchedule): Promise<void> {
    if (this.schedules.has(schedule.id)) {
      this.schedules.set(schedule.id, schedule);
    }
  }

  async delete(id: string): Promise<void> {
    this.schedules.delete(id);
  }
}
