import React, { createContext, useContext, ReactNode, useEffect, useMemo, useReducer, useCallback } from 'react';
import type { User, AuthUser } from '@/types';
import * as authApi from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  onboardingStep: number;
  transactionSigningSecret: string | null;
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

type AuthStatus = 'idle' | 'bootstrapping' | 'ready';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  authUser: AuthUser | null;
  onboardingStep: number;
  transactionSigningSecret: string | null;
}

type AuthAction =
  | { type: 'BOOTSTRAP_START' }
  | { type: 'SESSION_APPLY'; authUser: AuthUser; user: User | null; transactionSigningSecret: string; onboardingRequired?: boolean }
  | { type: 'LOGOUT' }
  | { type: 'SET_ONBOARDING_STEP'; step: number }
  | { type: 'UPDATE_BALANCE'; balance: number };

const initialState: AuthState = {
  status: 'idle',
  user: null,
  authUser: null,
  onboardingStep: 0,
  transactionSigningSecret: null,
};

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'BOOTSTRAP_START':
      return { ...state, status: 'bootstrapping' };
    case 'SESSION_APPLY': {
      const nextOnboardingStep = action.onboardingRequired ? 1 : action.user ? 0 : state.onboardingStep;
      return {
        status: 'ready',
        user: action.user,
        authUser: action.authUser,
        onboardingStep: nextOnboardingStep,
        transactionSigningSecret: action.transactionSigningSecret,
      };
    }
    case 'SET_ONBOARDING_STEP':
      return { ...state, onboardingStep: action.step };
    case 'UPDATE_BALANCE':
      return state.user
        ? { ...state, user: { ...state.user, balance: action.balance, usdcBalance: action.balance } }
        : state;
    case 'LOGOUT':
      return { status: 'ready', user: null, authUser: null, onboardingStep: 0, transactionSigningSecret: null };
    default:
      return state;
  }
}

function useAuthBootstrap(dispatch: React.Dispatch<AuthAction>) {
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'BOOTSTRAP_START' });
    (async () => {
      try {
        const dto = await authApi.authMe();
        if (cancelled) return;
        dispatch({
          type: 'SESSION_APPLY',
          authUser: dto.authUser,
          user: dto.user ? authApi.parseUserDto(dto.user) : null,
          transactionSigningSecret: dto.transactionSigning.secret,
          onboardingRequired: dto.onboardingRequired,
        });
      } catch {
        // not logged in / offline / server down
        if (cancelled) return;
        dispatch({ type: 'LOGOUT' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  useAuthBootstrap(dispatch);

  const login = useCallback(async (identifier: string) => {
    const dto = await authApi.login(identifier);
    dispatch({
      type: 'SESSION_APPLY',
      authUser: dto.authUser,
      user: dto.user ? authApi.parseUserDto(dto.user) : null,
      transactionSigningSecret: dto.transactionSigning.secret,
      onboardingRequired: false,
    });
    if (dto.needsVerification) dispatch({ type: 'SET_ONBOARDING_STEP', step: 0 });
    return { needsVerification: dto.needsVerification, isNewUser: dto.isNewUser };
  }, []);

  const signup = useCallback(async (identifier: string, _name?: string) => {
    const dto = await authApi.signup(identifier);
    dispatch({ type: 'SESSION_APPLY', authUser: dto.authUser, user: null, transactionSigningSecret: dto.transactionSigning.secret, onboardingRequired: false });
    dispatch({ type: 'SET_ONBOARDING_STEP', step: 0 });
    return { needsVerification: true };
  }, []);

  const verifyCode = useCallback(async (code: string) => {
    const dto = await authApi.verifyCode(code);
    dispatch({
      type: 'SESSION_APPLY',
      authUser: dto.authUser,
      user: dto.user ? authApi.parseUserDto(dto.user) : null,
      transactionSigningSecret: dto.transactionSigning.secret,
      onboardingRequired: dto.onboardingRequired,
    });
  }, []);

  const resendCode = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, []);

  const completeOnboarding = useCallback(async (userData: Partial<User>) => {
    const dto = await authApi.completeOnboarding(userData);
    dispatch({
      type: 'SESSION_APPLY',
      authUser: dto.authUser,
      user: authApi.parseUserDto(dto.user),
      transactionSigningSecret: dto.transactionSigning.secret,
      onboardingRequired: false,
    });
  }, []);

  const logout = useCallback(() => {
    void authApi.logout().finally(() => dispatch({ type: 'LOGOUT' }));
  }, []);

  const updateBalance = useCallback((newBalance: number) => dispatch({ type: 'UPDATE_BALANCE', balance: newBalance }), []);

  const setOnboardingStep = useCallback((step: number) => dispatch({ type: 'SET_ONBOARDING_STEP', step }), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      authUser: state.authUser,
      isAuthenticated: !!state.user,
      isVerified: !!state.authUser?.isVerified,
      onboardingStep: state.onboardingStep,
      transactionSigningSecret: state.transactionSigningSecret,
      login,
      signup,
      verifyCode,
      resendCode,
      completeOnboarding,
      logout,
      updateBalance,
      setOnboardingStep,
    }),
    [state, login, signup, verifyCode, resendCode, completeOnboarding, logout, updateBalance, setOnboardingStep]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
