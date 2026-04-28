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

export type UserRole = 'admin' | 'user';

export interface SessionMetadata {
  createdAt: number;
  lastActivityAt: number;
  trustedIps: string[];
  lastKnownIp?: string;
}

export interface Session {
  id: string;
  email?: string;
  phone?: string;
  verified: boolean;
  hasWallet: boolean;
  onboardingCompleted: boolean;
  role?: UserRole;
  user?: PublicUser;
  metadata: SessionMetadata;
  expiresAt: number;
}

export interface JwtSessionPayload {
  sub: string;
  verified: boolean;
  hasWallet: boolean;
  role?: UserRole;
}

export interface SessionInfo {
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  inactivityTimeoutMs: number;
  warningThresholdMs: number;
}
