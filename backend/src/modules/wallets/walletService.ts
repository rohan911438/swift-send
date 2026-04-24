import { ValidationError, NotFoundError } from '../../errors';
import { adjustSessionUserBalance, getSessionUserBalance } from '../../auth/sessionStore';
import { logger } from '../../logger';
import { postEntry } from '../../services/ledger';
import { submitPayment } from '../../services/stellarAdapter';
import { StrKey } from '@stellar/stellar-sdk';
import {
  createEscrow,
  EscrowEntry,
  getEscrow as getEscrowEntry,
  releaseEscrow,
  refundEscrow,
} from '../../services/escrow';

export interface ReserveFundsRequest {
  userId?: string;
  walletId: string;
  transferId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface SettlementRequest {
  userId?: string;
  transferId: string;
  destinationAccount: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export class WalletService {
  async reserveFunds(request: ReserveFundsRequest): Promise<EscrowEntry> {
    if (!request.amount || request.amount <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }

    this.ensureSufficientBalance(request.userId, request.amount);

    if (request.userId) {
      adjustSessionUserBalance(request.userId, -request.amount);
    }

    try {
      await postEntry(
        request.walletId,
        `escrow:${request.transferId}`,
        request.amount,
        request.currency,
        'reserve',
        request.metadata
      );
      const escrow = await createEscrow(request.transferId, request.amount, request.currency);
      logger.debug({ transferId: request.transferId }, 'funds reserved');
      return escrow;
    } catch (error) {
      if (request.userId) {
        adjustSessionUserBalance(request.userId, request.amount);
      }
      throw error;
    }
  }

  async settleEscrow(request: SettlementRequest) {
    const escrow = await getEscrowEntry(request.transferId);
    if (!escrow) throw new NotFoundError('Escrow not found');

    // If this looks like a Stellar account, submit via Horizon before releasing escrow.
    // For non-wallet destinations (e.g. `recipient:<id>`), we keep prototype behavior.
    if (typeof request.destinationAccount === 'string' && StrKey.isValidEd25519PublicKey(request.destinationAccount)) {
      try {
        const stellarResult = await submitPayment(
          request.transferId,
          '', // use configured distribution account
          request.destinationAccount,
          request.amount,
          request.currency
        );
        request.metadata = { ...(request.metadata || {}), stellar: { hash: stellarResult.networkId, attempt: stellarResult.attempt } };
      } catch (err: unknown) {
        // Surface a structured error and avoid releasing escrow if the network submission failed.
        logger.error({ transferId: request.transferId, err }, 'stellar submission failed');
        throw err;
      }
    }

    await postEntry(
      `escrow:${request.transferId}`,
      request.destinationAccount,
      request.amount,
      request.currency,
      'settle',
      request.metadata
    );
    await releaseEscrow(request.transferId);
    logger.info({ transferId: request.transferId, destination: request.destinationAccount }, 'escrow released');
    return escrow;
  }

  async refundEscrow(request: SettlementRequest) {
    const escrow = await getEscrowEntry(request.transferId);
    if (!escrow) throw new NotFoundError('Escrow not found');

    await postEntry(
      `escrow:${request.transferId}`,
      request.destinationAccount,
      request.amount,
      request.currency,
      'refund',
      request.metadata
    );
    await refundEscrow(request.transferId);
    if (request.userId) {
      adjustSessionUserBalance(request.userId, request.amount);
    }
    logger.warn({ transferId: request.transferId }, 'escrow refunded');
    return escrow;
  }

  async getEscrow(transferId: string) {
    return getEscrowEntry(transferId);
  }

  private ensureSufficientBalance(userId: string | undefined, amount: number) {
    if (!userId) {
      return;
    }

    const currentBalance = getSessionUserBalance(userId);
    if (currentBalance === null) {
      throw new ValidationError('Wallet balance unavailable for this sender');
    }

    if (currentBalance < amount) {
      throw new ValidationError('Insufficient balance for this transfer', {
        availableBalance: currentBalance,
        requestedAmount: amount,
      });
    }
  }
}
