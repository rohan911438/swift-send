import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, ArrowLeft, Wallet, Shield, Lock, CheckCircle2, Sparkles } from 'lucide-react';

export default function OnboardingWallet() {
  const [isCreating, setIsCreating] = useState(false);
  const [walletCreated, setWalletCreated] = useState(false);
  const { setOnboardingStep, completeOnboarding, authUser } = useAuth();

  const handleCreateWallet = async () => {
    setIsCreating(true);
    
    // Simulate wallet creation process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setWalletCreated(true);
    setIsCreating(false);
    
    // Auto-complete onboarding after showing success
    setTimeout(async () => {
      // Get stored profile data
      const storedProfile = localStorage.getItem('onboarding-profile');
      const profileData = storedProfile ? JSON.parse(storedProfile) : {};
      
      await completeOnboarding({
        name: profileData.name || 'User',
        email: authUser?.email || profileData.email,
        phone: authUser?.phone || profileData.phone
      });
      
      // Clean up stored data
      localStorage.removeItem('onboarding-profile');
    }, 2000);
  };

  if (walletCreated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg mx-auto text-center">
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

  if (isCreating) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Creating your personal wallet...
            </h1>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-pulse">🔐</div>
                <span>Generating secure encryption keys</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-pulse">🌐</div>
                <span>Setting up global payment network</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-pulse">✨</div>
                <span>Finalizing your personal account</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This may take a few seconds...
            </p>
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