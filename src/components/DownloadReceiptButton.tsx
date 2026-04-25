import { useState } from 'react';
import type { Transaction } from '@/types';
import {
  generateAndDownloadTransactionReceipt,
  generateAndDownloadRemittanceReceipt,
  ReceiptGenerationError,
} from '@/lib/receiptGenerator';
import type { RemittanceReceiptInput } from '@/lib/receiptGenerator';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DownloadReceiptButtonProps {
  transaction?: Transaction;
  remittanceTransfer?: RemittanceReceiptInput;
  senderName?: string;
  className?: string;
}

export function DownloadReceiptButton({
  transaction,
  remittanceTransfer,
  senderName,
  className,
}: DownloadReceiptButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const id = transaction?.id ?? remittanceTransfer?.id ?? '';

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (transaction) {
        await generateAndDownloadTransactionReceipt(transaction, senderName ?? '');
      } else if (remittanceTransfer) {
        await generateAndDownloadRemittanceReceipt(remittanceTransfer);
      }
    } catch (error) {
      if (error instanceof ReceiptGenerationError) {
        toast.error('Receipt download failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`Download receipt for transaction ${id}`}
      disabled={isLoading}
      onClick={handleClick}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Download Receipt
        </>
      )}
    </Button>
  );
}

export default DownloadReceiptButton;
