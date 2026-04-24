import type { FundingMethod, WithdrawalMethod } from '@/types';

export interface PercentageFixedFees {
  percentage?: number; // percent, e.g. 2.9
  fixed?: number; // USD
}

export interface MethodFeeResult {
  fee: number;
  total: number;
  net: number;
}

export interface MethodFeeWithRecipientResult extends MethodFeeResult {
  recipient: number;
  exchangeRate: number;
  currency: string;
}

export interface SendFeeBreakdown {
  networkFee: number;
  serviceFee: number;
  totalFee: number;
  recipientGets: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export interface SendFeePolicy {
  /** Flat network fee, in the same units as amount (USDC). */
  networkFee: number;
  /** Service fee rate as decimal (e.g. 0.002 for 0.2%). */
  serviceRate: number;
}

export const DEFAULT_SEND_FEE_POLICY: SendFeePolicy = {
  networkFee: 0.001,
  serviceRate: 0.002,
};

export function calculateSendFees(amount: number, policy: SendFeePolicy = DEFAULT_SEND_FEE_POLICY): SendFeeBreakdown {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const networkFee = Math.max(0, policy.networkFee);
  const serviceFee = safeAmount * Math.max(0, policy.serviceRate);
  const totalFee = networkFee + serviceFee;
  const recipientGets = Math.max(0, safeAmount - totalFee);

  return {
    networkFee: round4(networkFee),
    serviceFee: round2(serviceFee),
    totalFee: round2(totalFee),
    recipientGets: round2(recipientGets),
  };
}

export function splitFee(totalFee: number, weights: { network: number; service: number }) {
  const total = Number.isFinite(totalFee) ? Math.max(0, totalFee) : 0;
  const wNet = Math.max(0, weights.network);
  const wSvc = Math.max(0, weights.service);
  const wSum = wNet + wSvc || 1;

  const networkFee = total * (wNet / wSum);
  const serviceFee = total - networkFee;
  return { networkFee: round4(networkFee), serviceFee: round2(serviceFee), totalFee: round2(total) };
}

export function calculateMethodFees(amount: number, fees: PercentageFixedFees): MethodFeeResult {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const fixed = Math.max(0, fees.fixed ?? 0);
  const pct = Math.max(0, fees.percentage ?? 0);
  const fee = fixed + (safeAmount * pct) / 100;
  return {
    fee: round2(fee),
    total: round2(safeAmount + fee),
    net: round2(safeAmount),
  };
}

export function calculateFundingFees(amount: number, method: Pick<FundingMethod, 'fees'>): MethodFeeResult {
  return calculateMethodFees(amount, method.fees);
}

export function calculateWithdrawalFees(params: {
  amount: number;
  method: Pick<WithdrawalMethod, 'fees'>;
  exchangeRate: number;
  currency: string;
}): MethodFeeWithRecipientResult {
  const base = calculateMethodFees(params.amount, params.method.fees);
  const net = Math.max(0, base.net - base.fee);
  const recipient = net * (Number.isFinite(params.exchangeRate) ? params.exchangeRate : 1);
  return {
    ...base,
    total: round2(Number.isFinite(params.amount) ? Math.max(0, params.amount) : 0),
    net: round2(net),
    recipient: round2(recipient),
    exchangeRate: params.exchangeRate,
    currency: params.currency,
  };
}

