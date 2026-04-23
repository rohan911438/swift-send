import type { AuthUser, User } from '@/types';
import { apiFetch } from '@/lib/api';

export type AuthUserDto = AuthUser;

export interface TransactionSigningDto {
  algorithm: string;
  secret: string;
}

export interface AuthMeResponseDto {
  authUser: AuthUserDto;
  user: unknown | null;
  transactionSigning: TransactionSigningDto;
  onboardingRequired?: boolean;
}

export interface LoginResponseDto {
  needsVerification: boolean;
  isNewUser: boolean;
  authUser: AuthUserDto;
  user: unknown | null;
  transactionSigning: TransactionSigningDto;
}

export interface SignupResponseDto {
  needsVerification: boolean;
  authUser: AuthUserDto;
  transactionSigning: TransactionSigningDto;
}

export interface VerifyResponseDto {
  authUser: AuthUserDto;
  user: unknown | null;
  transactionSigning: TransactionSigningDto;
  onboardingRequired?: boolean;
}

export interface CompleteOnboardingResponseDto {
  user: unknown;
  authUser: AuthUserDto;
  transactionSigning: TransactionSigningDto;
}

export function validateIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) throw new Error('Please enter your email or phone number');
  return trimmed;
}

export function validateVerificationCode(code: string): string {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) throw new Error('Please enter a valid 6-digit code');
  return trimmed;
}

export function parseUserDto(data: unknown): User {
  const u = data as Record<string, unknown>;
  return {
    id: String(u.id),
    name: String(u.name),
    phone: String(u.phone),
    email: u.email ? String(u.email) : undefined,
    balance: Number(u.balance ?? 0),
    usdcBalance: Number(u.usdcBalance ?? u.balance ?? 0),
    localCurrency: String(u.localCurrency ?? 'USD'),
    exchangeRate: Number(u.exchangeRate ?? 1),
    isVerified: Boolean(u.isVerified),
    onboardingCompleted: Boolean(u.onboardingCompleted),
    walletAddress: u.walletAddress ? String(u.walletAddress) : undefined,
    createdAt: u.createdAt ? new Date(String(u.createdAt)) : new Date(),
  };
}

async function jsonOrEmpty<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

async function requireOk(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  const body = await jsonOrEmpty<{ error?: string }>(res);
  throw new Error(body.error || fallbackMessage);
}

export async function authMe(): Promise<AuthMeResponseDto> {
  const res = await apiFetch('/auth/me');
  await requireOk(res, 'Not authenticated');
  return (await res.json()) as AuthMeResponseDto;
}

export async function login(identifier: string): Promise<LoginResponseDto> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: validateIdentifier(identifier) }),
  });
  await requireOk(res, 'Login failed');
  return (await res.json()) as LoginResponseDto;
}

export async function signup(identifier: string): Promise<SignupResponseDto> {
  const res = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ identifier: validateIdentifier(identifier) }),
  });
  await requireOk(res, 'Sign up failed');
  const dto = (await res.json()) as { authUser: AuthUserDto };
  return { needsVerification: true, authUser: dto.authUser, transactionSigning: (dto as SignupResponseDto).transactionSigning };
}

export async function verifyCode(code: string): Promise<VerifyResponseDto> {
  const res = await apiFetch('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ code: validateVerificationCode(code) }),
  });
  await requireOk(res, 'Verification failed');
  return (await res.json()) as VerifyResponseDto;
}

export async function completeOnboarding(userData: Partial<User>): Promise<CompleteOnboardingResponseDto> {
  const res = await apiFetch('/auth/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
    }),
  });
  await requireOk(res, 'Could not complete onboarding');
  return (await res.json()) as CompleteOnboardingResponseDto;
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  // Always clear local state even if server is unreachable.
  if (!res.ok) return;
}

