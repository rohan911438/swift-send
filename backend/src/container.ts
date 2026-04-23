import { config, AppConfig } from './config';
import { EventBus } from './core/eventBus';
import { ComplianceService } from './modules/compliance/complianceService';
import { SystemHealthService } from './modules/system/systemHealthService';
import { InMemoryTransferRepository } from './modules/transfers/inMemoryTransferRepository';
import { TransferQueue } from './modules/transfers/transferQueue';
import { TransferLifecycle } from './modules/transfers/transferLifecycle';
import { WalletService } from './modules/wallets/walletService';
import { ContractService } from './services/contractService';

export interface AppContainer {
  config: AppConfig;
  eventBus: EventBus;
  services: {
    transfers: TransferLifecycle;
    transferQueue: TransferQueue;
    wallets: WalletService;
    compliance: ComplianceService;
    health: SystemHealthService;
    contracts: ContractService;
  };
}

export function createContainer(): AppContainer {
  const eventBus = new EventBus();
  const compliance = new ComplianceService();
  const wallets = new WalletService();
  const contracts = new ContractService();
  const transferRepository = new InMemoryTransferRepository();
  const transfers = new TransferLifecycle(transferRepository, wallets, compliance, eventBus);
  const transferQueue = new TransferQueue(transfers, eventBus);
  const health = new SystemHealthService(compliance, wallets);

  return {
    config,
    eventBus,
    services: {
      transfers,
      transferQueue,
      wallets,
      compliance,
      health,
      contracts,
    },
  };
}
