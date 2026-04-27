import dotenv from 'dotenv';

dotenv.config();

type Environment = 'development' | 'test' | 'production';
type StellarNetwork = 'TESTNET' | 'PUBLIC';

export interface AppConfig {
  env: Environment;
  server: {
    host: string;
    port: number;
    basePath: string;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
  stellar: {
    network: StellarNetwork;
    horizonUrl: string;
    distributionAccount: string;
    distributionSecret?: string;
    assetCode: string;
    assetIssuer: string;
    simulateSubmission: boolean;
  };
  contracts: {
    simpleCounter: string;
    accessGuard: string;
    remittanceEscrow?: string;
    walletRegistry?: string;
    complianceLimits?: string;
    recurringPayments?: string;
  };
  persistence: {
    databaseUrl: string;
  };
  queues: {
    settlementDelayMs: number;
    maxSettlementAttempts: number;
  };
  performance: {
    healthCacheTtlMs: number;
    activityCacheTtlMs: number;
  };
  cache: {
    redisUrl: string;
    enabled: boolean;
    balanceCacheTtlSeconds: number;
    activityCacheTtlSeconds: number;
  };
  features: {
    enableEscrow: boolean;
    enableRiskScoring: boolean;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresSeconds: number;
    cookieName: string;
    /** Browser origin(s) allowed for credentialed CORS (comma-separated). */
    corsOrigins: string[];
  };
  encryption: {
    /** AES-256-GCM key used to encrypt PII fields at rest. Must be 32 bytes or derivable to 32 bytes. */
    key: string;
  };
}

const intFromEnv = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const boolFromEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toStellarNetwork = (value: string | undefined): StellarNetwork => {
  if (!value) return 'TESTNET';
  return value.toUpperCase() === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
};

export const config: AppConfig = {
  env: (process.env.NODE_ENV as Environment) || 'development',
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: intFromEnv(process.env.PORT, 4000),
    basePath: process.env.API_BASE_PATH || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    pretty: boolFromEnv(process.env.LOG_PRETTY, process.env.NODE_ENV !== 'production'),
  },
  stellar: {
    network: toStellarNetwork(process.env.STELLAR_NETWORK),
    horizonUrl:
      process.env.STELLAR_HORIZON_URL ||
      (process.env.STELLAR_NETWORK === 'PUBLIC'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org'),
    distributionAccount: process.env.STELLAR_DISTRIBUTION_ACCOUNT || 'GDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    distributionSecret: process.env.STELLAR_DISTRIBUTION_SECRET,
    assetCode: process.env.STELLAR_ASSET_CODE || 'USDC',
    assetIssuer: process.env.STELLAR_ASSET_ISSUER || 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    simulateSubmission: boolFromEnv(process.env.SIMULATE_STELLAR, true),
  },
  persistence: {
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/swiftsend',
  },
  queues: {
    settlementDelayMs: intFromEnv(process.env.WORKER_DELAY_MS, 2000),
    maxSettlementAttempts: intFromEnv(process.env.SETTLEMENT_MAX_ATTEMPTS, 3),
  },
  performance: {
    healthCacheTtlMs: intFromEnv(process.env.HEALTH_CACHE_TTL_MS, 15000),
    activityCacheTtlMs: intFromEnv(process.env.ACTIVITY_CACHE_TTL_MS, 10000),
  },
  features: {
    enableEscrow: boolFromEnv(process.env.FEATURE_ESCROW, true),
    enableRiskScoring: boolFromEnv(process.env.FEATURE_RISK_SCORING, true),
  },
  cache: {
    redisUrl: process.env.REDIS_URL || '',
    enabled: !!process.env.REDIS_URL,
    balanceCacheTtlSeconds: intFromEnv(process.env.BALANCE_CACHE_TTL_SECONDS, 10),
    activityCacheTtlSeconds: intFromEnv(process.env.ACTIVITY_CACHE_TTL_SECONDS, 10),
  },
  contracts: {
    simpleCounter: process.env.CONTRACT_SIMPLE_COUNTER || 'CA7JEZGXWTX62LE6HSW7C6DQHDFNEKEFYI2AYNXU67AJPKIKNRINTCHB',
    accessGuard: process.env.CONTRACT_ACCESS_GUARD || 'CDPOR7XAJDYSPCQMLM5AJESL4IOC7L2J34GW5UKSTC6NX7Z4GG53OLEF',
    remittanceEscrow: process.env.CONTRACT_REMITTANCE_ESCROW,
    walletRegistry: process.env.CONTRACT_WALLET_REGISTRY,
    complianceLimits: process.env.CONTRACT_COMPLIANCE_LIMITS,
    recurringPayments: process.env.CONTRACT_RECURRING_PAYMENTS,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-in-production',
    jwtExpiresSeconds: intFromEnv(process.env.JWT_EXPIRES_SECONDS, 60 * 60 * 24 * 7),
    cookieName: process.env.AUTH_COOKIE_NAME || 'ss_session',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  encryption: {
    key: process.env.DATA_ENCRYPTION_KEY || 'dev-only-change-me-in-production-please-set-DATA_ENCRYPTION_KEY',
  },
};

export const isProd = () => config.env === 'production';
