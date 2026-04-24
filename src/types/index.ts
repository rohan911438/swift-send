import type { TransactionRiskSummary } from './activity';

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  balance: number; // Legacy balance field
  usdcBalance: number; // USDC balance
  localCurrency: string; // User's local currency code (USD, EUR, etc.)
  exchangeRate: number; // Rate from USDC to local currency
  isVerified: boolean;
  onboardingCompleted: boolean;
  walletAddress?: string;
  createdAt: Date;
  // Stellar wallet preferences
  externalWalletConnected?: boolean;
  preferExternalWallet?: boolean;
  walletConnectionStatus?: 'none' | 'connected' | 'disconnected';
  // Compliance information
  complianceTier?: string;
  verificationLevel?: 'basic' | 'enhanced' | 'full';
  kycStatus?: 'pending' | 'verified' | 'rejected' | 'expired';
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  isVerified: boolean;
  hasWallet: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  country: string;
  countryCode: string;
}

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  fee: number;
  recipientAmount: number;
  recipientName: string;
  recipientPhone: string;
  status: TransactionStatus;
  timestamp: Date;
  exchangeRate?: number;
  destinationCurrency?: string;
  category?: string;
  notes?: string;
  risk?: TransactionRiskSummary;
}

export interface FeeBreakdown {
  networkFee: number;
  serviceFee: number;
  exchangeRate: number;
  totalFee: number;
  recipientGets: number;
}

// Stellar Wallet Types
export interface StellarWallet {
  name: string;
  icon: string;
  description: string;
  isInstalled: boolean;
  connect: () => Promise<StellarAccount>;
}

export interface StellarAccount {
  publicKey: string;
  balance: number;
  provider: string;
  isTestnet?: boolean;
  isReal?: boolean; // Flag to distinguish real wallet connections from demo
}

export interface WalletTransaction {
  id: string;
  hash?: string;
  type: 'payment' | 'pathPayment';
  amount: string;
  asset: string;
  destination: string;
  memo?: string;
  status: 'pending' | 'submitted' | 'success' | 'failed';
  createdAt: Date;
  stellarHash?: string;
  networkFee?: string;
}

export interface TransactionPreview {
  amount: string;
  asset: string;
  destination: string;
  memo?: string;
  networkFee: string;
  estimatedTime: string;
}

export type WalletProvider = 'freighter' | 'albedo' | 'walletconnect' | 'rabet' | 'internal';

// Funding and Withdrawal Types
export interface FundingMethod {
  id: string;
  type: 'bank_transfer' | 'card' | 'cash_deposit' | 'mobile_money' | 'crypto_transfer';
  name: string;
  description: string;
  icon: string;
  processingTime: string;
  fees: {
    percentage?: number;
    fixed?: number;
    min?: number;
    max?: number;
  };
  limits: {
    min: number;
    max: number;
    dailyLimit: number;
  };
  regions: string[];
  status: 'available' | 'maintenance' | 'unavailable';
  instructions?: string[];
}

export interface WithdrawalMethod {
  id: string;
  type: 'cash_pickup' | 'bank_transfer' | 'mobile_money' | 'home_delivery' | 'digital_wallet';
  name: string;
  description: string;
  icon: string;
  processingTime: string;
  fees: {
    percentage?: number;
    fixed?: number;
  };
  limits: {
    min: number;
    max: number;
  };
  availability: {
    countries: string[];
    cities?: string[];
    operatingHours?: string;
  };
  partnerName: string;
  partnerLogo?: string;
  locations?: PickupLocation[];
  requirements: string[];
}

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  hours: string;
  phone?: string;
  coordinates?: { lat: number; lng: number };
  distance?: string;
}

export interface RemittanceFlow {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  fundingMethodId: string;
  withdrawalMethodId: string;
  status: 'funding' | 'processing' | 'ready_for_pickup' | 'completed' | 'cancelled';
  timeline: RemittanceTimeline[];
  estimatedCompletion: Date;
  confirmationCode: string;
  fees: {
    funding: number;
    exchange: number;
    withdrawal: number;
    total: number;
  };
  exchangeRate: number;
  recipientAmount: number;
  recipientCurrency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RemittanceTimeline {
  stage: 'initiated' | 'funded' | 'processing' | 'ready' | 'completed';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: Date;
  estimatedTime?: string;
  description: string;
}

export interface Partner {
  id: string;
  name: string;
  type: 'bank' | 'money_transfer' | 'mobile_money' | 'cash_network';
  logo: string;
  description: string;
  countries: string[];
  services: ('cash_in' | 'cash_out')[];
  reliability: number; // 0-1 rating
  avgProcessingTime: string;
}

export interface WalletConnectionState {
  isConnected: boolean;
  account?: StellarAccount;
  provider?: WalletProvider;
  error?: string;
}
