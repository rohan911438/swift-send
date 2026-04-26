import { useState, useCallback } from 'react';
import { apiFetch } from '@/services/api';
import { toast } from 'sonner';

export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  error?: string;
}

export interface TwoFactorEnableRequest {
  secret: string;
  code: string;
}

export interface TwoFactorEnableResponse {
  success: boolean;
  backupCodes: string[];
}

export interface TwoFactorDisableRequest {
  code: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  methods: ('totp' | 'sms' | 'email')[];
}

export async function generateTwoFactorSecret(): Promise<TwoFactorSetupResponse> {
  const response = await apiFetch('/auth/2fa/setup', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to generate 2FA secret');
  }

  return response.json() as Promise<TwoFactorSetupResponse>;
}

export async function verifyTwoFactorCode(code: string): Promise<TwoFactorVerifyResponse> {
  const response = await apiFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  return response.json() as Promise<TwoFactorVerifyResponse>;
}

export async function enableTwoFactor(secret: string, code: string): Promise<TwoFactorEnableResponse> {
  const response = await apiFetch('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ secret, code }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Failed to enable 2FA' }));
    throw new Error(body.error);
  }

  return response.json() as Promise<TwoFactorEnableResponse>;
}

export async function disableTwoFactor(code: string): Promise<{ success: boolean }> {
  const response = await apiFetch('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error('Failed to disable 2FA');
  }

  return response.json() as Promise<{ success: boolean }>;
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatusResponse> {
  const response = await apiFetch('/auth/2fa/status');
  
  if (!response.ok) {
    throw new Error('Failed to get 2FA status');
  }

  return response.json() as Promise<TwoFactorStatusResponse>;
}

export async function regenerateBackupCodes(): Promise<{ backupCodes: string[] }> {
  const response = await apiFetch('/auth/2fa/backup-codes', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to regenerate backup codes');
  }

  return response.json() as Promise<{ backupCodes: string[] }>;
}

export function useTwoFactor() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getTwoFactorStatus();
      setStatus(result);
      return result;
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enable = useCallback(async (secret: string, code: string) => {
    setIsLoading(true);
    try {
      const result = await enableTwoFactor(secret, code);
      toast.success('Two-factor authentication enabled');
      await fetchStatus();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to enable 2FA';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const disable = useCallback(async (code: string) => {
    setIsLoading(true);
    try {
      await disableTwoFactor(code);
      toast.success('Two-factor authentication disabled');
      await fetchStatus();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to disable 2FA';
      toast.error(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus]);

  const verify = useCallback(async (code: string) => {
    const result = await verifyTwoFactorCode(code);
    return result;
  }, []);

  return {
    isLoading,
    status,
    fetchStatus,
    enable,
    disable,
    verify,
  };
}