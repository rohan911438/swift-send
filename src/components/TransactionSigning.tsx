import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ExternalLink,
  Wallet,
  Shield,
  Eye,
  Copy,
  RefreshCw
} from 'lucide-react';
import { TransactionPreview, WalletTransaction } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { StatusBadge } from './StatusBadge';

interface TransactionSigningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionPreview;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
}

function mapWalletStatusToUiStatus(status: WalletTransaction['status']) {
  if (status === 'success') return 'completed' as const;
  if (status === 'submitted') return 'processing' as const;
  if (status === 'pending') return 'pending' as const;
  return 'failed' as const;
}

export default function TransactionSigningDialog({
  isOpen,
  onClose,
  transaction,
  onSuccess,
  onError
}: TransactionSigningDialogProps) {
  const { connectionState, signTransaction, isSigningTransaction } = useWallet();
  const [step, setStep] = useState<'review' | 'signing' | 'success' | 'error'>('review');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setTxHash(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSign = async () => {
    if (isSigningTransaction || step === 'signing') {
      return;
    }

    if (!connectionState.isConnected) {
      toast.error('No wallet connected');
      onError('No wallet connected');
      return;
    }

    setStep('signing');
    const toastId = toast.loading('Waiting for wallet approval...', {
      description: `Please confirm in your ${connectionState.provider} wallet.`,
    });
    
    try {
      const hash = await signTransaction({
        amount: transaction.amount,
        destination: transaction.destination,
        asset: transaction.asset,
        memo: transaction.memo
      });
      
      setTxHash(hash);
      setStep('success');
      toast.success('Transaction signed!', {
        id: toastId,
        description: `Hash: ${hash.slice(0, 8)}...${hash.slice(-6)}`,
      });
      onSuccess(hash);
    } catch (err: any) {
      const message = err.message || 'Transaction signing failed';
      setError(message);
      setStep('error');
      toast.error('Transaction failed', {
        id: toastId,
        description: message,
      });
      onError(message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" />
          Transaction Details
        </h4>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount</span>
            <div className="text-right">
              <p className="font-semibold">{transaction.amount} {transaction.asset}</p>
              <p className="text-sm text-muted-foreground">~$25.00 USD</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground">To</span>
            <div className="text-right max-w-[200px]">
              <p className="font-mono text-sm break-all">
                {transaction.destination.slice(0, 8)}...{transaction.destination.slice(-8)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => copyToClipboard(transaction.destination, 'Address')}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>
          
          {transaction.memo && (
            <>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Memo</span>
                <span className="font-mono text-sm">{transaction.memo}</span>
              </div>
            </>
          )}
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Network Fee</span>
            <span className="text-sm">{transaction.networkFee} XLM</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Estimated Time</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="text-sm">{transaction.estimatedTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet info */}
      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Wallet className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <p className="font-medium text-sm">Signing with {connectionState.provider}</p>
          <p className="text-xs text-muted-foreground">
            {connectionState.account?.publicKey.slice(0, 8)}...{connectionState.account?.publicKey.slice(-8)}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          Secure
        </Badge>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Your transaction will be signed securely by your wallet. SwiftSend never sees your private keys.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSign} className="flex-1" disabled={isSigningTransaction || step === 'signing'}>
          Sign Transaction
          <ArrowUpRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderSigningStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
        <div className="animate-spin">
          <RefreshCw className="w-8 h-8 text-primary" />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Waiting for signature...</h3>
        <p className="text-muted-foreground">
          Please check your {connectionState.provider} wallet and approve the transaction.
        </p>
      </div>

      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription className="text-sm">
          This may take a few seconds. Don't close this window.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Transaction Signed Successfully!</h3>
        <p className="text-muted-foreground">
          Your transaction has been submitted to the Stellar network.
        </p>
      </div>

      {txHash && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Transaction Hash</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-background p-2 rounded border">
              {txHash}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(txHash, 'Transaction hash')}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
        {txHash && (
          <Button
            variant="ghost"
            onClick={() => window.open(`https://stellar.expert/explorer/public/tx/${txHash}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
            View on Explorer
          </Button>
        )}
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Transaction Failed</h3>
        <p className="text-muted-foreground">
          {error || 'An unexpected error occurred while signing the transaction.'}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
        <Button onClick={() => setStep('review')} className="flex-1">
          Try Again
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            {
              step === 'review' ? 'Review Transaction' :
              step === 'signing' ? 'Signing Transaction' :
              step === 'success' ? 'Transaction Signed' :
              'Transaction Failed'
            }
          </DialogTitle>
          {step === 'review' && (
            <DialogDescription>
              Review the details below and sign with your connected wallet
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'review' && renderReviewStep()}
        {step === 'signing' && renderSigningStep()}
        {step === 'success' && renderSuccessStep()}
        {step === 'error' && renderErrorStep()}
      </DialogContent>
    </Dialog>
  );
}

// Component for viewing recent wallet transactions
export function WalletTransactionHistory() {
  const { getRecentTransactions, connectionState } = useWallet();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (connectionState.isConnected) {
      loadTransactions();
    }
  }, [connectionState.isConnected]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const txs = await getRecentTransactions();
      setTransactions(txs);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!connectionState.isConnected) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Wallet Transactions</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadTransactions}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={mapWalletStatusToUiStatus(tx.status)} />
                  <span className="text-sm font-medium">
                    {tx.amount} {tx.asset}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {tx.createdAt.toLocaleDateString()}
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground font-mono">
                To: {tx.destination.slice(0, 8)}...{tx.destination.slice(-8)}
              </p>
              
              {tx.stellarHash && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => window.open(`https://stellar.expert/explorer/public/tx/${tx.stellarHash}`, '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View on Explorer
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}