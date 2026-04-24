/** Public user shape returned to the web client (matches frontend `User`). */
export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  balance: number;
  usdcBalance: number;
  localCurrency: string;
  exchangeRate: number;
  isVerified: boolean;
  onboardingCompleted: boolean;
  walletAddress?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  email?: string;
  phone?: string;
  verified: boolean;
  hasWallet: boolean;
  onboardingCompleted: boolean;
  transactionSigningSecret: string;
  user?: PublicUser;
}

export interface JwtSessionPayload {
  sub: string;
  verified: boolean;
  hasWallet: boolean;
}
