import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, Globe, Shield, ArrowRight, Mail, Phone, Star, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuthFormProps {
  onNeedsVerification: () => void;
}

export default function AuthForm({ onNeedsVerification }: AuthFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState<'email' | 'phone' | 'auto'>('auto');
  const { login } = useAuth();

  // Auto-detect input type
  const detectInputType = (value: string) => {
    if (value.includes('@')) {
      setInputType('email');
    } else if (/^[\+]?[(]?[\d\s\-\(\)]{3,}/.test(value)) {
      setInputType('phone');
    } else {
      setInputType('auto');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIdentifier(value);
    detectInputType(value);
  };

  const getInputIcon = () => {
    switch (inputType) {
      case 'email':
        return <Mail className="w-5 h-5 text-muted-foreground" />;
      case 'phone':
        return <Phone className="w-5 h-5 text-muted-foreground" />;
      default:
        return <Mail className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getPlaceholder = () => {
    switch (inputType) {
      case 'email':
        return 'Enter your email address';
      case 'phone':
        return 'Enter your phone number';
      default:
        return 'Email or phone number';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your email or phone number');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(identifier);
      
      if (result.needsVerification) {
        onNeedsVerification();
        if (result.isNewUser) {
          toast.success('Welcome! Please verify your account.');
        } else {
          toast.success('Please verify your identity.');
        }
      } else {
        toast.success('Welcome back!');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="gradient-hero px-6 pt-12 pb-16 text-primary-foreground">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold">SwiftSend</span>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 px-3 py-1 rounded-full">
              <Lock className="w-4 h-4" />
              <span className="text-sm font-medium">Secured</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-3 leading-tight">
            Institutional-grade
            <br />
            digital payments
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-6">
            Send USDC globally on the Stellar network. Bank-level security, instant settlement.
          </p>
          
          <div className="flex items-center gap-4 text-sm opacity-90">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-blue-300" />
              <span>Stellar Network</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-300" />
              <span>FDIC Protected</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-purple-300" />
              <span>SOC 2 Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 -mt-8 mb-6">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-3">
          {[
            { icon: Zap, label: '3-5 Sec', desc: 'Settlement time', color: 'text-blue-600' },
            { icon: Shield, label: '$0.01', desc: 'Network fee', color: 'text-green-600' },
            { icon: Globe, label: '190+', desc: 'Countries', color: 'text-purple-600' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div
              key={label}
              className="bg-card rounded-xl p-4 shadow-card text-center animate-slide-up"
            >
              <div className={`w-10 h-10 mx-auto rounded-lg bg-muted flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="font-bold text-sm text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Form */}
      <div className="flex-1 px-6 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-2xl p-6 shadow-soft">
            <h2 className="text-xl font-bold text-foreground mb-1">Get started</h2>
            <p className="text-muted-foreground mb-6">
              Create your account or sign in securely
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Email or Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {getInputIcon()}
                  </div>
                  <Input
                    id="identifier"
                    type="text"
                    inputMode={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
                    placeholder={getPlaceholder()}
                    value={identifier}
                    onChange={handleInputChange}
                    className={cn(
                      "w-full pl-10 transition-colors",
                      inputType === 'email' && "border-blue-200 focus:border-blue-500",
                      inputType === 'phone' && "border-green-200 focus:border-green-500"
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {inputType === 'email' && 'We will send a verification code to your email'}
                  {inputType === 'phone' && 'We will send a verification code via SMS'}
                  {inputType === 'auto' && 'Choose email or phone number to get started'}
                </p>
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading || !identifier.trim()}
              >
                {isLoading ? (
                  <span className="animate-pulse-soft">Processing...</span>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground mb-4">
                By continuing, you agree to our{' '}
                <a href="#" className="text-primary hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </p>
              
              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Regulated Financial Institution</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Licensed money transmitter with SOC 2 Type II compliance and FDIC insurance protection
                  </p>
                </div>
                
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                    <Star className="w-3 h-3" />
                    <span>Stellar Network Infrastructure</span>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Built on institutional-grade blockchain infrastructure with 99.99% uptime
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}