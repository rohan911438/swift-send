import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContactItem } from '@/components/ContactItem';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { BottomNav } from '@/components/BottomNav';
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator';
import TransactionSigningDialog from '@/components/TransactionSigning';
import { CompliancePreCheck } from '@/components/ComplianceCheck';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useCompliance } from '@/contexts/ComplianceContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { createTransfer, checkTransferQueueStatus } from '@/lib/transfers';
import { contacts, calculateFees } from '@/data/mockData';
import { Contact, TransactionPreview } from '@/types';
import { ArrowLeft, ArrowRight, Search, DollarSign, Send, CheckCircle2, UserPlus, Mail, Phone, MessageCircle, Shield, Zap, Globe2, Star, Wallet, MapPin, AlertTriangle, CloudOff } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'recipient' | 'amount' | 'confirm' | 'success' | 'processing';

interface NewRecipient {
  identifier: string; // email or phone
  name?: string;
  type: 'email' | 'phone';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Transfer failed';
}

const MAX_TRANSFER_AMOUNT = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{8,14}$/;

export default function SendMoney() {
  const navigate = useNavigate();
  const { user, transactionSigningSecret, updateBalance } = useAuth();
  const { connectionState } = useWallet();
  const { checkTransactionCompliance } = useCompliance();
  const network = useNetworkStatus();
  const [step, setStep] = useState<Step>('recipient');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newRecipient, setNewRecipient] = useState<NewRecipient | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [amount, setAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWalletSigning, setShowWalletSigning] = useState(false);
  const [transactionPreview, setTransactionPreview] = useState<TransactionPreview | null>(null);
  const [useExternalWallet, setUseExternalWallet] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [queueJobId, setQueueJobId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll queue status until transfer completes
  useEffect(() => {
    if (!queueJobId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const status = await checkTransferQueueStatus(queueJobId);
        if (status.status === 'completed') {
          setStep('success');
          setQueueJobId(null);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          toast.success('Transfer completed successfully!');
        } else if (status.status === 'failed') {
          setSubmissionError(status.error || 'Transfer failed in the queue');
          setQueueJobId(null);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          toast.error(status.error || 'Transfer processing failed');
        }
      } catch (err: unknown) {
        // Continue polling on error
        console.error('Failed to check queue status:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollStatus, 1000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [queueJobId]);

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.phone.includes(searchQuery)
      ),
    [searchQuery]
  );

  // Detect if input is email or phone
  const detectRecipientType = (input: string): 'email' | 'phone' | null => {
    const sanitized = input.trim();
    if (EMAIL_REGEX.test(sanitized)) return 'email';
    if (PHONE_REGEX.test(sanitized.replace(/[\s()-]/g, ''))) return 'phone';
    return null;
  };

  const recipientInputType = useMemo(() => detectRecipientType(recipientInput), [recipientInput]);

  const isValidRecipientInput = useMemo(() => {
    return recipientInputType !== null;
  }, [recipientInputType]);

  const amountValue = useMemo(() => Number.parseFloat(amount) || 0, [amount]);

  const fees = useMemo(() => {
    return calculateFees(amountValue);
  }, [amountValue]);

  const amountError = useMemo(() => {
    if (!amount.trim()) return 'Amount is required';
    if (Number.isNaN(amountValue) || amountValue <= 0) return 'Enter a valid amount greater than zero';
    if (amountValue < 1) return 'Minimum transfer amount is $1.00';
    if (amountValue > MAX_TRANSFER_AMOUNT) return `Maximum transfer amount is $${MAX_TRANSFER_AMOUNT.toLocaleString()}`;
    if (amountValue > (user?.usdcBalance || 0)) return 'Insufficient balance';
    return null;
  }, [amount, amountValue, user?.usdcBalance]);
  const isNetworkOffline = network.status === 'offline';
  const networkBlockingMessage = isNetworkOffline ? 'Stellar is offline. Transfers are temporarily unavailable.' : null;

  const recipientError = useMemo(() => {
    if (!recipientInput.trim()) return 'Recipient email or phone is required';
    if (!isValidRecipientInput) return 'Enter a valid email or international phone number';
    return null;
  }, [isValidRecipientInput, recipientInput]);

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setNewRecipient(null);
    setSubmissionError(null);
    setStep('amount');
  }, []);

  const handleSelectNewRecipient = useCallback(() => {
    const type = detectRecipientType(recipientInput);
    if (!type) {
      toast.error('Please enter a valid email or phone number');
      return;
    }
    
    setNewRecipient({
      identifier: recipientInput.trim(),
      type,
      name: recipientInput.trim().split('@')[0] // Use email prefix or phone as name
    });
    setSelectedContact(null);
    setSubmissionError(null);
    setStep('amount');
  }, [recipientInput]);

  const handleAmountSubmit = useCallback(() => {
    if (amountError) {
      setSubmissionError(amountError);
      toast.error(amountError);
      return;
    }
    setSubmissionError(null);
    setStep('confirm');
  }, [amountError]);

  const handleConfirmSend = async () => {
    if (isNetworkOffline) {
      setSubmissionError(networkBlockingMessage);
      toast.error(networkBlockingMessage);
      return;
    }

    if (amountError) {
      setSubmissionError(amountError);
      toast.error(amountError);
      return;
    }

    // Check if user wants to use external wallet
    if (connectionState.isConnected && useExternalWallet) {
      // Prepare transaction for external wallet signing
      const destinationAddress = selectedContact?.phone || newRecipient?.identifier || '';
      setTransactionPreview({
        amount: amount,
        asset: 'USDC',
        destination: `stellar:${destinationAddress}`, // Mock stellar address conversion
        memo: `SwiftSend transfer to ${selectedContact?.name || newRecipient?.name || 'recipient'}`,
        networkFee: '0.00001',
        estimatedTime: '3-5 seconds'
      });
      setShowWalletSigning(true);
      return;
    }

    // Standard managed wallet transaction
    setIsProcessing(true);
    setSubmissionError(null);

    try {
      await submitTransfer();
      setStep('success');
      toast.success('Transfer submitted successfully');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setSubmissionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalletTransactionSuccess = async (txHash: string) => {
    setShowWalletSigning(false);
    setIsProcessing(true);
    setSubmissionError(null);

    try {
      await submitTransfer({ externalWalletTxHash: txHash });
      setStep('success');
      toast.success('Transfer completed with external wallet!', {
        description: `Transaction hash: ${txHash.slice(0, 8)}...`,
        action: {
          label: 'View Explorer',
          onClick: () => window.open(`https://stellar.expert/explorer/public/tx/${txHash}`, '_blank')
        }
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setSubmissionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWalletTransactionError = (error: string) => {
    setShowWalletSigning(false);
    setIsProcessing(false);
    setSubmissionError(error);
    toast.error('Transaction failed', {
      description: error
    });
  };

  const submitTransfer = useCallback(async (extraMetadata?: Record<string, unknown>) => {
    if (!user) {
      throw new Error('You must be signed in to send money');
    }
    if (!transactionSigningSecret) {
      throw new Error('Transaction signing is not available for this session');
    }

    const recipientName = selectedContact?.name || newRecipient?.name || 'Recipient';
    const recipientIdentifier = selectedContact?.phone || newRecipient?.identifier || '';

    const transfer = await createTransfer(
      {
        idempotency_key: `transfer_${Date.now()}`,
        from_wallet_id: user.walletAddress || user.id,
        user_id: user.id,
        amount: amountValue,
        currency: 'USDC',
        recipient: {
          type: 'cash_pickup',
          country: selectedContact?.country || 'US',
          metadata: {
            identifier: recipientIdentifier,
            name: recipientName,
            source: newRecipient ? newRecipient.type : 'recent_contact',
          },
        },
        compliance_tier: user.complianceTier,
        metadata: {
          initiated_from: 'send_money_page',
          network_fee: fees.networkFee,
          service_fee: fees.serviceFee,
          ...(extraMetadata || {}),
        },
      },
      transactionSigningSecret
    );

    // Queue response includes queue_job_id; start polling
    setQueueJobId(transfer.queue_job_id);
    setStep('processing');

    return transfer;
  }, [amountValue, fees.networkFee, fees.serviceFee, newRecipient, selectedContact, transactionSigningSecret, user]);

  const handleBack = useCallback(() => {
    if (step === 'amount') {
      setStep('recipient');
      setSelectedContact(null);
      setNewRecipient(null);
    }
    else if (step === 'confirm') setStep('amount');
    else if (step === 'processing') {
      // Don't allow going back during processing
      return;
    }
    else navigate('/dashboard');
  }, [navigate, step]);

  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6 animate-pulse">
            <Zap className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Processing Transfer</h1>
          <p className="text-muted-foreground mb-4">Your transfer is being processed and verified on the Stellar network.</p>
          <div className="space-y-2 mb-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{width: '60%'}} />
            </div>
            <p className="text-xs text-muted-foreground">This typically takes 5-30 seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-sm animate-scale-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Money Sent Successfully!
          </h1>
          <p className="text-muted-foreground mb-2">
            ${fees.recipientGets.toFixed(2)} is on its way to
          </p>
          <p className="font-semibold text-foreground text-lg mb-6">
            {selectedContact?.name || newRecipient?.name || 'Recipient'}
          </p>

          <div className="bg-card rounded-xl p-4 shadow-card mb-6">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-muted-foreground">Estimated arrival</span>
              <span className="font-semibold text-success">~5 seconds</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Your money is now on the Stellar network. The recipient can access it through various cash-out methods.
            </div>
          </div>

          {/* Cash-out options for recipient */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Cash Pickup Available
              </h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
              {selectedContact?.name || 'Recipient'} can pick up cash at thousands of locations in {selectedContact?.country || 'their country'}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => navigate(`/withdraw?recipient=${selectedContact?.id}`)}
            >
              Set Up Cash Pickup
            </Button>
          </div>

          <div className="space-y-2 mb-8">
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Back to Home
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/history')}
            >
              View Transaction History
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3 sm:gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">
            {step === 'recipient' && 'Send Money'}
            {step === 'amount' && 'Enter Amount'}
            {step === 'confirm' && 'Confirm Transfer'}
          </h1>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6">
        <div className="max-w-lg mx-auto">
          {/* Step 1: Select Recipient */}
          {step === 'recipient' && (
            <div className="space-y-6 animate-fade-in">
              {/* Quick Send to New Contact */}
              <div className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Send to anyone</span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      {recipientInputType === 'email' ? (
                        <Mail className="w-5 h-5 text-muted-foreground" />
                      ) : recipientInputType === 'phone' ? (
                        <Phone className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <UserPlus className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <Input
                      type="text"
                      inputMode={recipientInputType === 'email' ? 'email' : recipientInputType === 'phone' ? 'tel' : 'text'}
                      placeholder="Email or phone number"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleSelectNewRecipient}
                    disabled={!isValidRecipientInput}
                    variant={isValidRecipientInput ? "default" : "secondary"}
                    className="w-full sm:w-auto px-6 min-h-11"
                  >
                    Send
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  {recipientInputType === 'email' && '📧 We will send a secure link to their email'}
                  {recipientInputType === 'phone' && '📱 We will send a secure SMS to their phone'}
                  {!recipientInputType && recipientInput && '⚠️ Please enter a valid email or phone number'}
                  {!recipientInput && 'Enter an email address or phone number to send money instantly'}
                </p>
                {recipientError && recipientInput && (
                  <p className="text-xs text-destructive mt-1">{recipientError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">or choose recent</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              {/* Search Recent Recipients */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search recent recipients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12"
                />
              </div>

              {/* Recent Recipients */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Recent Recipients
                </p>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <ContactItem
                      key={contact.id}
                      contact={contact}
                      onClick={() => handleSelectContact(contact)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No recipients found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchQuery ? 'Try a different search term' : 'Start by entering an email or phone number above'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Enter Amount */}
          {step === 'amount' && (selectedContact || newRecipient) && (
            <div className="space-y-6 animate-fade-in">
              <NetworkStatusIndicator network={network} compact />

              {/* Recipient Display */}
              <div className="bg-card rounded-xl p-4 shadow-card">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-lg font-semibold text-primary-foreground">
                    {selectedContact ? 
                      selectedContact.name.charAt(0) : 
                      (newRecipient?.name?.charAt(0) || '?')
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      Sending to {selectedContact?.name || newRecipient?.name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {selectedContact ? (
                        <>
                          <Phone className="w-4 h-4" />
                          {selectedContact.phone}
                        </>
                      ) : newRecipient?.type === 'email' ? (
                        <>
                          <Mail className="w-4 h-4" />
                          {newRecipient.identifier}
                        </>
                      ) : (
                        <>
                          <Phone className="w-4 h-4" />
                          {newRecipient?.identifier}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">Enter amount to send</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="w-10 h-10 text-primary" />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onInput={() => setSubmissionError(null)}
                    placeholder="0.00"
                    className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground bg-transparent border-none outline-none w-40 sm:w-56 md:w-64 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                  <span className="text-xl sm:text-2xl font-semibold text-muted-foreground">USDC</span>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
                  <p className="text-muted-foreground">
                    Available: ${user?.usdcBalance?.toFixed(2)} USDC
                  </p>
                  {amountValue > (user?.usdcBalance || 0) && (
                    <p className="text-destructive font-medium">
                      ⚠️ Insufficient balance
                    </p>
                  )}
                </div>
                {amountError && amount.trim() && (
                  <p className="mt-2 text-sm text-destructive">{amountError}</p>
                )}
                {submissionError && !amountError && (
                  <p className="mt-2 text-sm text-destructive">{submissionError}</p>
                )}
                {networkBlockingMessage && (
                  <p className="mt-2 text-sm text-destructive">{networkBlockingMessage}</p>
                )}

                {/* Compliance Check for Amount */}
                {amount && amountValue > 0 && (
                  (() => {
                    const complianceCheck = checkTransactionCompliance(
                      amountValue, 
                      selectedContact?.countryCode || 'US'
                    );
                    
                    if (complianceCheck.warnings.length > 0 || !complianceCheck.canProceed) {
                      return (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-left">
                              {complianceCheck.requirements.length > 0 && (
                                <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                                  {complianceCheck.requirements.map((req, idx) => (
                                    <p key={idx}>• {req}</p>
                                  ))}
                                </div>
                              )}
                              {complianceCheck.warnings.length > 0 && (
                                <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                                  {complianceCheck.warnings.map((warning, idx) => (
                                    <p key={idx}>• {warning}</p>
                                  ))}
                                </div>
                              )}
                              {complianceCheck.upgradeIncentive && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                                  💡 {complianceCheck.upgradeIncentive}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}

                {/* Quick Amount Buttons */}
                <div className="flex gap-2 justify-center mt-6">
                  {[10, 25, 50, 100].map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(quickAmount.toString())}
                      disabled={quickAmount > (user?.usdcBalance || 0)}
                    >
                      ${quickAmount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Real-time Fee Breakdown */}
              {amountValue > 0 && (
                <div className="space-y-4">
                  <FeeBreakdown
                    amount={amountValue}
                    networkFee={fees.networkFee}
                    serviceFee={fees.serviceFee}
                    totalFee={fees.totalFee}
                    recipientGets={fees.recipientGets}
                  />
                  
                  {/* Compliance Check Display */}
                  {amountValue > 0 && (() => {
                    const recipientCountry = selectedContact?.countryCode || newRecipient?.name || 'US';
                    const complianceCheck = checkTransactionCompliance(amountValue, recipientCountry);
                    
                    if (complianceCheck.warnings.length > 0 || !complianceCheck.canProceed) {
                      return (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                                {!complianceCheck.canProceed ? 'Transfer Requires Review' : 'Transfer Notice'}
                              </h4>
                              {complianceCheck.warnings.map((warning, index) => (
                                <p key={index} className="text-sm text-amber-700 dark:text-amber-300">
                                  {warning}
                                </p>
                              ))}
                              {complianceCheck.upgradeIncentive && (
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                                  💡 {complianceCheck.upgradeIncentive}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="text-center space-y-2">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            ⚡ Instant Transfer • 🔒 Secure • 💰 Low Cost
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Transfer within your account limits • Bank-grade security
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleAmountSubmit}
                disabled={Boolean(amountError) || isNetworkOffline}
              >
                {!amount || amountValue <= 0 ? (
                  'Enter amount to continue'
                ) : isNetworkOffline ? (
                  'Network offline'
                ) : amountValue > (user?.usdcBalance || 0) ? (
                  'Insufficient balance'
                ) : amountValue > MAX_TRANSFER_AMOUNT ? (
                  `Max $${MAX_TRANSFER_AMOUNT.toLocaleString()} allowed`
                ) : (
                  <>
                    Review Transfer
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (selectedContact || newRecipient) && (
            <div className="space-y-6 animate-fade-in">
              <NetworkStatusIndicator network={network} />

              {/* Transfer Summary */}
              <div className="bg-card rounded-2xl p-6 shadow-soft">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl font-bold text-white mb-4">
                    {selectedContact ? 
                      selectedContact.name.charAt(0) : 
                      (newRecipient?.name?.charAt(0) || '?')
                    }
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Review Your Transfer
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Star className="w-4 h-4 text-blue-500" />
                    <span>Powered by Stellar Network</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">You're sending</span>
                    <span className="text-2xl font-bold text-foreground">${amountValue.toFixed(2)} USDC</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">To</span>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {selectedContact?.name || newRecipient?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedContact?.phone || newRecipient?.identifier}
                      </p>
                    </div>
                  </div>

                  {/* Network Information */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900 dark:text-blue-100">Settlement Time</span>
                      </div>
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">3-5 seconds</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <div className="flex items-center gap-2">
                        <Globe2 className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900 dark:text-blue-100">Network</span>
                      </div>
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">
                        {network.status === 'offline' ? 'Offline' : `Stellar Mainnet • ${network.latencyMs ?? '--'} ms`}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">They will receive</span>
                      <span className="text-2xl font-bold text-green-600">${fees.recipientGets.toFixed(2)} USDC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Fee Breakdown */}
              <FeeBreakdown
                amount={parseFloat(amount)}
                networkFee={fees.networkFee}
                serviceFee={fees.serviceFee}
                totalFee={fees.totalFee}
                recipientGets={fees.recipientGets}
              />

              {submissionError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {submissionError}
                </div>
              )}

              {/* Speed & Security Assurance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800 text-center">
                  <p className="text-green-600 text-2xl mb-1">⚡</p>
                  <p className="text-xs font-medium text-green-800 dark:text-green-200">Instant</p>
                  <p className="text-xs text-green-600 dark:text-green-300">~5 seconds</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-blue-600 text-2xl mb-1">🔒</p>
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Secure</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">Bank-grade</p>
                </div>
              </div>

              {/* Wallet Selection */}
              {connectionState.isConnected && (
                <div className="space-y-3">
                  <h3 className="font-medium text-foreground">Choose your payment method</h3>
                  
                  <div className="space-y-2">
                    {/* SwiftSend Wallet Option */}
                    <button
                      className={`w-full p-4 border rounded-lg text-left transition-colors ${
                        !useExternalWallet 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setUseExternalWallet(false)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">SwiftSend Wallet</p>
                            <p className="text-xs text-muted-foreground">Simple and fast</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          !useExternalWallet 
                            ? 'border-primary bg-primary' 
                            : 'border-border'
                        }`}>
                          {!useExternalWallet && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>}
                        </div>
                      </div>
                    </button>

                    {/* External Wallet Option */}
                    <button
                      className={`w-full p-4 border rounded-lg text-left transition-colors ${
                        useExternalWallet 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setUseExternalWallet(true)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{connectionState.provider} Wallet</p>
                            <p className="text-xs text-muted-foreground">Enhanced transparency</p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          useExternalWallet 
                            ? 'border-primary bg-primary' 
                            : 'border-border'
                        }`}>
                          {useExternalWallet && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Final CTA */}
              <CompliancePreCheck
                amount={amountValue}
                destination={selectedContact?.countryCode || newRecipient?.name || 'US'}
              >
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleConfirmSend}
                  disabled={isProcessing || Boolean(amountError) || isNetworkOffline}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"></div>
                      <span>Sending money...</span>
                    </div>
                  ) : isNetworkOffline ? (
                    <>
                      <CloudOff className="w-5 h-5" />
                      Network offline
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send ${amountValue.toFixed(2)}
                    </>
                  )}
                </Button>
              </CompliancePreCheck>

              <p className="text-xs text-center text-muted-foreground">
                By confirming, you authorize this transfer from your personal wallet
              </p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      {/* Transaction Signing Dialog */}
      {transactionPreview && (
        <TransactionSigningDialog
          isOpen={showWalletSigning}
          onClose={() => setShowWalletSigning(false)}
          transaction={transactionPreview}
          onSuccess={handleWalletTransactionSuccess}
          onError={handleWalletTransactionError}
        />
      )}
    </div>
  );
}
