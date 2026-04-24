import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { fundingMethods } from '@/data/mockData';
import { FundingMethod } from '@/types';
import { calculateFundingFees } from '@/lib/fees';
import { 
  ArrowLeft, 
  Building2, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Bitcoin,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Shield,
  Zap,
  Info,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

type Step = 'method' | 'amount' | 'details' | 'processing' | 'success';

const getMethodIcon = (type: FundingMethod['type']) => {
  switch (type) {
    case 'bank_transfer': return Building2;
    case 'card': return CreditCard;
    case 'cash_deposit': return Banknote;
    case 'mobile_money': return Smartphone;
    case 'crypto_transfer': return Bitcoin;
    default: return DollarSign;
  }
};

export default function AddFunds() {
  const navigate = useNavigate();
  const { user, updateBalance } = useAuth();
  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<FundingMethod | null>(null);
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositCode, setDepositCode] = useState<string>('');

  const availableMethods = fundingMethods.filter(method => 
    method.status === 'available' && method.regions.includes('US')
  );

  const fees = useMemo(() => {
    if (!selectedMethod || !amount) return { fee: 0, total: parseFloat(amount) || 0, net: parseFloat(amount) || 0 };
    return calculateFundingFees(parseFloat(amount) || 0, selectedMethod);
  }, [selectedMethod, amount]);

  const handleMethodSelect = (method: FundingMethod) => {
    setSelectedMethod(method);
    setStep('amount');
  };

  const handleAmountSubmit = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!selectedMethod) return;

    if (parsedAmount < selectedMethod.limits.min) {
      toast.error(`Minimum amount is $${selectedMethod.limits.min}`);
      return;
    }
    if (parsedAmount > selectedMethod.limits.max) {
      toast.error(`Maximum amount is $${selectedMethod.limits.max}`);
      return;
    }

    setStep('details');
  };

  const handleSubmitFunding = async () => {
    if (!selectedMethod) return;
    
    setIsProcessing(true);
    setStep('processing');

    // Generate deposit code for cash deposits
    if (selectedMethod.type === 'cash_deposit') {
      setDepositCode(`SW${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
    }

    // Simulate processing time
    const processingTime = selectedMethod.type === 'card' ? 1000 : 
                          selectedMethod.type === 'crypto_transfer' ? 3000 : 
                          5000;
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // For instant methods, add funds immediately
    if (selectedMethod.processingTime === 'Instant' || selectedMethod.type === 'card') {
      const currentBalance = user?.usdcBalance || 0;
      updateBalance(currentBalance + parseFloat(amount));
      toast.success('Funds added successfully!');
    } else {
      toast.success('Funding request submitted successfully!');
    }
    
    setIsProcessing(false);
    setStep('success');
  };

  const renderMethodSelection = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-1">Add Funds</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose how you'd like to add money to your SwiftSend account
      </p>
      
      {availableMethods.map((method) => {
        const Icon = getMethodIcon(method.type);
        const isInstant = method.processingTime === 'Instant';
        
        return (
          <Card key={method.id} className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                onClick={() => handleMethodSelect(method)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{method.name}</h3>
                      {isInstant && (
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          Instant
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{method.processingTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>
                          {method.fees.percentage 
                            ? `${method.fees.percentage}% + $${method.fees.fixed || 0}`
                            : method.fees.fixed 
                            ? `$${method.fees.fixed}`
                            : 'Free'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Secure & Protected
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-200">
              All funding methods use bank-level security and encryption. Your account is FDIC protected up to $250,000.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAmountInput = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setStep('method')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-semibold">Enter Amount</h2>
      </div>

      {selectedMethod && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {(() => {
                  const Icon = getMethodIcon(selectedMethod.type);
                  return <Icon className="w-4 h-4 text-primary" />;
                })()}
              </div>
              <div>
                <h3 className="font-medium">{selectedMethod.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMethod.processingTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Amount (USD)</label>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="text-2xl h-14 text-center"
          />
          {selectedMethod && (
            <p className="text-xs text-muted-foreground mt-1">
              Min: ${selectedMethod.limits.min} • Max: ${selectedMethod.limits.max} • Daily limit: ${selectedMethod.limits.dailyLimit}
            </p>
          )}
        </div>

        {amount && selectedMethod && (
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Amount</span>
                <span>${fees.net}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fees</span>
                <span>${fees.fee}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-medium">
                <span>You'll pay</span>
                <span>${fees.total}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button 
          onClick={handleAmountSubmit} 
          className="w-full h-12"
          disabled={!amount || parseFloat(amount) <= 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setStep('amount')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-semibold">Confirm Details</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="font-medium">{selectedMethod?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">${amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fees</span>
            <span className="font-medium">${fees.fee}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Processing time</span>
            <span className="font-medium">{selectedMethod?.processingTime}</span>
          </div>
          <div className="border-t pt-4 flex justify-between text-lg font-semibold">
            <span>Total cost</span>
            <span>${fees.total}</span>
          </div>
        </CardContent>
      </Card>

      {selectedMethod?.instructions && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <h4 className="font-medium">Next Steps</h4>
            </div>
            <ol className="space-y-1 text-sm text-muted-foreground">
              {selectedMethod.instructions.map((instruction, index) => (
                <li key={index} className="flex gap-3">
                  <span className="text-primary font-medium">{index + 1}.</span>
                  {instruction}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Button 
        onClick={handleSubmitFunding} 
        className="w-full h-12"
        disabled={isProcessing}
      >
        {selectedMethod?.type === 'cash_deposit' ? 'Get Deposit Code' : 'Confirm Funding'}
      </Button>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Processing Your Request</h2>
        <p className="text-muted-foreground">
          {selectedMethod?.type === 'card' 
            ? 'Verifying your payment...'
            : selectedMethod?.type === 'crypto_transfer'
            ? 'Confirming blockchain transaction...'
            : 'Setting up your funding request...'}
        </p>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">
          {selectedMethod?.processingTime === 'Instant' ? 'Funds Added!' : 'Request Submitted!'}
        </h2>
        <p className="text-muted-foreground">
          {selectedMethod?.processingTime === 'Instant' 
            ? `$${amount} has been added to your account`
            : `Your funding request is being processed`}
        </p>
      </div>

      {selectedMethod?.type === 'cash_deposit' && depositCode && (
        <Card className="w-full">
          <CardContent className="p-4 text-center">
            <h4 className="font-medium mb-2">Your Deposit Code</h4>
            <div className="text-2xl font-bold text-primary mb-2">{depositCode}</div>
            <p className="text-sm text-muted-foreground">
              Show this code at any participating location to deposit cash
            </p>
          </CardContent>
        </Card>
      )}

      {selectedMethod?.processingTime !== 'Instant' && (
        <Card className="w-full">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <h4 className="font-medium">Estimated completion</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Your funds will be available in {selectedMethod?.processingTime.toLowerCase()}. 
              We'll notify you once the transfer is complete.
            </p>
          </CardContent>
        </Card>
      )}

      <Button onClick={() => navigate('/dashboard')} className="w-full h-12">
        Return to Dashboard
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="px-6 pt-6">
        <div className="max-w-lg mx-auto">
          {step === 'method' && renderMethodSelection()}
          {step === 'amount' && renderAmountInput()}
          {step === 'details' && renderDetails()}
          {step === 'processing' && renderProcessing()}
          {step === 'success' && renderSuccess()}
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}