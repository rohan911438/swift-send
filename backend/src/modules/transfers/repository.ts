import { TransferRecord } from './domain';

export interface TransferRepository {
  findById(id: string): Promise<TransferRecord | null>;
  findByClientReference(reference: string): Promise<TransferRecord | null>;
  save(record: TransferRecord): Promise<TransferRecord>;
  update(record: TransferRecord): Promise<TransferRecord>;
  listPending(): Promise<TransferRecord[]>;
  listByUserId(userId: string): Promise<TransferRecord[]>;
  listRecentByUserId(userId: string, limit?: number): Promise<TransferRecord[]>;
}
