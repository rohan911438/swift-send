import { useState, useCallback } from 'react';
import { Fingerprint, KeyRound, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AuthMethod = 'biometric' | 'pin' | 'otp';
type AuthState = 'idle' | 'pending' | 'success' | 'error';

interface BiometricAuthProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  title?: string;
  description?: string;
}

async function requestBiometric(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function BiometricAuth({
  onSuccess,
  onCancel,
  className,
  title = 'Verify Identity',
  description = 'Authenticate to continue',
}: BiometricAuthProps) {
  const [method, setMethod] = useState<AuthMethod>('biometric');
  const [state, setState] = useState<AuthState>('idle');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const biometricSupported =
    typeof window !== 'undefined' && !!window.PublicKeyCredential;

  const handleBiometric = useCallback(async () => {
    setState('pending');
    setErrorMsg('');
    const ok = await requestBiometric();
    if (ok) {
      setState('success');
      onSuccess?.();
    } else {
      setState('error');
      setErrorMsg('Biometric check failed. Try PIN or OTP instead.');
    }
  }, [onSuccess]);

  const handlePin = useCallback(() => {
    if (pin.length < 4) {
      setErrorMsg('PIN must be at least 4 digits.');
      return;
    }
    setState('pending');
    setErrorMsg('');
    setTimeout(() => {
      setState('success');
      onSuccess?.();
    }, 600);
  }, [pin, onSuccess]);

  const handleOtp = useCallback(() => {
    if (otp.length < 6) {
      setErrorMsg('OTP must be 6 digits.');
      return;
    }
    setState('pending');
    setErrorMsg('');
    setTimeout(() => {
      setState('success');
      onSuccess?.();
    }, 600);
  }, [otp, onSuccess]);

  if (state === 'success') {
    return (
      <div className={cn('flex flex-col items-center gap-3 py-8', className)}>
        <div className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 p-4">
          <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-foreground">Verified successfully</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        {([
          { id: 'biometric', label: 'Face / Touch', disabled: !biometricSupported },
          { id: 'pin', label: 'PIN', disabled: false },
          { id: 'otp', label: 'OTP', disabled: false },
        ] as { id: AuthMethod; label: string; disabled: boolean }[]).map(({ id, label, disabled }) => (
          <button
            key={id}
            onClick={() => { if (!disabled) { setMethod(id); setErrorMsg(''); } }}
            disabled={disabled}
            className={cn(
              'flex-1 py-1.5 font-medium transition-colors',
              id === method
                ? 'bg-primary text-primary-foreground'
                : disabled
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {method === 'biometric' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <button
            onClick={handleBiometric}
            disabled={state === 'pending'}
            className="group rounded-full border-2 border-primary p-6 transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            {state === 'pending' ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <Fingerprint className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            {state === 'pending' ? 'Waiting for biometric…' : 'Tap to authenticate'}
          </p>
        </div>
      )}

      {method === 'pin' && (
        <div className="space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="pl-9"
            />
          </div>
          <Button
            className="w-full"
            onClick={handlePin}
            disabled={state === 'pending' || pin.length < 4}
          >
            {state === 'pending' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify PIN
          </Button>
        </div>
      )}

      {method === 'otp' && (
        <div className="space-y-3">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          />
          <p className="text-xs text-muted-foreground">
            Enter the one-time passcode sent to your registered device.
          </p>
          <Button
            className="w-full"
            onClick={handleOtp}
            disabled={state === 'pending' || otp.length < 6}
          >
            {state === 'pending' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify OTP
          </Button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {onCancel && (
        <Button variant="ghost" className="w-full text-sm" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
