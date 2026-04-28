import { ValidationError } from '../../errors';
import { config } from '../../config';
import { createLogger } from '../../logger';
import { EventBus } from '../../core/eventBus';
import { ComplianceService } from '../compliance/complianceService';
import { FraudService } from '../fraud/fraudService';
import { WalletService } from '../wallets/walletService';
import { TransferRepository } from './repository';
import { CreateTransferCommand, TransferRecord, TransferState } from './domain';
import { TransferEventType } from './events';

export class TransferLifecycle {
  constructor(
    private readonly repository: TransferRepository,
    private readonly wallets: WalletService,
    private readonly compliance: ComplianceService,
    private readonly fraud: FraudService,
    private readonly eventBus: EventBus,
  ) {}

  async createTransfer(command: CreateTransferCommand) {
    const transferLogger = this.getLogger({
      transferId: command.idempotencyKey,
      userId: command.userId,
    });
    this.validateCommand(command);

    const existing = await this.repository.findByClientReference(command.idempotencyKey);
    if (existing) {
      transferLogger.info({ state: existing.state }, 'idempotent transfer replayed');
      return existing;
    }

    const complianceDecision = await this.compliance.evaluateTransfer({
      userId: command.userId,
      amount: command.amount,
      currency: command.currency,
      destinationCountry: command.recipient.country,
      tierId: command.complianceTier,
    });
    const historicalTransfers = await this.repository.listRecentByUserId(command.userId, 25);
    this.enforceVelocityLimits(command, complianceDecision.tier, historicalTransfers, transferLogger);
    const fraudAssessment = this.fraud.assessTransfer({
      userId: command.userId,
      transferId: command.idempotencyKey,
      amount: command.amount,
      destinationCountry: command.recipient.country,
      recipientType: command.recipient.type,
      historicalTransfers,
    });
    const enrichedCompliance = {
      ...complianceDecision,
      warnings: [
        ...complianceDecision.warnings,
        ...fraudAssessment.flags.map((flag) => `Fraud flag: ${flag.label}`),
      ],
    };

    if (!enrichedCompliance.canProceed) {
      transferLogger.warn(
        {
          blockers: enrichedCompliance.blockers,
          warnings: enrichedCompliance.warnings,
        },
        'transfer blocked by compliance',
      );
      throw new ValidationError('Compliance requirements not satisfied', enrichedCompliance);
    }

    const now = new Date().toISOString();
    const multisig = this.normalizeMultisig(command);
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
      compliance: enrichedCompliance,
      fraud: fraudAssessment,
      multisig,
      processingAttempts: 0,
      metadata: command.metadata,
      createdAt: now,
      updatedAt: now,
    };

    if (transfer.multisig && transfer.multisig.approvals.length < transfer.multisig.threshold) {
      this.appendStatus(
        transfer,
        'awaiting_multisig',
        `Waiting for ${transfer.multisig.threshold} approvals from ${transfer.multisig.signers.length} signers`,
      );
      await this.repository.save(transfer);
      await this.eventBus.publish({
        type: TransferEventType.Created,
        timestamp: new Date().toISOString(),
        payload: {
          userId: transfer.userId,
          transferId: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          recipientName: this.recipientName(transfer),
        },
      });
      return transfer;
    }

