import { apiFetch } from '@/lib/api';
import type { AuthSessionInfo, AuthUser, User } from '@/types';

interface UserDto {
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

interface AuthResponse {
  authUser: AuthUser;
  user?: UserDto | null;
  onboardingRequired?: boolean;
  needsVerification?: boolean;
  isNewUser?: boolean;
  session: AuthSessionInfo;
}

async function requireJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    throw new Error(errorBody.error || fallbackMessage);
  }

  return body as T;
}

export function parseUserDto(dto: UserDto): User {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
  };
}

export async function login(identifier: string): Promise<AuthResponse> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return requireJson<AuthResponse>(response, 'Unable to sign in');
}

export async function signup(identifier: string): Promise<AuthResponse> {
  const response = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return requireJson<AuthResponse>(response, 'Unable to create account');
}

export async function verifyCode(code: string): Promise<AuthResponse> {
  const response = await apiFetch('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      lockedSeconds?: number;
    };
    const error = new Error(body.error || 'Unable to verify code');
    if (body.lockedSeconds !== undefined) {
      (error as any).lockedSeconds = body.lockedSeconds;
    }
    throw error;
  }

  return requireJson<AuthResponse>(response, 'Unable to verify code');
}

export async function resendCode(): Promise<{ ok: boolean; message: string }> {
  const response = await apiFetch('/auth/resend', {
    method: 'POST',
  });
  return requireJson<{ ok: boolean; message: string }>(response, 'Unable to resend verification code');
}

export async function unlockAccount(): Promise<{ ok: boolean; message: string }> {
  const response = await apiFetch('/auth/verify/unlock', {
    method: 'POST',
  });
  return requireJson<{ ok: boolean; message: string }>(response, 'Unable to unlock account');
}

export async function authMe(): Promise<AuthResponse> {
  const response = await apiFetch('/auth/me');
  return requireJson<AuthResponse>(response, 'Unable to restore session');
}

export async function completeOnboarding(userData: Partial<User>): Promise<AuthResponse> {
  const response = await apiFetch('/auth/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  return requireJson<AuthResponse>(response, 'Unable to complete onboarding');
}

export async function heartbeat(): Promise<Pick<AuthResponse, 'authUser' | 'session'>> {
  const response = await apiFetch('/auth/session/heartbeat', {
    method: 'POST',
  });
  return requireJson<Pick<AuthResponse, 'authUser' | 'session'>>(response, 'Unable to refresh session');
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/auth/logout', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Unable to sign out');
  }
}
