/**
 * Integration tests for the full transfer flow.
 *
 * These tests wire real implementations together (TransferLifecycle,
 * WalletService, escrow store, session store) instead of mocks so we can
 * exercise the wallet → escrow → release path end-to-end and validate
 * balance changes throughout.
 */

import { TransferLifecycle } from '../transferLifecycle';
import { InMemoryTransferRepository } from '../inMemoryTransferRepository';
import { WalletService } from '../../wallets/walletService';
import { ComplianceService } from '../../compliance/complianceService';
import { FraudService } from '../../fraud/fraudService';
import { EventBus } from '../../../core/eventBus';
import { CreateTransferCommand, TransferStatusEntry } from '../domain';
import {
  createMariaSession,
  getSessionUserBalance,
  adjustSessionUserBalance,
} from '../../../auth/sessionStore';

// ── helpers ─────────────────────────────────────────────────────────────────

function buildLifecycle(overrides?: {
  wallets?: Partial<WalletService>;
  compliance?: Partial<ComplianceService>;
  fraud?: Partial<FraudService>;
}) {
  const repository = new InMemoryTransferRepository();
  const wallets = new WalletService();
  const compliance = new ComplianceService();
  const fraud = new FraudService();
  const eventBus = new EventBus();

  if (overrides?.wallets) Object.assign(wallets, overrides.wallets);
  if (overrides?.compliance) Object.assign(compliance, overrides.compliance);

  const lifecycle = new TransferLifecycle(
    repository,
    wallets,
    compliance,
    fraud,
    eventBus,
  );

  return { lifecycle, repository, wallets, compliance, fraud, eventBus };
}