    this.appendStatus(transfer, 'validated', enrichedCompliance.warnings.join(', ') || undefined);

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
      type: TransferEventType.Created,
      timestamp: new Date().toISOString(),
      payload: {
        userId: transfer.userId,
        transferId: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        recipientName: this.recipientName(transfer),
      },
    });

    transferLogger.info(
      {
        amount: transfer.amount,
        currency: transfer.currency,
        recipientType: transfer.recipient.type,
      },
      'transfer created',
    );

    if (fraudAssessment.flags.length > 0 || fraudAssessment.requiresReview) {
      await this.eventBus.publish({
        type: TransferEventType.Flagged,
        timestamp: new Date().toISOString(),
        payload: {
          userId: transfer.userId,
          transferId: transfer.id,
          assessment: fraudAssessment,
          amount: transfer.amount,
          currency: transfer.currency,
          recipientName: this.recipientName(transfer),
        },
      });
    }

    this.scheduleSettlement(transfer.id);
    return transfer;
  }

  async getTransfer(id: string) {
    return this.repository.findById(id);
  }

  async simulateTransfer(command: CreateTransferCommand) {
    this.validateCommand(command);
    const complianceDecision = await this.compliance.evaluateTransfer({
      userId: command.userId,
      amount: command.amount,
      currency: command.currency,
      destinationCountry: command.recipient.country,
      tierId: command.complianceTier,
    });

    const fees = this.computeFees(command.amount);
    const warnings = [...complianceDecision.warnings];

    const multisig = this.normalizeMultisig(command);
    if (multisig && multisig.approvals.length < multisig.threshold) {
      warnings.push(
        `Multisig approvals pending: ${multisig.approvals.length}/${multisig.threshold}`,
      );
    }

    return {
      executable:
        complianceDecision.canProceed &&
        (!multisig || multisig.approvals.length >= multisig.threshold),
      expected_status:
        multisig && multisig.approvals.length < multisig.threshold
          ? ('awaiting_multisig' as const)
          : ('submitted' as const),
      fees,
      recipient_gets: roundTo(command.amount - fees.total_fee, 4),
      warnings,
      compliance: {
        tier: complianceDecision.tier.id,
        can_proceed: complianceDecision.canProceed,
      },
      multisig: multisig
        ? {
            threshold: multisig.threshold,
            signers: multisig.signers,
            approvals_count: multisig.approvals.length,
            approvals_required: Math.max(0, multisig.threshold - multisig.approvals.length),
          }
        : undefined,
    };
  }

  public validateCommand(command: CreateTransferCommand) {
    if (!command.idempotencyKey) {
      throw new ValidationError('idempotency_key is required');
    }
    if (!command.fromWalletId) {
      throw new ValidationError('from_wallet_id is required');
    }
    if (!command.amount || command.amount <= 0) {
      throw new ValidationError('amount must be greater than zero');
    }
    if (command.amount > 1000000) {
      throw new ValidationError('Amount exceeds maximum limit');
    }
    if (!command.currency) {
      throw new ValidationError('currency is required');
    }
    if (command.currency !== 'USDC') {
      throw new ValidationError(`Unsupported currency: ${command.currency}`);
    }
    if (!command.recipient) {
      throw new ValidationError('recipient is required');
    }
    if (!['wallet', 'cash_pickup', 'bank'].includes(command.recipient.type)) {
      throw new ValidationError(`Invalid recipient type: ${command.recipient.type}`);
    }
    if (command.recipient.type === 'wallet' && !command.recipient.walletPublicKey) {
      throw new ValidationError('Wallet recipient must have walletPublicKey');
    }
    if (
      command.recipient.type === 'cash_pickup' &&
      (!command.recipient.partnerCode || !command.recipient.country)
    ) {
      throw new ValidationError('Cash pickup recipient must have partnerCode and country');
    }
    if (command.multisig) {
      if (!command.multisig.signers.length) {
        throw new ValidationError('multisig.signers must include at least one signer');
      }
      if (command.multisig.threshold < 2) {
        throw new ValidationError('multisig.threshold must be at least 2');
      }
      if (command.multisig.threshold > command.multisig.signers.length) {
        throw new ValidationError('multisig.threshold cannot exceed signer count');
      }
      const allowed = new Set(command.multisig.signers);
      const approvals = command.multisig.approvals || [];
      approvals.forEach((approval) => {
        if (!allowed.has(approval.approverWalletId)) {
          throw new ValidationError(
            `multisig approval signer not allowed: ${approval.approverWalletId}`,
          );
        }
      });
    }
  }

  async listUserTransfers(userId: string) {
    return this.repository.listByUserId(userId);
  }

  private enforceVelocityLimits(
    command: CreateTransferCommand,
    tier: { maxTransactionsPerMinute: number; maxTransactionsPerHour: number },
    historicalTransfers: TransferRecord[],
    logger: ReturnType<typeof createLogger>,
  ) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentMinuteTransfers = historicalTransfers.filter(
      (transfer) => new Date(transfer.createdAt).getTime() >= oneMinuteAgo,
    );
    const recentHourTransfers = historicalTransfers.filter(
      (transfer) => new Date(transfer.createdAt).getTime() >= oneHourAgo,
    );

    if (recentMinuteTransfers.length + 1 > tier.maxTransactionsPerMinute) {
      logger.warn(
        {
          limit: tier.maxTransactionsPerMinute,
          recentTransfers: recentMinuteTransfers.length,
          transferId: command.idempotencyKey,
        },
        'transfer rejected by per-minute velocity rule',
      );
      throw new ValidationError('Transfer velocity limit exceeded: too many transfers per minute');
    }

    if (recentHourTransfers.length + 1 > tier.maxTransactionsPerHour) {
      logger.warn(
        {
          limit: tier.maxTransactionsPerHour,
          recentTransfers: recentHourTransfers.length,
          transferId: command.idempotencyKey,
        },
        'transfer rejected by per-hour velocity rule',
      );
      throw new ValidationError('Transfer velocity limit exceeded: too many transfers per hour');
    }
  }

  private getLogger(context: Record<string, unknown>) {
    return createLogger({ component: 'transferLifecycle', ...context });
  }

  private appendStatus(transfer: TransferRecord, state: TransferState, notes?: string) {
    const previousState = transfer.state;
    transfer.state = state;
    transfer.statusHistory.push({ state, at: new Date().toISOString(), notes });
    transfer.updatedAt = new Date().toISOString();

    void this.eventBus.publish({
      type: TransferEventType.StateChanged,
      timestamp: transfer.updatedAt,
      payload: {
        userId: transfer.userId,
        transferId: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        recipientName: this.recipientName(transfer),
        previousState,
        state,
        notes,
      },
    });
  }

  private scheduleSettlement(transferId: string) {
    const transferLogger = this.getLogger({ transferId });
    transferLogger.debug({ delay: config.queues.settlementDelayMs }, 'queuing settlement attempt');
    setTimeout(() => this.settleTransfer(transferId), config.queues.settlementDelayMs);
  }

  private recipientName(transfer: TransferRecord) {
    const maybeName = transfer.recipient.metadata?.name;
    return typeof maybeName === 'string' && maybeName.length > 0 ? maybeName : 'Recipient';
  }

  private normalizeMultisig(command: CreateTransferCommand) {
    if (!command.multisig) {
      return undefined;
    }
    const approvals = command.multisig.approvals || [];
    return {
      threshold: command.multisig.threshold,
      signers: command.multisig.signers,
      approvals: approvals.map((approval) => ({
        approverWalletId: approval.approverWalletId,
        signature: approval.signature,
        approvedAt: new Date().toISOString(),
      })),
    };
  }

  private computeFees(amount: number) {
    const baseNetworkFee = 0.00001;
    const baseServiceRate = 0.005;
    const serviceFee = Math.min(Math.max(amount * baseServiceRate, 0.01), 25);
    return {
      network_fee: roundTo(baseNetworkFee, 5),
      service_fee: roundTo(serviceFee, 4),
      total_fee: roundTo(baseNetworkFee + serviceFee, 4),
    };
  }

  private async settleTransfer(transferId: string) {
    const transferLogger = this.getLogger({ transferId });
    const transfer = await this.repository.findById(transferId);
    if (!transfer) {
      transferLogger.warn('transfer missing during settlement');
      return;
    }

    if (!['held', 'submitted'].includes(transfer.state)) {
      transferLogger.debug({ state: transfer.state }, 'transfer not eligible for settlement');
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

      this.appendStatus(transfer, 'submitted');
      transfer.transactionHash = this.resolveTransactionHash(transfer);
      this.appendStatus(transfer, 'settled');
      transfer.processingAttempts += 1;
      await this.repository.update(transfer);
      await this.eventBus.publish({
        type: TransferEventType.Settled,
        timestamp: new Date().toISOString(),
        payload: {
          userId: transfer.userId,
          transferId: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          recipientName: this.recipientName(transfer),
        },
      });
      transferLogger.info(
        {
          amount: transfer.amount,
          currency: transfer.currency,
          attempts: transfer.processingAttempts,
        },
        'transfer settled',
      );
    } catch (err: unknown) {
      transfer.processingAttempts += 1;
      transfer.lastError = err instanceof Error ? err.message : 'unknown settlement error';
      transferLogger.error(
        {
          error: err instanceof Error ? err.message : String(err),
          attempts: transfer.processingAttempts,
        },
        'transfer settlement failed',
      );

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
          type: TransferEventType.Failed,
          timestamp: new Date().toISOString(),
          payload: {
            userId: transfer.userId,
            transferId: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            recipientName: this.recipientName(transfer),
            error: transfer.lastError,
          },
        });
      } else {
        this.scheduleSettlement(transfer.id);
      }

      await this.repository.update(transfer);
    }
  }

  private resolveTransactionHash(transfer: TransferRecord) {
    const externalTxHash = transfer.metadata?.externalWalletTxHash;
    if (typeof externalTxHash === 'string' && externalTxHash.length > 0) {
      return externalTxHash;
    }
    return `sim_${transfer.id}_${Date.now().toString(16)}`;
  }
}

function roundTo(value: number, places: number) {
  return Number(value.toFixed(places));
}
