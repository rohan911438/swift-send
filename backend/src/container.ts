import { config, AppConfig } from './config';
import { EventBus } from './core/eventBus';
import { ActivityService } from './modules/activity/activityService';
import { ExportService } from './modules/activity/exportService';
import { ComplianceService } from './modules/compliance/complianceService';
import { CountryMetadataService } from './modules/countries/countryMetadataService';
import { FraudService } from './modules/fraud/fraudService';
import { createDemoNotifications } from './modules/notifications/demoNotifications';
import { NotificationService } from './modules/notifications/notificationService';
import { AccessGuardService } from './modules/rbac/accessGuardService';
import { SystemHealthService } from './modules/system/systemHealthService';
import { createDemoTransfers } from './modules/transfers/demoTransfers';
import { InMemoryTransferRepository } from './modules/transfers/inMemoryTransferRepository';
import { TransferQueue } from './modules/transfers/transferQueue';
import { TransferLifecycle } from './modules/transfers/transferLifecycle';
import { IdempotencyService } from './modules/transfers/idempotencyService';
import { WalletService } from './modules/wallets/walletService';
import { ContractService } from './services/contractService';
import { RecurringPaymentService } from './modules/recurring-payments/recurringPaymentService';
import { RecurringPaymentWorker } from './modules/recurring-payments/recurringPaymentWorker';
import { InMemoryRecurringPaymentRepository } from './modules/recurring-payments/inMemoryRecurringPaymentRepository';

export interface AppContainer {
  config: AppConfig;
  eventBus: EventBus;
  services: {
    transfers: TransferLifecycle;
    transferQueue: TransferQueue;
    wallets: WalletService;
    compliance: ComplianceService;
    fraud: FraudService;
    notifications: NotificationService;
    activity: ActivityService;
    health: SystemHealthService;
    contracts: ContractService;
    accessGuard: AccessGuardService;
    recurringPayments: RecurringPaymentService;
    idempotency: IdempotencyService;
  };
}

export function createContainer(): AppContainer {
  const eventBus = new EventBus();
  const compliance = new ComplianceService();
  const fraud = new FraudService(eventBus);
  const wallets = new WalletService();
  const contracts = new ContractService();
  const countryMetadata = new CountryMetadataService();
  const transferRepository = new InMemoryTransferRepository(createDemoTransfers());
  const notifications = new NotificationService(eventBus, createDemoNotifications());
  const exporter = new ExportService();
  const activity = new ActivityService(transferRepository, notifications, exporter);
  const transfers = new TransferLifecycle(transferRepository, wallets, compliance, fraud, eventBus);
  const transferQueue = new TransferQueue(transfers, eventBus);
  const health = new SystemHealthService(compliance, wallets);
  const accessGuard = new AccessGuardService();
  const recurringPaymentRepository = new InMemoryRecurringPaymentRepository();
  const recurringPayments = new RecurringPaymentService(recurringPaymentRepository, contracts);
  const recurringWorker = new RecurringPaymentWorker(recurringPayments);
  const idempotency = new IdempotencyService();

  recurringWorker.start();

  eventBus.subscribe<{ userId: string }>('transfer.created', (event) => {
    activity.invalidateUser(event.payload.userId);
  });
  eventBus.subscribe<{ userId: string; transferId: string; amount: number; recipientName: string }>('transfer.settled', async (event) => {
    activity.invalidateUser(event.payload.userId);
    await notifications.notifyTransferSettled(event.payload);
  });
  eventBus.subscribe<{ userId: string; amount: number; recipientName: string; transferId: string; error?: string }>(
    'transfer.failed',
    async (event) => {
      activity.invalidateUser(event.payload.userId);
      await notifications.notifyTransferFailed(event.payload);
    },
  );
  eventBus.subscribe<{ userId: string; transferId: string; score: number; flags: string[] }>(
    'transfer.flagged',
    async (event) => {
      activity.invalidateUser(event.payload.userId);
      await notifications.notifyFraudFlagged(event.payload);
    },
  );
  eventBus.subscribe<{ userId: string; alertId: string; alertType: string; severity: string; transferId: string }>(
    'suspicious.activity.detected',
    async (event) => {
      activity.invalidateUser(event.payload.userId);
      await notifications.notifySuspiciousActivity(event.payload);
    },
  );
  eventBus.subscribe<{ userId: string }>('notification.created', (event) => {
    activity.invalidateUser(event.payload.userId);
  });
  eventBus.subscribe<{ userId: string }>('notification.read', (event) => {
    activity.invalidateUser(event.payload.userId);
  });

  return {
    config,
    eventBus,
    services: {
      transfers,
      transferQueue,
      wallets,
      compliance,
      fraud,
      notifications,
      activity,
      health,
      contracts,
      accessGuard,
      recurringPayments,
      idempotency,
    },
  };
}
