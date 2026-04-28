import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  balance: number;
}

interface AuthUser {
  email?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  onboardingStep: string | null;
  transactionSigningSecret: string | null;
  login: (identifier: string) => Promise<void>;
  logout: () => void;
  verifyCode: (code: string) => Promise<void>;
  resendCode: () => Promise<void>;
  setOnboardingStep: (step: string | null) => void;
  completeOnboarding: () => void;
  updateBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);

  const login = async (identifier: string) => {
    // Mock login
    setAuthUser({ email: identifier });
  };

  const verifyCode = async (code: string) => {
    // Mock verification
    setUser({
      id: "user_123",
      email: authUser?.email,
      phone: authUser?.phone,
      name: "Test User",
      balance: 1000,
    });
  };

  const resendCode = async () => {
    // Mock resend
  };

  const logout = () => {
    setUser(null);
    setAuthUser(null);
    setOnboardingStep(null);
  };

  const completeOnboarding = () => {
    setOnboardingStep(null);
  };

  const updateBalance = (newBalance: number) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authUser,
        isAuthenticated: !!user,
        onboardingStep,
        transactionSigningSecret: null,
        login,
        logout,
        verifyCode,
        resendCode,
        setOnboardingStep,
        completeOnboarding,
        updateBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