function walletCommand(
  overrides: Partial<CreateTransferCommand> = {},
): CreateTransferCommand {
  return {
    idempotencyKey: `key-${Date.now()}-${Math.random()}`,
    fromWalletId: 'wallet_maria_santos_123',
    userId: '1',
    amount: 50,
    currency: 'USDC',
    recipient: {
      type: 'wallet',
      walletPublicKey: 'GTEST123VALIDPUBLICKEY000',
    },
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Transfer Integration — wallet → escrow → release', () => {
  beforeEach(() => {
    // Reset Maria's balance to a known value before each test
    createMariaSession();
    // Force a clean balance
    const current = getSessionUserBalance('1') ?? 0;
    adjustSessionUserBalance('1', 1250.5 - current);
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────

  it('deducts balance when a transfer is held in escrow', async () => {
    const { lifecycle } = buildLifecycle();
    const balanceBefore = getSessionUserBalance('1')!;

    const transfer = await lifecycle.createTransfer(walletCommand({ amount: 100 }));

    const balanceAfter = getSessionUserBalance('1')!;
    expect(transfer.state).toBe('held');
    expect(transfer.escrowId).toBeDefined();
    expect(balanceAfter).toBeCloseTo(balanceBefore - 100, 2);
  });

  it('settles the transfer and records completed state', async () => {
    const { lifecycle, repository } = buildLifecycle();

    const cmd = walletCommand({ amount: 75 });
    const transfer = await lifecycle.createTransfer(cmd);
    expect(transfer.state).toBe('held');

    // Allow the async settlement timer to fire (default delay is 0 in test env)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const settled = await repository.findById(transfer.id);
    expect(settled?.state).toBe('settled');
    expect(settled?.statusHistory.map((h: TransferStatusEntry) => h.state)).toContain('settled');
  });

  it('preserves idempotency — same key returns same transfer', async () => {
    const { lifecycle } = buildLifecycle();
    const cmd = walletCommand();

    const first = await lifecycle.createTransfer(cmd);
    const second = await lifecycle.createTransfer(cmd);

    expect(second.id).toBe(first.id);
    expect(second.state).toBe(first.state);
  });

  it('records full status history: created → validated → held → settled', async () => {
    const { lifecycle, repository } = buildLifecycle();
    await lifecycle.createTransfer(walletCommand());

    await new Promise((resolve) => setTimeout(resolve, 50));

    const [transfer] = (await repository.listByUserId('1')).slice(0, 1);
    const states = transfer.statusHistory.map((h: TransferStatusEntry) => h.state);

    expect(states).toContain('created');
    expect(states).toContain('validated');
    expect(states).toContain('held');
    expect(states).toContain('settled');
  });

  // ── 2. Balance validation ──────────────────────────────────────────────────

  it('rejects transfer when balance is insufficient', async () => {
    const { lifecycle } = buildLifecycle();
    // Drain balance
    adjustSessionUserBalance('1', -(getSessionUserBalance('1') ?? 0));
    // Give just 10
    adjustSessionUserBalance('1', 10);

    await expect(lifecycle.createTransfer(walletCommand({ amount: 100 }))).rejects.toThrow(
      /insufficient balance/i,
    );
  });

  it('balance is NOT changed when transfer creation fails validation', async () => {
    const { lifecycle } = buildLifecycle();
    const balanceBefore = getSessionUserBalance('1')!;

    await expect(
      lifecycle.createTransfer(walletCommand({ amount: 0 })),
    ).rejects.toThrow(/greater than zero/i);

    expect(getSessionUserBalance('1')).toBeCloseTo(balanceBefore, 2);
  });

  // ── 3. Escrow lifecycle ────────────────────────────────────────────────────

  it('escrow is created with correct amount and currency', async () => {
    const { lifecycle, wallets } = buildLifecycle();
    const transfer = await lifecycle.createTransfer(walletCommand({ amount: 200 }));

    const escrow = await wallets.getEscrow(transfer.id);
    expect(escrow).not.toBeNull();
    expect(escrow?.amount).toBe(200);
    expect(escrow?.currency).toBe('USDC');
    expect(escrow?.status).toBe('held');
  });

  it('escrow transitions to released after settlement', async () => {
    const { lifecycle, wallets } = buildLifecycle();
    const transfer = await lifecycle.createTransfer(walletCommand({ amount: 50 }));

    await new Promise((resolve) => setTimeout(resolve, 50));

    const escrow = await wallets.getEscrow(transfer.id);
    expect(escrow?.status).toBe('released');
  });

  // ── 4. Failure simulation ──────────────────────────────────────────────────

  it('marks transfer as failed and refunds escrow after max settlement attempts', async () => {
    const { lifecycle, repository } = buildLifecycle({
      wallets: {
        settleEscrow: jest.fn().mockRejectedValue(new Error('Network error')),
      } as any,
    });

    const cmd = walletCommand({ amount: 30 });
    const transfer = await lifecycle.createTransfer(cmd);

    // Wait for all retry attempts (3 × settlementDelayMs, default 0 in tests)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const failed = await repository.findById(transfer.id);
    expect(failed?.state).toBe('failed');
    expect(failed?.lastError).toMatch(/Network error/);
    expect(failed?.statusHistory.at(-1)?.state).toBe('failed');
  });

  it('refunds balance after escrow auto-refund on failure', async () => {
    const balanceBefore = getSessionUserBalance('1')!;

    const { lifecycle } = buildLifecycle({
      wallets: {
        settleEscrow: jest.fn().mockRejectedValue(new Error('Settlement failed')),
      } as any,
    });

    await lifecycle.createTransfer(walletCommand({ amount: 50 }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Balance should be restored after refund
    const balanceAfter = getSessionUserBalance('1')!;
    expect(balanceAfter).toBeCloseTo(balanceBefore, 2);
  });

  it('compliance failure blocks transfer creation', async () => {
    const { lifecycle } = buildLifecycle({
      compliance: {
        evaluateTransfer: jest.fn().mockResolvedValue({
          canProceed: false,
          blockers: ['Daily limit exceeded'],
          warnings: [],
          riskScore: 'high',
          tier: {
            id: 'starter',
            name: 'Starter',
            dailyLimit: 500,
            monthlyLimit: 2000,
            yearlyLimit: 10000,
            singleTransactionLimit: 250,
            description: 'Starter',
            requirements: [],
            benefits: [],
          },
        }),
      } as any,
    });

    await expect(lifecycle.createTransfer(walletCommand({ amount: 10 }))).rejects.toThrow(
      /Compliance requirements not satisfied/,
    );
  });

  // ── 5. Event publication ───────────────────────────────────────────────────

  it('publishes transfer.created event with correct payload', async () => {
    const repository = new InMemoryTransferRepository();
    const wallets = new WalletService();
    const compliance = new ComplianceService();
    const fraud = new FraudService();
    const eventBus = new EventBus();
    const publishSpy = jest.spyOn(eventBus, 'publish');

    const lifecycle = new TransferLifecycle(repository, wallets, compliance, fraud, eventBus);
    const cmd = walletCommand({ amount: 60 });
    await lifecycle.createTransfer(cmd);

    const createdEvent = publishSpy.mock.calls.find(
      ([e]) => (e as any).type === 'transfer.created',
    );
    expect(createdEvent).toBeDefined();
    expect((createdEvent![0] as any).payload.userId).toBe('1');
    expect((createdEvent![0] as any).payload.amount).toBe(60);
  });

  it('publishes transfer.settled event after successful settlement', async () => {
    const repository = new InMemoryTransferRepository();
    const wallets = new WalletService();
    const compliance = new ComplianceService();
    const fraud = new FraudService();
    const eventBus = new EventBus();
    const publishSpy = jest.spyOn(eventBus, 'publish');

    const lifecycle = new TransferLifecycle(repository, wallets, compliance, fraud, eventBus);
    await lifecycle.createTransfer(walletCommand({ amount: 40 }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const settledEvent = publishSpy.mock.calls.find(
      ([e]) => (e as any).type === 'transfer.settled',
    );
    expect(settledEvent).toBeDefined();
    expect((settledEvent![0] as any).payload.amount).toBe(40);
  });

  it('publishes transfer.failed event on exhausted retries', async () => {
    const repository = new InMemoryTransferRepository();
    const wallets = new WalletService();
    const compliance = new ComplianceService();
    const fraud = new FraudService();
    const eventBus = new EventBus();
    const publishSpy = jest.spyOn(eventBus, 'publish');

    jest.spyOn(wallets, 'settleEscrow').mockRejectedValue(new Error('timeout'));

    const lifecycle = new TransferLifecycle(repository, wallets, compliance, fraud, eventBus);
    await lifecycle.createTransfer(walletCommand({ amount: 25 }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const failedEvent = publishSpy.mock.calls.find(
      ([e]) => (e as any).type === 'transfer.failed',
    );
    expect(failedEvent).toBeDefined();
    expect((failedEvent![0] as any).payload.error).toMatch(/timeout/);
  });

  // ── 6. Recipient types ──────────────────────────────────────────────────────

  it('accepts cash_pickup recipient and settles to partner account', async () => {
    const { lifecycle, repository } = buildLifecycle();
    const cmd = walletCommand({
      recipient: {
        type: 'cash_pickup',
        partnerCode: 'MONEYGRAM',
        country: 'MX',
      },
    });

    await lifecycle.createTransfer(cmd);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const [transfer] = await repository.listByUserId('1');
    expect(transfer.state).toBe('settled');
    expect(transfer.recipient.type).toBe('cash_pickup');
  });

  it('accepts bank recipient and settles successfully', async () => {
    const { lifecycle, repository } = buildLifecycle();
    const cmd = walletCommand({
      recipient: {
        type: 'bank',
        partnerCode: 'WISE',
        country: 'UK',
      },
    });

    await lifecycle.createTransfer(cmd);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const [transfer] = await repository.listByUserId('1');
    expect(transfer.state).toBe('settled');
  });
});
