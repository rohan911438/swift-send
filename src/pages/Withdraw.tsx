import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { withdrawalMethods, oxxoLocations, contacts } from '@/data/mockData';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { WithdrawalMethod, PickupLocation, Contact } from '@/types';
import { calculateWithdrawalFees } from '@/lib/fees';
import { 
  ArrowLeft, 
  MapPin, 
  Building2, 
  Smartphone, 
  Truck,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  Navigation,
  Star,
  Copy,
  ExternalLink,
  Shield,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

type Step = 'recipient' | 'method' | 'amount' | 'details' | 'processing' | 'success';

const getMethodIcon = (type: WithdrawalMethod['type']) => {
  switch (type) {
    case 'cash_pickup': return MapPin;
    case 'bank_transfer': return Building2;
    case 'mobile_money': return Smartphone;
    case 'home_delivery': return Truck;
    case 'digital_wallet': return Smartphone;
    default: return DollarSign;
  }
};

export default function Withdraw() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState<Step>('recipient');
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<PickupLocation | null>(null);
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string>('');

  // Get recipient from URL params if coming from send flow
  const recipientId = searchParams.get('recipient');
  
  const { rates, loading: ratesLoading } = useExchangeRate();
  
  const countryToCurrency: Record<string, string> = {
    'MX': 'MXN',
    'PH': 'PHP',
    'GT': 'GTQ',
    'SV': 'USD',
  };

  const getRecipientCurrency = (countryCode: string) => countryToCurrency[countryCode] || 'USD';
  
  const getExchangeRate = (countryCode: string) => {
    const currency = getRecipientCurrency(countryCode);
    return rates[currency] || 1;
  };

  const getAvailableMethods = (countryCode: string) => {
    return withdrawalMethods.filter(method => 
      method.availability.countries.includes(countryCode)
    );
  };

  const recipientCurrency = selectedRecipient ? getRecipientCurrency(selectedRecipient.countryCode) : 'USD';
  const recipientRate = selectedRecipient ? getExchangeRate(selectedRecipient.countryCode) : 1;
  
  const recipientExchange = {
    rate: recipientRate,
    currency: recipientCurrency
  };

  const fees = useMemo(() => {
    if (!selectedMethod || !amount) {
      const a = parseFloat(amount) || 0;
      return { fee: 0, total: a, net: a, recipient: 0, exchangeRate: recipientExchange.rate, currency: recipientExchange.currency };
    }

    return calculateWithdrawalFees({
      amount: parseFloat(amount) || 0,
      method: selectedMethod,
      exchangeRate: recipientExchange.rate,
      currency: recipientExchange.currency,
    });
  }, [selectedMethod, amount, recipientExchange]);

  const handleRecipientSelect = (contact: Contact) => {
    setSelectedRecipient(contact);
    setStep('method');
  };

  const handleMethodSelect = (method: WithdrawalMethod) => {
    setSelectedMethod(method);
    
    // For cash pickup methods, show location selection
    if (method.type === 'cash_pickup' && method.id === 'cash_pickup_mx') {
      // Auto-select first location for demo
      setSelectedLocation(oxxoLocations[0]);
    }
    
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
    if (parsedAmount > (user?.usdcBalance || 0)) {
      toast.error('Insufficient balance');
      return;
    }

    setStep('details');
  };

  const handleConfirmWithdrawal = async () => {
    if (!selectedMethod || !selectedRecipient) return;
    
    setIsProcessing(true);
    setStep('processing');

    // Generate confirmation code
    setConfirmationCode(`SW${Math.random().toString(36).substring(2, 8).toUpperCase()}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsProcessing(false);
    setStep('success');
    
    toast.success('Withdrawal request submitted successfully!');
  };

  const copyConfirmationCode = () => {
    navigator.clipboard.writeText(confirmationCode);
    toast.success('Confirmation code copied');
  };

  const renderRecipientSelection = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold mb-1">Select Recipient</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose who will receive the money
      </p>
      
      {contacts.map((contact) => (
        <Card key={contact.id} className="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              onClick={() => handleRecipientSelect(contact)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-medium">
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-medium">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{contact.country}</p>
                  <p className="text-xs text-muted-foreground">{contact.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {getRecipientCurrency(contact.countryCode)}
                </p>
                <p className="text-xs text-muted-foreground">
                  1 USD = {getExchangeRate(contact.countryCode).toFixed(2)} {getRecipientCurrency(contact.countryCode)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderMethodSelection = () => {
    if (!selectedRecipient) return null;
    
    const availableMethods = getAvailableMethods(selectedRecipient.countryCode);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setStep('recipient')}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-semibold">Select Withdrawal Method</h2>
            <p className="text-sm text-muted-foreground">for {selectedRecipient.name} in {selectedRecipient.country}</p>
          </div>
        </div>
        
        {availableMethods.map((method) => {
          const Icon = getMethodIcon(method.type);
          const isFast = method.processingTime.includes('minutes') || method.processingTime.includes('hour');
          
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
                        {isFast && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Fast
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
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Partner: {method.partnerName}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                Recipient Requirements
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-200">
                The recipient will need valid ID and the confirmation code to collect the money. 
                Make sure they have the required documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

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

      {selectedMethod && selectedRecipient && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {(() => {
                    const Icon = getMethodIcon(selectedMethod.type);
                    return <Icon className="w-4 h-4 text-primary" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-medium">{selectedMethod.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    to {selectedRecipient.name} in {selectedRecipient.country}
                  </p>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{recipientExchange.currency}</div>
                <div className="text-muted-foreground">1 USD = {recipientExchange.rate}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Send Amount (USD)</label>
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
              Min: ${selectedMethod.limits.min} • Max: ${selectedMethod.limits.max}
            </p>
          )}
        </div>

        {amount && selectedMethod && selectedRecipient && (
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span>You send</span>
                <span>${fees.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Fees</span>
                <span>${fees.fee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Exchange rate</span>
                <span>1 USD = {fees.exchangeRate} {fees.currency}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-medium">
                <span>Recipient gets</span>
                <span className="text-primary">{fees.recipient} {fees.currency}</span>
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
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">{selectedRecipient?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method</span>
            <span className="font-medium">{selectedMethod?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Partner</span>
            <span className="font-medium">{selectedMethod?.partnerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Send amount</span>
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
            <span>Recipient gets</span>
            <span className="text-primary">{fees.recipient} {fees.currency}</span>
          </div>
        </CardContent>
      </Card>

      {selectedLocation && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <h4 className="font-medium">Pickup Location</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-medium">{selectedLocation.name}</div>
              <div className="text-muted-foreground">{selectedLocation.address}</div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{selectedLocation.hours}</span>
                {selectedLocation.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{selectedLocation.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedMethod?.requirements && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h4 className="font-medium">Recipient Requirements</h4>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {selectedMethod.requirements.map((req, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Button 
        onClick={handleConfirmWithdrawal} 
        className="w-full h-12"
        disabled={isProcessing}
      >
        Confirm Transfer
      </Button>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Processing Transfer</h2>
        <p className="text-muted-foreground">
          Setting up your withdrawal request...
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
        <h2 className="text-xl font-semibold">Transfer Submitted!</h2>
        <p className="text-muted-foreground">
          Your money transfer has been successfully submitted
        </p>
      </div>

      {confirmationCode && (
        <Card className="w-full">
          <CardContent className="p-4">
            <div className="text-center space-y-3">
              <h4 className="font-medium">Confirmation Code</h4>
              <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
                {confirmationCode}
                <button 
                  onClick={copyConfirmationCode}
                  className="p-1 hover:bg-secondary rounded"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this code with {selectedRecipient?.name} for pickup
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="w-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="font-medium">What happens next?</h4>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              Transfer submitted and being processed
            </li>
            <li className="flex gap-2">
              <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              Funds will be ready for pickup in {selectedMethod?.processingTime.toLowerCase()}
            </li>
            <li className="flex gap-2">
              <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              Recipient can collect at any {selectedMethod?.partnerName} location
            </li>
          </ul>
        </CardContent>
      </Card>

      <Button onClick={() => navigate('/dashboard')} className="w-full h-12">
        Return to Dashboard
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="px-6 pt-6">
        <div className="max-w-lg mx-auto">
          {step === 'recipient' && renderRecipientSelection()}
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