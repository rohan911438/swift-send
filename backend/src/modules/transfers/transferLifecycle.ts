import { ValidationError } from '../../errors';
import { config } from '../../config';
import { logger } from '../../logger';
import { EventBus } from '../../core/eventBus';
import { ComplianceService } from '../compliance/complianceService';
import { WalletService } from '../wallets/walletService';
import { TransferRepository } from './repository';
import { CreateTransferCommand, TransferRecord, TransferState } from './domain';

export class TransferLifecycle {
  constructor(
    private readonly repository: TransferRepository,
    private readonly wallets: WalletService,
    private readonly compliance: ComplianceService,
    private readonly eventBus: EventBus
  ) {}

  async createTransfer(command: CreateTransferCommand) {
    this.validateCommand(command);

    const existing = await this.repository.findByClientReference(command.idempotencyKey);
    if (existing) {
      return existing;
    }

    const complianceDecision = await this.compliance.evaluateTransfer({
      userId: command.userId,
      amount: command.amount,
      currency: command.currency,
      destinationCountry: command.recipient.country,
      tierId: command.complianceTier,
    });

    if (!complianceDecision.canProceed) {
      throw new ValidationError('Compliance requirements not satisfied', complianceDecision);
    }

    const now = new Date().toISOString();
    const transfer: TransferRecord = {
      id: command.idempotencyKey,
      clientReference: command.idempotencyKey,
      userId: command.userId,
      fromWalletId: command.fromWalletId,
      recipient: command.recipient,
      amount: command.amount,
      currency: command.currency,
      state: 'created',
      statusHistory: [{ state: 'created', at: now }],
      compliance: complianceDecision,
      processingAttempts: 0,
      metadata: command.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.appendStatus(transfer, 'validated', complianceDecision.warnings.join(', ') || undefined);

    const escrow = await this.wallets.reserveFunds({
      userId: command.userId,
      walletId: command.fromWalletId,
      transferId: transfer.id,
      amount: command.amount,
      currency: command.currency,
      metadata: { reason: 'transfer_hold' },
    });

    transfer.escrowId = escrow.id;
    this.appendStatus(transfer, 'held');

    await this.repository.save(transfer);

    await this.eventBus.publish({
      type: 'transfer.created',
      timestamp: new Date().toISOString(),
      payload: { transferId: transfer.id, amount: transfer.amount, currency: transfer.currency },
    });

    this.scheduleSettlement(transfer.id);
    return transfer;
  }

  async getTransfer(id: string) {
    return this.repository.findById(id);
  }

  private validateCommand(command: CreateTransferCommand) {
    if (!command.idempotencyKey) {
      throw new ValidationError('idempotency_key is required');
    }
    if (!command.fromWalletId) {
      throw new ValidationError('from_wallet_id is required');
    }
    if (!command.amount || command.amount <= 0) {
      throw new ValidationError('amount must be greater than zero');
    }
    if (!command.currency) {
      throw new ValidationError('currency is required');
    }
    if (!command.recipient) {
      throw new ValidationError('recipient is required');
    }
  }

  private appendStatus(transfer: TransferRecord, state: TransferState, notes?: string) {
    transfer.state = state;
    transfer.statusHistory.push({ state, at: new Date().toISOString(), notes });
    transfer.updatedAt = new Date().toISOString();
  }

  private scheduleSettlement(transferId: string) {
    logger.debug({ transferId, delay: config.queues.settlementDelayMs }, 'queuing settlement attempt');
    setTimeout(() => this.settleTransfer(transferId), config.queues.settlementDelayMs);
  }

  private async settleTransfer(transferId: string) {
    const transfer = await this.repository.findById(transferId);
    if (!transfer) {
      return;
    }

    if (!['held', 'submitted'].includes(transfer.state)) {
      return;
    }

    try {
      await this.wallets.settleEscrow({
        transferId: transfer.id,
        destinationAccount: transfer.recipient.walletPublicKey || `recipient:${transfer.id}`,
        amount: transfer.amount,
        currency: transfer.currency,
        metadata: { delivery: transfer.recipient.type },
      });

      this.appendStatus(transfer, 'settled');
      transfer.processingAttempts += 1;
      await this.repository.update(transfer);
      await this.compliance.recordSuccessfulTransfer(transfer.userId, transfer.amount);
      await this.eventBus.publish({
        type: 'transfer.settled',
        timestamp: new Date().toISOString(),
        payload: { transferId: transfer.id },
      });
    } catch (err: unknown) {
      transfer.processingAttempts += 1;
      transfer.lastError = err instanceof Error ? err.message : 'unknown settlement error';
      logger.error({ transferId, err }, 'transfer settlement failed');

      if (transfer.processingAttempts >= config.queues.maxSettlementAttempts) {
        await this.wallets.refundEscrow({
          userId: transfer.userId,
          transferId: transfer.id,
          destinationAccount: transfer.fromWalletId,
          amount: transfer.amount,
          currency: transfer.currency,
          metadata: { reason: 'auto_refund' },
        });
        this.appendStatus(transfer, 'failed', transfer.lastError);
        await this.eventBus.publish({
          type: 'transfer.failed',
          timestamp: new Date().toISOString(),
          payload: { transferId: transfer.id, error: transfer.lastError },
        });
      } else {
        this.scheduleSettlement(transfer.id);
      }

      await this.repository.update(transfer);
    }
  }
}
