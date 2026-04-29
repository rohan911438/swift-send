import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Zap, Shield, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationFormProps {
  onBack: () => void;
}

export default function VerificationForm({ onBack }: VerificationFormProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [otpExpiry, setOtpExpiry] = useState(300); // 5 minutes OTP expiry
  const [isOtpExpired, setIsOtpExpired] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockRemaining, setLockRemaining] = useState<number | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { verifyCode, resendCode, unlockAccount, authUser } = useAuth();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isEmail = authUser?.email;
  const identifier = authUser?.email || authUser?.phone || '';
  const maskedIdentifier = isEmail 
    ? identifier.replace(/(.{2}).*(@.*)/, '$1***$2')
    : identifier.replace(/(.{3}).*(.{4})/, '$1***$2');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // OTP expiry countdown
  useEffect(() => {
    if (otpExpiry > 0) {
      const timer = setTimeout(() => setOtpExpiry(otpExpiry - 1), 1000);
      return () => clearTimeout(timer);
    }

    setIsOtpExpired(true);
  }, [otpExpiry]);

  useEffect(() => {
    if (lockRemaining === null) {
      return;
    }

    if (lockRemaining <= 0) {
      setLockRemaining(null);
      setLockError(null);
      return;
    }

    const timer = setTimeout(() => setLockRemaining(lockRemaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockRemaining]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const verificationCode = code.join('');
    
    if (verificationCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    if (isOtpExpired) {
      toast.error('Verification code has expired. Please request a new code.');
      return;
    }

    setIsLoading(true);
    setLockError(null);
    try {
      await verifyCode(verificationCode);
      toast.success('Account verified successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid verification code. Please try again.';
      if (message.toLowerCase().includes('locked')) {
        setLockError(message);
        const lockedSeconds = error instanceof Error ? (error as any).lockedSeconds : undefined;
        if (typeof lockedSeconds === 'number') {
          setLockRemaining(lockedSeconds);
        }
      } else {
        toast.error('Invalid verification code. Please try again.');
      }
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendCode();
      setCountdown(30);
      setOtpExpiry(300); // Reset OTP expiry to 5 minutes
      setIsOtpExpired(false);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      toast.success('Verification code sent!');
    } catch (error) {
      toast.error('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      await unlockAccount();
      setLockError(null);
      toast.success('Account has been unlocked. You can try again.');
    } catch (error) {
      toast.error('Unable to unlock account. Please try again later.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground mb-8 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold">SwiftSend</span>
          </div>
        </div>
      </div>

      {/* Verification Form */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Verify your account
            </h1>
            <p className="text-muted-foreground">
              We sent a 6-digit code to {' '}
              <span className="font-medium text-foreground">{maskedIdentifier}</span>
            </p>
            
            {/* Development Mode Helper */}
            {window.location.hostname === 'localhost' && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  🚀 Development Mode
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-300">
                  Use code: <span className="font-mono font-bold">123456</span> or any 6-digit number
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Expiry Timer */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`text-sm font-medium ${isOtpExpired ? 'text-red-600' : 'text-muted-foreground'}`}>
                {isOtpExpired ? (
                  <span className="flex items-center gap-1">
                    ⚠️ Code expired
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Expires in {Math.floor(otpExpiry / 60)}:{(otpExpiry % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-3 text-center">
                Enter verification code
              </label>
              <div className="flex justify-center gap-2">
                {code.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={isOtpExpired}
                    className={`w-12 h-12 text-center text-lg font-semibold ${isOtpExpired ? 'opacity-50 cursor-not-allowed' : ''}`}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              {isOtpExpired && (
                <p className="text-xs text-red-600 text-center mt-2">
                  Please request a new verification code
                </p>
              )}
            </div>

            {lockError && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{lockError}</p>
                {lockRemaining !== null && (
                  <p className="text-xs mt-2 text-destructive/80">
                    Try again in {Math.ceil(lockRemaining / 1)} second{lockRemaining === 1 ? '' : 's'}.
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUnlock}
                    disabled={isUnlocking}
                  >
                    {isUnlocking ? 'Unlocking…' : 'Reset attempts'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={isResending}
                  >
                    {isResending ? 'Resending…' : 'Resend code'}
                  </Button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading || code.join('').length !== 6 || isOtpExpired}
            >
              {isLoading ? (
                <span className="animate-pulse-soft">Verifying...</span>
              ) : (
                <>
                  Verify Account
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              {countdown > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Resend in {countdown} seconds
                </p>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-primary hover:text-primary/80"
                >
                  {isResending ? 'Sending...' : 'Resend code'}
                </Button>
              )}
            </div>
          </form>

          <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Security Notice
                </p>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  Your personal wallet is being secured with bank-grade encryption. 
                  This verification ensures only you can access your funds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}