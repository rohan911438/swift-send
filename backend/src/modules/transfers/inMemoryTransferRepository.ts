import { TransferRecord } from './domain';
import { TransferRepository } from './repository';

export class InMemoryTransferRepository implements TransferRepository {
  private readonly store = new Map<string, TransferRecord>();
  private readonly userIndex = new Map<string, Set<string>>();

  constructor(initialRecords: TransferRecord[] = []) {
    initialRecords.forEach((record) => {
      const cloned = this.clone(record)!;
      this.store.set(cloned.id, cloned);
      this.indexRecord(cloned);
    });
  }

  async findById(id: string) {
    return this.clone(this.store.get(id));
  }

  async findByClientReference(reference: string) {
    return this.clone(this.store.get(reference));
  }

  async save(record: TransferRecord) {
    this.store.set(record.id, this.clone(record));
    this.indexRecord(record);
    return record;
  }

  async update(record: TransferRecord) {
    if (!this.store.has(record.id)) {
      throw new Error('transfer not found');
    }
    this.store.set(record.id, this.clone(record));
    this.indexRecord(record);
    return record;
  }

  async listPending() {
    return Array.from(this.store.values())
      .filter((record) => ['held', 'submitted'].includes(record.state))
      .map((record) => this.clone(record));
  }

  async listByUserId(userId: string) {
    return this.getIndexedRecords(userId);
  }

  async listRecentByUserId(userId: string, limit = 10) {
    return this.getIndexedRecords(userId).slice(0, Math.max(0, limit));
  }

  private getIndexedRecords(userId: string) {
    const ids = Array.from(this.userIndex.get(userId) || []);
    return ids
      .map((id) => this.store.get(id))
      .filter((record): record is TransferRecord => Boolean(record))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((record) => this.clone(record));
  }

  private indexRecord(record: TransferRecord) {
    const ids = this.userIndex.get(record.userId) || new Set<string>();
    ids.add(record.id);
    this.userIndex.set(record.userId, ids);
  }

  private clone(record?: TransferRecord | null) {
    return record ? JSON.parse(JSON.stringify(record)) : null;
  }
}
