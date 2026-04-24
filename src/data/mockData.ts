import {
  User,
  Contact,
  Transaction,
  FundingMethod,
  WithdrawalMethod,
  Partner,
  PickupLocation,
} from "@/types";

export const currentUser: User = {
  id: "1",
  name: "Maria Santos",
  phone: "+1 (555) 123-4567",
  email: "maria.santos@email.com",
  balance: 1250.5, // Legacy field
  usdcBalance: 1250.5, // USDC balance
  localCurrency: "USD",
  exchangeRate: 1.0, // 1 USDC = 1 USD
  isVerified: true,
  onboardingCompleted: true,
  walletAddress: "wallet_maria_santos_123",
  createdAt: new Date("2024-01-15"),
};

export const contacts: Contact[] = [
  {
    id: "1",
    name: "Juan Garcia",
    phone: "+52 55 1234 5678",
    country: "Mexico",
    countryCode: "MX",
  },
  {
    id: "2",
    name: "Rosa Martinez",
    phone: "+63 917 123 4567",
    country: "Philippines",
    countryCode: "PH",
  },
  {
    id: "3",
    name: "Carlos Reyes",
    phone: "+502 5555 1234",
    country: "Guatemala",
    countryCode: "GT",
  },
  {
    id: "4",
    name: "Ana Lopez",
    phone: "+503 7890 1234",
    country: "El Salvador",
    countryCode: "SV",
  },
];

