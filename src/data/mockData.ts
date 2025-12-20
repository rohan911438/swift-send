import { User, Contact, Transaction } from '@/types';

export const currentUser: User = {
  id: '1',
  name: 'Maria Santos',
  phone: '+1 (555) 123-4567',
  email: 'maria.santos@email.com',
  balance: 1250.50, // Legacy field
  usdcBalance: 1250.50, // USDC balance
  localCurrency: 'USD',
  exchangeRate: 1.0, // 1 USDC = 1 USD
  isVerified: true,
  onboardingCompleted: true,
  walletAddress: 'wallet_maria_santos_123',
  createdAt: new Date('2024-01-15'),
};

export const contacts: Contact[] = [
  {
    id: '1',
    name: 'Juan Garcia',
    phone: '+52 55 1234 5678',
    country: 'Mexico',
    countryCode: 'MX',
  },
  {
    id: '2',
    name: 'Rosa Martinez',
    phone: '+63 917 123 4567',
    country: 'Philippines',
    countryCode: 'PH',
  },
  {
    id: '3',
    name: 'Carlos Reyes',
    phone: '+502 5555 1234',
    country: 'Guatemala',
    countryCode: 'GT',
  },
  {
    id: '4',
    name: 'Ana Lopez',
    phone: '+503 7890 1234',
    country: 'El Salvador',
    countryCode: 'SV',
  },
];

export const transactions: Transaction[] = [
  {
    id: '1',
    type: 'send',
    amount: 200,
    fee: 0.50,
    recipientAmount: 199.50,
    recipientName: 'Juan Garcia',
    recipientPhone: '+52 55 1234 5678',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    exchangeRate: 17.25,
    destinationCurrency: 'MXN',
  },
  {
    id: '2',
    type: 'send',
    amount: 500,
    fee: 1.00,
    recipientAmount: 499.00,
    recipientName: 'Rosa Martinez',
    recipientPhone: '+63 917 123 4567',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    exchangeRate: 56.50,
    destinationCurrency: 'PHP',
  },
  {
    id: '3',
    type: 'send',
    amount: 150,
    fee: 0.35,
    recipientAmount: 149.65,
    recipientName: 'Carlos Reyes',
    recipientPhone: '+502 5555 1234',
    status: 'pending',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    exchangeRate: 7.85,
    destinationCurrency: 'GTQ',
  },
  {
    id: '4',
    type: 'receive',
    amount: 100,
    fee: 0,
    recipientAmount: 100,
    recipientName: 'Pedro Morales',
    recipientPhone: '+1 (555) 987-6543',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
];

export const calculateFees = (amount: number): { networkFee: number; serviceFee: number; totalFee: number; recipientGets: number } => {
  const networkFee = 0.001; // Stellar network fee (near zero)
  const serviceFee = amount * 0.002; // 0.2% service fee
  const totalFee = networkFee + serviceFee;
  const recipientGets = amount - totalFee;
  
  return {
    networkFee: Math.round(networkFee * 100) / 100,
    serviceFee: Math.round(serviceFee * 100) / 100,
    totalFee: Math.round(totalFee * 100) / 100,
    recipientGets: Math.round(recipientGets * 100) / 100,
  };
};
