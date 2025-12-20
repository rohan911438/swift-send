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

export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  fee: number;
  recipientAmount: number;
  recipientName: string;
  recipientPhone: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  exchangeRate?: number;
  destinationCurrency?: string;
}

export interface FeeBreakdown {
  networkFee: number;
  serviceFee: number;
  exchangeRate: number;
  totalFee: number;
  recipientGets: number;
}