export const transactions: Transaction[] = [
  {
    id: "1",
    type: "send",
    amount: 200,
    fee: 0.5,
    recipientAmount: 199.5,
    recipientName: "Juan Garcia",
    recipientPhone: "+52 55 1234 5678",
    status: "completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    exchangeRate: 17.25,
    destinationCurrency: "MXN",
  },
  {
    id: "2",
    type: "send",
    amount: 500,
    fee: 1.0,
    recipientAmount: 499.0,
    recipientName: "Rosa Martinez",
    recipientPhone: "+63 917 123 4567",
    status: "completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    exchangeRate: 56.5,
    destinationCurrency: "PHP",
  },
  {
    id: "3",
    type: "send",
    amount: 150,
    fee: 0.35,
    recipientAmount: 149.65,
    recipientName: "Carlos Reyes",
    recipientPhone: "+502 5555 1234",
    status: "pending",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    exchangeRate: 7.85,
    destinationCurrency: "GTQ",
  },
  {
    id: "4",
    type: "receive",
    amount: 100,
    fee: 0,
    recipientAmount: 100,
    recipientName: "Pedro Morales",
    recipientPhone: "+1 (555) 987-6543",
    status: "completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
];

// Funding Methods (Cash In)
export const fundingMethods: FundingMethod[] = [
  {
    id: "bank_transfer_us",
    type: "bank_transfer",
    name: "Bank Transfer (ACH)",
    description: "Connect your US bank account for secure transfers",
    icon: "building-2",
    processingTime: "1-3 business days",
    fees: {
      fixed: 0.0,
      percentage: 0.0,
    },
    limits: {
      min: 10,
      max: 5000,
      dailyLimit: 5000,
    },
    regions: ["US"],
    status: "available",
    instructions: [
      "Verify your bank account",
      "Initiate transfer from your bank",
      "Funds appear in 1-3 business days",
    ],
  },
  {
    id: "debit_card",
    type: "card",
    name: "Debit Card",
    description: "Add funds instantly with your debit card",
    icon: "credit-card",
    processingTime: "Instant",
    fees: {
      percentage: 2.9,
      fixed: 0.3,
    },
    limits: {
      min: 5,
      max: 1000,
      dailyLimit: 2000,
    },
    regions: ["US", "EU", "UK"],
    status: "available",
  },
  {
    id: "cash_deposit_us",
    type: "cash_deposit",
    name: "Cash Deposit",
    description: "Deposit cash at participating locations",
    icon: "banknote",
    processingTime: "15-30 minutes",
    fees: {
      fixed: 4.99,
    },
    limits: {
      min: 20,
      max: 1000,
      dailyLimit: 1000,
    },
    regions: ["US"],
    status: "available",
    instructions: [
      "Find nearest participating location",
      "Bring cash and SwiftSend deposit code",
      "Funds available in 15-30 minutes",
    ],
  },
  {
    id: "mobile_money_africa",
    type: "mobile_money",
    name: "Mobile Money",
    description: "Add funds via M-Pesa, MTN Mobile Money, and others",
    icon: "smartphone",
    processingTime: "5-15 minutes",
    fees: {
      percentage: 1.5,
      fixed: 0.5,
    },
    limits: {
      min: 5,
      max: 500,
      dailyLimit: 1000,
    },
    regions: ["KE", "UG", "TZ", "GH", "NG"],
    status: "available",
  },
  {
    id: "crypto_transfer",
    type: "crypto_transfer",
    name: "Crypto Transfer",
    description: "Transfer USDC directly from your crypto wallet",
    icon: "bitcoin",
    processingTime: "1-5 minutes",
    fees: {
      percentage: 0.0,
    },
    limits: {
      min: 1,
      max: 10000,
      dailyLimit: 25000,
    },
    regions: ["Global"],
    status: "available",
  },
];

// Withdrawal Methods (Cash Out)
export const withdrawalMethods: WithdrawalMethod[] = [
  {
    id: "cash_pickup_mx",
    type: "cash_pickup",
    name: "Cash Pickup",
    description: "Pick up cash at thousands of locations",
    icon: "map-pin",
    processingTime: "15 minutes - 2 hours",
    fees: {
      fixed: 3.99,
    },
    limits: {
      min: 20,
      max: 3000,
    },
    availability: {
      countries: ["MX"],
      operatingHours: "6 AM - 10 PM",
    },
    partnerName: "OXXO",
    partnerLogo: "/partners/oxxo.png",
    requirements: [
      "Valid government ID",
      "Confirmation code from sender",
      "Recipient name must match ID",
    ],
  },
  {
    id: "bank_transfer_ph",
    type: "bank_transfer",
    name: "Bank Transfer",
    description: "Direct deposit to local bank accounts",
    icon: "building-2",
    processingTime: "30 minutes - 2 hours",
    fees: {
      fixed: 1.99,
    },
    limits: {
      min: 10,
      max: 5000,
    },
    availability: {
      countries: ["PH"],
    },
    partnerName: "UnionBank & BDO",
    requirements: [
      "Valid bank account",
      "Account holder name must match recipient",
    ],
  },
  {
    id: "mobile_money_ph",
    type: "mobile_money",
    name: "GCash",
    description: "Send directly to GCash wallet",
    icon: "smartphone",
    processingTime: "1-15 minutes",
    fees: {
      fixed: 1.49,
    },
    limits: {
      min: 5,
      max: 2000,
    },
    availability: {
      countries: ["PH"],
    },
    partnerName: "GCash",
    partnerLogo: "/partners/gcash.png",
    requirements: ["Active GCash account", "Verified phone number"],
  },
  {
    id: "home_delivery_gt",
    type: "home_delivery",
    name: "Home Delivery",
    description: "Cash delivered directly to recipient",
    icon: "truck",
    processingTime: "2-4 hours",
    fees: {
      fixed: 7.99,
    },
    limits: {
      min: 50,
      max: 1000,
    },
    availability: {
      countries: ["GT"],
      cities: ["Guatemala City", "Quetzaltenango"],
    },
    partnerName: "Guatemala Express",
    requirements: [
      "Valid address",
      "Government ID for verification",
      "Someone present to receive delivery",
    ],
  },
  {
    id: "cash_pickup_sv",
    type: "cash_pickup",
    name: "Banco Agrícola",
    description: "Pick up at Banco Agrícola branches",
    icon: "building",
    processingTime: "30 minutes - 1 hour",
    fees: {
      fixed: 2.99,
    },
    limits: {
      min: 25,
      max: 2000,
    },
    availability: {
      countries: ["SV"],
      operatingHours: "8 AM - 5 PM (Mon-Fri)",
    },
    partnerName: "Banco Agrícola",
    requirements: ["Valid government ID", "Reference number from sender"],
  },
];

// Partners
export const partners: Partner[] = [
  {
    id: "oxxo",
    name: "OXXO",
    type: "cash_network",
    logo: "/partners/oxxo.png",
    description:
      "Mexico's largest convenience store chain with 20,000+ locations",
    countries: ["MX"],
    services: ["cash_out"],
    reliability: 0.98,
    avgProcessingTime: "15 minutes",
  },
  {
    id: "gcash",
    name: "GCash",
    type: "mobile_money",
    logo: "/partners/gcash.png",
    description: "Philippines' leading mobile wallet with 65M+ users",
    countries: ["PH"],
    services: ["cash_in", "cash_out"],
    reliability: 0.96,
    avgProcessingTime: "5 minutes",
  },
  {
    id: "unionbank",
    name: "UnionBank",
    type: "bank",
    logo: "/partners/unionbank.png",
    description: "Leading digital bank in the Philippines",
    countries: ["PH"],
    services: ["cash_out"],
    reliability: 0.94,
    avgProcessingTime: "1 hour",
  },
  {
    id: "banco_agricola",
    name: "Banco Agrícola",
    type: "bank",
    logo: "/partners/banco-agricola.png",
    description: "El Salvador's premier financial institution",
    countries: ["SV"],
    services: ["cash_out"],
    reliability: 0.92,
    avgProcessingTime: "45 minutes",
  },
  {
    id: "guatemala_express",
    name: "Guatemala Express",
    type: "money_transfer",
    logo: "/partners/gt-express.png",
    description: "Home delivery service across Guatemala",
    countries: ["GT"],
    services: ["cash_out"],
    reliability: 0.89,
    avgProcessingTime: "3 hours",
  },
];

// Mock pickup locations for OXXO
export const oxxoLocations: PickupLocation[] = [
  {
    id: "oxxo_001",
    name: "OXXO Roma Norte",
    address: "Av. Álvaro Obregón 286, Roma Nte.",
    city: "Mexico City",
    hours: "24 hours",
    phone: "+52 55 5264 7890",
    distance: "0.3 km",
  },
  {
    id: "oxxo_002",
    name: "OXXO Condesa",
    address: "Av. Insurgentes Sur 253, Condesa",
    city: "Mexico City",
    hours: "24 hours",
    phone: "+52 55 5211 4567",
    distance: "0.8 km",
  },
  {
    id: "oxxo_003",
    name: "OXXO Polanco",
    address: "Presidente Masaryk 111, Polanco",
    city: "Mexico City",
    hours: "6 AM - 11 PM",
    phone: "+52 55 5280 9876",
    distance: "1.2 km",
  },
];

// Fee logic moved to `src/lib/fees.ts`.
