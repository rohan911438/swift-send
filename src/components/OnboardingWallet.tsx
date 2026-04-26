import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, ArrowLeft, Wallet, Shield, Lock, CheckCircle2, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

// #94: explicit step ladder so the in-progress screen renders a tracker
// instead of a static blob. Each phase has a label the user can read off
// and a stable id we can target with `data-testid` in tests.
type WalletCreationStep = {
  id: 'keys' | 'network' | 'finalize';
  label: string;
};

const WALLET_CREATION_STEPS: WalletCreationStep[] = [
  { id: 'keys', label: 'Generating secure encryption keys' },
  { id: 'network', label: 'Connecting to the global payment network' },
  { id: 'finalize', label: 'Finalizing your personal account' },
];

type Phase = 'idle' | 'creating' | 'success' | 'failed';

export default function OnboardingWallet() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { setOnboardingStep, completeOnboarding, authUser } = useAuth();

  // Allow the test suite to inject a deterministic delay; default keeps
  // the live UX feel.
  const stepDelayMs =
    typeof window !== 'undefined' &&
    (window as unknown as { __ONBOARDING_WALLET_STEP_MS__?: number })
      .__ONBOARDING_WALLET_STEP_MS__ !== undefined
      ? (window as unknown as { __ONBOARDING_WALLET_STEP_MS__?: number })
          .__ONBOARDING_WALLET_STEP_MS__!
      : 800;

  const handleCreateWallet = useCallback(async () => {
    setPhase('creating');
    setErrorMessage(null);
    setActiveStepIdx(0);
    setAttempt((a) => a + 1);

    try {
      // Drive the visible progress ladder one step at a time so the user
      // sees something happening instead of a single 3s spinner.
      for (let i = 0; i < WALLET_CREATION_STEPS.length; i += 1) {
        setActiveStepIdx(i);
        await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
      }

      const storedProfile = localStorage.getItem('onboarding-profile');
      const profileData = storedProfile ? JSON.parse(storedProfile) : {};

      await completeOnboarding({
        name: profileData.name || 'User',
        email: authUser?.email || profileData.email,
        phone: authUser?.phone || profileData.phone,
      });

      localStorage.removeItem('onboarding-profile');
      setPhase('success');
    } catch (err) {
      // #94: present a recoverable failure surface — no thrown rejection
      // bubbles up to a blank screen, retry button is wired so the user
      // can recover without restarting onboarding.
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong setting up your wallet.';
      setErrorMessage(message);
      setPhase('failed');
    }
  }, [authUser?.email, authUser?.phone, completeOnboarding, stepDelayMs]);

  if (phase === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg mx-auto text-center" data-testid="onboarding-wallet-success">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-3">
              Your wallet is ready! 🎉
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              You can now send money anywhere in the world, instantly and securely.
            </p>

            <div className="animate-pulse-soft text-muted-foreground">
              Taking you to your dashboard...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'creating') {
    const completedSteps = activeStepIdx;
    const totalSteps = WALLET_CREATION_STEPS.length;
    const percent = Math.min(
      100,
      Math.round(((completedSteps + 1) / totalSteps) * 100),
    );
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-6">
          <div
            className="max-w-lg mx-auto text-center w-full"
            data-testid="onboarding-wallet-creating"
            aria-live="polite"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-3">
              Creating your personal wallet…
            </h1>

            {/* #94: visible progress bar so the user can see we're not
                stuck — pinned to the active step ladder below. */}
            <div
              className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="onboarding-wallet-progressbar"
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              Step {completedSteps + 1} of {totalSteps}
            </p>

            <ul className="space-y-2 mb-6 text-left mx-auto max-w-xs">
              {WALLET_CREATION_STEPS.map((step, idx) => {
                const status =
                  idx < completedSteps
                    ? 'done'
                    : idx === completedSteps
                      ? 'in_progress'
                      : 'pending';
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`onboarding-wallet-step-${step.id}`}
                    data-status={status}
                  >
                    {status === 'done' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
                    )}
                    {status === 'in_progress' && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />
                    )}
                    {status === 'pending' && (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground/40" aria-hidden="true" />
                    )}
                    <span
                      className={
                        status === 'pending'
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="text-sm text-muted-foreground">
              This may take a few seconds…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-6">
          <div
            className="max-w-lg mx-auto text-center w-full"
            data-testid="onboarding-wallet-failed"
            role="alert"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-amber-600" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Wallet setup didn't finish
            </h1>
            <p className="text-muted-foreground mb-2">
              {errorMessage ?? 'Something went wrong setting up your wallet.'}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Attempt {attempt}. Your information is safe — no funds were moved.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setOnboardingStep(2)}
                data-testid="onboarding-wallet-back"
              >
                Go back
              </Button>
              <Button
                variant="hero"
                onClick={handleCreateWallet}
                data-testid="onboarding-wallet-retry"
              >
                Retry setup
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setOnboardingStep(2)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold">SwiftSend</span>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-1 bg-primary rounded-full"></div>
            <div className="w-8 h-1 bg-primary rounded-full"></div>
            <div className="w-8 h-1 bg-primary rounded-full"></div>
            <span className="text-sm text-muted-foreground ml-2">Step 3 of 3</span>
          </div>
        </div>
      </div>

      {/* Wallet Setup */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Create your personal wallet
            </h1>
            <p className="text-muted-foreground">
              Your secure account for global money transfers
            </p>
          </div>

          {/* Security Features */}
          <div className="space-y-4 mb-8">
            {[
              {
                icon: Shield,
                title: 'Bank-Grade Security',
                description: 'Your wallet uses the same security as major banks',
                color: 'text-green-600'
              },
              {
                icon: Lock,
                title: 'Private & Encrypted',
                description: 'Only you have access to your funds and data',
                color: 'text-blue-600'
              },
              {
                icon: Wallet,
                title: 'Instant Access',
                description: 'Send money anywhere, anytime, in seconds',
                color: 'text-purple-600'
              }
            ].map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="p-4 rounded-xl border bg-card shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Wallet Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-foreground mb-2">What happens next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Your personal wallet will be created instantly</li>
              <li>• You can add money using bank transfers or cards</li>
              <li>• Start sending money to friends and family globally</li>
              <li>• Track all your transactions in one place</li>
              <li>• Later, connect your own Stellar wallet for advanced features</li>
            </ul>
          </div>

          <Button
            onClick={handleCreateWallet}
            variant="hero"
            size="lg"
            className="w-full"
          >
            Create My Wallet
            <Sparkles className="w-5 h-5" />
          </Button>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">
              By creating your wallet, you agree to our security and privacy terms
            </p>
            <p className="text-xs text-muted-foreground">
              💡 <strong>Advanced users:</strong> You can connect your own Stellar wallet 
              later from Settings for enhanced control and transparency.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}