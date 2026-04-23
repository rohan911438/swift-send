import { ExternalServiceError } from '../errors';
import { config } from '../config';
import {
  Asset,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

// Adapter that submits payments to the Stellar network using the official SDK.
// Treat Stellar as an external dependency: retries, backoff, and structured errors.

export interface StellarSubmitResult {
  status: 'submitted';
  /** Transaction hash returned by Horizon. */
  networkId: string;
  /** Signed transaction envelope XDR (useful for debugging/support). */
  envelopeXdr: string;
  attempt: number;
}

function isValidStellarPublicKey(accountId: string): boolean {
  return StrKey.isValidEd25519PublicKey(accountId);
}

function toStellarNetworkPassphrase(): string {
  return config.stellar.network === 'PUBLIC' ? Networks.PUBLIC : Networks.TESTNET;
}

function buildAsset(currency: string): Asset {
  // For this prototype, map configured "assetCode" to its issuer, otherwise assume native XLM.
  if (currency.toUpperCase() === config.stellar.assetCode.toUpperCase()) {
    return new Asset(config.stellar.assetCode, config.stellar.assetIssuer);
  }
  return Asset.native();
}

function assertValidParams(to: string, amount: number) {
  if (!isValidStellarPublicKey(to)) {
    throw new ExternalServiceError('Invalid Stellar destination account', { to });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ExternalServiceError('Invalid payment amount', { amount });
  }
  if (!config.stellar.distributionSecret) {
    throw new ExternalServiceError('Missing STELLAR_DISTRIBUTION_SECRET (cannot sign transactions)');
  }
}

function extractHorizonErrorDetails(err: any) {
  const res = err?.response?.data || err?.response || err;
  const extras = res?.extras || res?.data?.extras;
  const resultCodes = extras?.result_codes;
  const title = res?.title || res?.data?.title;
  const detail = res?.detail || res?.data?.detail || err?.message;
  return { title, detail, resultCodes, status: res?.status || err?.response?.status };
}

async function buildAndSubmitPayment(transferId: string, from: string, to: string, amount: number, currency: string) {
  assertValidParams(to, amount);

  const server = new Horizon.Server(config.stellar.horizonUrl);
  const sourceKeypair = Keypair.fromSecret(config.stellar.distributionSecret!);

  // Allow caller to pass a from account id; otherwise use distribution account.
  const sourceAccountId = from || config.stellar.distributionAccount;
  if (sourceAccountId !== sourceKeypair.publicKey()) {
    // Keep the prototype simple and safe: only sign for the configured distribution key.
    throw new ExternalServiceError('Source account does not match distribution key', {
      from: sourceAccountId,
      distributionAccount: sourceKeypair.publicKey(),
    });
  }

  const account = await server.loadAccount(sourceAccountId);
  const fee = await server.fetchBaseFee();

  const asset = buildAsset(currency);
  const tx = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: toStellarNetworkPassphrase(),
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset,
        amount: amount.toFixed(7), // Stellar amounts are strings with 7 decimals
      })
    )
    .addMemo(Memo.text(`swift-send:${transferId}`.slice(0, 28)))
    .setTimeout(60)
    .build();

  tx.sign(sourceKeypair);
  const envelopeXdr = tx.toEnvelope().toXDR('base64');

  if (config.stellar.simulateSubmission) {
    return {
      status: 'submitted' as const,
      networkId: `sim_${transferId}_${Date.now()}`,
      envelopeXdr,
    };
  }

  const response = await server.submitTransaction(tx);
  // Validate key response fields we rely on.
  const hash = (response as any)?.hash;
  if (!hash || typeof hash !== 'string') {
    throw new ExternalServiceError('Invalid Horizon response: missing tx hash', { response });
  }
  return { status: 'submitted' as const, networkId: hash, envelopeXdr };
}

export async function submitPayment(
  transferId: string,
  from: string,
  to: string,
  amount: number,
  currency: string,
  maxAttempts = 3
): Promise<StellarSubmitResult> {
  let attempt = 0;
  const baseDelay = 500;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await buildAndSubmitPayment(transferId, from, to, amount, currency);
      return { ...result, attempt };
    } catch (err: any) {
      const details = extractHorizonErrorDetails(err);
      if (attempt >= maxAttempts) {
        throw new ExternalServiceError('Stellar submission failed after retries', { ...details, attempt });
      }
      // exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw new ExternalServiceError('Stellar submission failed (unexpected)');
}
