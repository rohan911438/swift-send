import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { User, AuthUser } from '@/types';
import { apiFetch } from '@/lib/api';

function parseUserDto(data: unknown): User {
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

interface AuthContextType {
  user: User | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  onboardingStep: number;
  login: (identifier: string) => Promise<{ needsVerification: boolean; isNewUser: boolean }>;
  signup: (identifier: string, name?: string) => Promise<{ needsVerification: boolean }>;
  verifyCode: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  completeOnboarding: (userData: Partial<User>) => Promise<void>;
  logout: () => void;
  updateBalance: (newBalance: number) => void;
  setOnboardingStep: (step: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const applySessionPayload = useCallback(
    (payload: { authUser: AuthUser; user?: unknown | null; onboardingRequired?: boolean }) => {
      setAuthUser(payload.authUser);
      if (payload.user) {
        setUser(parseUserDto(payload.user));
      } else {
        setUser(null);
      }
      if (payload.onboardingRequired) {
        setOnboardingStep(1);
      } else if (payload.user) {
        setOnboardingStep(0);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/auth/me');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          authUser: AuthUser;
          user: unknown | null;
          onboardingRequired?: boolean;
        };
        if (cancelled) return;
        applySessionPayload(data);
      } catch {
        // offline or server down — stay logged out
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySessionPayload]);

  const login = async (identifier: string): Promise<{ needsVerification: boolean; isNewUser: boolean }> => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      needsVerification?: boolean;
      isNewUser?: boolean;
      authUser?: AuthUser;
      user?: unknown | null;
    };
    if (!res.ok) {
      throw new Error(body.error || 'Login failed');
    }
    if (body.authUser) {
      applySessionPayload({
        authUser: body.authUser,
        user: body.user ?? null,
        onboardingRequired: false,
      });
    }
    const needsVerification = Boolean(body.needsVerification);
    if (needsVerification) {
      setOnboardingStep(0);
    }
    return {
      needsVerification,
      isNewUser: Boolean(body.isNewUser),
    };
  };

  const signup = async (identifier: string, _name?: string): Promise<{ needsVerification: boolean }> => {
    const res = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; authUser?: AuthUser };
    if (!res.ok) {
      throw new Error(body.error || 'Sign up failed');
    }
    if (body.authUser) {
      setAuthUser(body.authUser);
      setUser(null);
      setOnboardingStep(0);
    }
    return { needsVerification: true };
  };

  const verifyCode = async (code: string) => {
    const res = await apiFetch('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      authUser?: AuthUser;
      user?: unknown | null;
      onboardingRequired?: boolean;
    };
    if (!res.ok) {
      throw new Error(body.error || 'Verification failed');
    }
    if (body.authUser) {
      applySessionPayload({
        authUser: body.authUser,
        user: body.user ?? null,
        onboardingRequired: body.onboardingRequired,
      });
    }
  };

  const resendCode = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const completeOnboarding = async (userData: Partial<User>) => {
    const res = await apiFetch('/auth/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; user?: unknown; authUser?: AuthUser };
    if (!res.ok) {
      throw new Error(body.error || 'Could not complete onboarding');
    }
    if (body.authUser && body.user) {
      applySessionPayload({
        authUser: body.authUser,
        user: body.user,
        onboardingRequired: false,
      });
    }
  };

  const logout = () => {
    void apiFetch('/auth/logout', { method: 'POST' }).finally(() => {
      setUser(null);
      setAuthUser(null);
      setOnboardingStep(0);
    });
  };

  const updateBalance = (newBalance: number) => {
    if (user) {
      setUser({
        ...user,
        balance: newBalance,
        usdcBalance: newBalance,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authUser,
        isAuthenticated: !!user,
        isVerified: !!authUser?.isVerified,
        onboardingStep,
        login,
        signup,
        verifyCode,
        resendCode,
        completeOnboarding,
        logout,
        updateBalance,
        setOnboardingStep,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
