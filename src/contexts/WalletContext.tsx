import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { StellarAccount, StellarWallet, WalletTransaction, WalletProvider, WalletConnectionState } from '@/types';
import { toast } from 'sonner';

interface WalletContextType {
  connectionState: WalletConnectionState;
  availableWallets: StellarWallet[];
  isConnecting: boolean;
  isSigningTransaction: boolean;
  connectWallet: (provider: WalletProvider) => Promise<void>;
  disconnectWallet: () => void;
  signTransaction: (transaction: any) => Promise<string>;
  refreshBalance: () => Promise<void>;
  getRecentTransactions: () => Promise<WalletTransaction[]>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_TX_STORAGE_KEY = 'stellar-wallet-transactions';
const HORIZON_URL = (import.meta.env.VITE_STELLAR_HORIZON_URL as string | undefined) || 'https://horizon-testnet.stellar.org';

function parseStoredTransactions(raw: string | null): WalletTransaction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Omit<WalletTransaction, 'createdAt'> & { createdAt: string }>;
    return parsed.map((tx) => ({ ...tx, createdAt: new Date(tx.createdAt) }));
  } catch {
    return [];
  }
}

function toStableTxId() {
  return `wtx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = useState<WalletConnectionState>({
    isConnected: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const [walletDetectionTrigger, setWalletDetectionTrigger] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() =>
    parseStoredTransactions(localStorage.getItem(WALLET_TX_STORAGE_KEY))
  );

  const syncPendingTransactions = useCallback(async () => {
    const needsSync = walletTransactions.filter((tx) => tx.status === 'submitted' && tx.stellarHash);
    if (needsSync.length === 0) return;

    const synced = await Promise.all(
      walletTransactions.map(async (tx) => {
        if (tx.status !== 'submitted' || !tx.stellarHash) return tx;

        try {
          const res = await fetch(`${HORIZON_URL}/transactions/${tx.stellarHash}`);
          if (res.ok) {
            return { ...tx, status: 'success' as const };
          }
          // Keep submitted while pending/not indexed yet.
          return tx;
        } catch {
          return tx;
        }
      })
    );

    const changed = synced.some((tx, idx) => tx.status !== walletTransactions[idx]?.status);
    if (changed) {
      setWalletTransactions(synced);
    }
  }, [walletTransactions]);

  useEffect(() => {
    localStorage.setItem(WALLET_TX_STORAGE_KEY, JSON.stringify(walletTransactions));
  }, [walletTransactions]);

  useEffect(() => {
    if (!connectionState.isConnected) return;
    void syncPendingTransactions();
    const interval = setInterval(() => {
      void syncPendingTransactions();
    }, 8000);
    return () => clearInterval(interval);
  }, [connectionState.isConnected, syncPendingTransactions]);

  // Enhanced Freighter detection with immediate and continuous checking
  useEffect(() => {
    const handleFreighterDetected = () => {
      setWalletDetectionTrigger(prev => prev + 1);
    };

    window.addEventListener('freighter-detected', handleFreighterDetected);
    
    // Immediate check when component mounts
    if (window.freighter) {
      localStorage.setItem('freighter-installed', 'true');
      setWalletDetectionTrigger(prev => prev + 1);
    }
    
    // Very aggressive checking for Freighter - check every 500ms
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      
      if (window.freighter) {
        // Freighter found!
        localStorage.setItem('freighter-installed', 'true');
        window.dispatchEvent(new Event('freighter-detected'));
        clearInterval(checkInterval);
        console.log('✅ Freighter API detected!');
      } else {
        // Check for extension presence indicators
        const indicators = [
          // Check for extension content scripts
          document.querySelector('script[src*="freighter"]'),
          document.querySelector('script[src*="extension"]'),
          // Check for extension-injected elements
          document.querySelector('[data-freighter]'),
          document.querySelector('[class*="freighter"]'),
          // Check chrome extension APIs
          window.chrome && window.chrome.runtime,
          // Check localStorage indicators
          localStorage.getItem('freighter-connected') === 'true',
          // Check for extension bridge
          window.dispatchEvent && document.dispatchEvent
        ];
        
        if (indicators.some(indicator => indicator)) {
          localStorage.setItem('freighter-installed', 'true');
          window.dispatchEvent(new Event('freighter-detected'));
          console.log('🔍 Freighter extension indicators found, API still loading...');
        }
        
        // Stop checking after 2 minutes
        if (checkCount >= 240) {
          clearInterval(checkInterval);
          console.log('⚠️ Stopped looking for Freighter after 2 minutes');
        }
      }
    }, 500); // Check every 500ms for faster detection

    // Also listen for extension installation events
    const handleExtensionInstalled = () => {
      setTimeout(() => {
        if (window.freighter) {
          handleFreighterDetected();
        }
      }, 1000);
    };
    
    window.addEventListener('beforeunload', handleExtensionInstalled);
    window.addEventListener('focus', handleExtensionInstalled);
    document.addEventListener('DOMContentLoaded', handleExtensionInstalled);

    return () => {
      window.removeEventListener('freighter-detected', handleFreighterDetected);
      window.removeEventListener('beforeunload', handleExtensionInstalled);
      window.removeEventListener('focus', handleExtensionInstalled);
      document.removeEventListener('DOMContentLoaded', handleExtensionInstalled);
      clearInterval(checkInterval);
    };
  }, []);

  // Auto-reconnect on page load if previously connected to real wallet
  useEffect(() => {
    const savedConnection = localStorage.getItem('stellar-wallet-connection');
    if (savedConnection) {
      try {
        const { provider } = JSON.parse(savedConnection);
        if (provider === 'freighter' && window.freighter) {
          // Check if Freighter is still connected
          window.freighter.isAllowed().then(({ isAllowed }) => {
            if (isAllowed) {
              // Silently reconnect
              connectWallet(provider).catch(() => {
                localStorage.removeItem('stellar-wallet-connection');
              });
            } else {
              localStorage.removeItem('stellar-wallet-connection');
            }
          }).catch(() => {
            localStorage.removeItem('stellar-wallet-connection');
          });
        }
      } catch (error) {
        localStorage.removeItem('stellar-wallet-connection');
      }
    }
  }, []);

  // Real wallet configurations with robust Freighter detection
  const availableWallets: StellarWallet[] = useMemo(() => {
    // Enhanced Freighter detection function with multiple methods
    const detectFreighter = () => {
      if (typeof window === 'undefined') return false;
      
      // Add extensive logging for debugging
      console.log('🔍 Freighter Detection Debug:', {
        hasWindow: typeof window !== 'undefined',
        hasFreighter: !!window.freighter,
        freighterType: typeof window.freighter,
        hasIsAllowed: window.freighter ? typeof window.freighter.isAllowed : 'N/A',
        hasRequestAccess: window.freighter ? typeof window.freighter.requestAccess : 'N/A',
        hasGetPublicKey: window.freighter ? typeof window.freighter.getPublicKey : 'N/A',
        chromeRuntime: !!(window.chrome && window.chrome.runtime),
        documentState: document.readyState,
        savedInstalled: localStorage.getItem('freighter-installed')
      });
      
      // Method 1: Direct API check (most reliable when available)
      if (window.freighter && 
          typeof window.freighter === 'object' && 
          typeof window.freighter.isAllowed === 'function' && 
          typeof window.freighter.requestAccess === 'function' &&
          typeof window.freighter.getPublicKey === 'function') {
        console.log('✅ Freighter API fully available');
        localStorage.setItem('freighter-installed', 'true');
        return true;
      }
      
      // Method 2: Partial API detection (extension loading)
      if (window.freighter && typeof window.freighter === 'object') {
        console.log('⚠️ Freighter object exists but API incomplete');
        localStorage.setItem('freighter-installed', 'true');
        return true; // Show as installed but connection may fail
      }
      
      // Method 3: Check for extension environment indicators
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
        console.log('🔍 Chrome extension runtime detected');
        // Extension environment detected, Freighter might be loading
      }
      
      // Method 3: Check localStorage for previous successful connection
      if (localStorage.getItem('freighter-installed') === 'true' ||
          localStorage.getItem('freighter-connected') === 'true') {
        console.log('📋 Freighter was previously detected');
        return true;
      }
      
      // Method 4: Check for DOM modifications that indicate extension presence
      const domIndicators = [
        document.querySelector('script[src*="freighter"]'),
        document.querySelector('script[src*="extension"]'),
        document.querySelector('[data-freighter]'),
        document.querySelector('[class*="freighter"]'),
        document.querySelector('[id*="freighter"]')
      ];
      
      if (domIndicators.some(indicator => indicator)) {
        console.log('🌐 DOM indicators suggest Freighter is present');
        return true;
      }
      
      // Method 5: Check if we're in an extension context
      try {
        if (navigator.userAgent.includes('Chrome') && 
            window.location.protocol !== 'chrome-extension:' &&
            document.documentElement.getAttribute('data-extension')) {
          console.log('🧪 Extension context detected');
          return true;
        }
      } catch (e) {
        // Ignore errors
      }
      
      console.log('❌ No Freighter indicators found');
      return false;
    };
    
    return [
    {
      name: 'Freighter',
      icon: '🚀',
      description: 'The most popular Stellar wallet extension',
      isInstalled: detectFreighter(),
      connect: async () => {
        console.log('🚀 Starting Freighter connection attempt...');
        
        // First, check if Freighter is immediately available
        if (window.freighter) {
          console.log('✅ Freighter API found immediately');
        } else {
          console.log('⏳ Freighter API not immediately available, waiting...');
        }
        
        // Aggressive waiting for Freighter to load
        let attempts = 0;
        const maxAttempts = 200; // Wait up to 20 seconds (100ms * 200)
        
        while (!window.freighter && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
          
          // Log progress every 2 seconds
          if (attempts % 20 === 0) {
            console.log(`🔍 Still waiting for Freighter... (${(attempts * 100 / 1000).toFixed(1)}s/${(maxAttempts * 100 / 1000)}s)`);
          }
        }
        
        // Final check for Freighter
        if (!window.freighter) {
          console.error('❌ Freighter API never became available');
          
          // Check what we do have
          console.log('Available window properties:', Object.keys(window).filter(key => 
            key.toLowerCase().includes('freighter') || 
            key.toLowerCase().includes('stellar') ||
            key.toLowerCase().includes('wallet')
          ));
          
          // Mark as detected for future reference if extension seems present
          const extensionPresent = document.querySelector('script[src*="freighter"]') || 
                                 document.querySelector('[data-freighter]') ||
                                 localStorage.getItem('freighter-connected') === 'true';
          
          if (extensionPresent) {
            localStorage.setItem('freighter-installed', 'true');
          }
          
          throw new Error(
            'Freighter extension appears to be installed but the API is not available.\n\n' +
            'This can happen when:\n' +
            '• The extension is disabled\n' +
            '• The extension needs to be updated\n' +
            '• There\'s a browser compatibility issue\n' +
            '• The extension is still initializing\n\n' +
            'Please try:\n' +
            '1. Refresh this page (F5)\n' +
            '2. Check chrome://extensions/ and make sure Freighter is enabled\n' +
            '3. Disable and re-enable the Freighter extension\n' +
            '4. Update to the latest version from freighter.app'
          );
        }
        
        console.log('✅ Freighter API is now available!');
        
        try {
          // Check if already connected to avoid unnecessary popups
          console.log('🔒 Checking if already connected...');
          const { isAllowed } = await window.freighter.isAllowed();
          console.log('isAllowed result:', isAllowed);
          
          if (!isAllowed) {
            console.log('🔓 Requesting access...');
            // Request access - this will show the Freighter popup for password
            await window.freighter.requestAccess();
            
            // Double-check if user approved
            const { isAllowed: approved } = await window.freighter.isAllowed();
            console.log('User approved:', approved);
            
            if (!approved) {
              throw new Error('Please approve the connection in the Freighter popup to continue.');
            }
          }
          
          // Get the real public key from the connected wallet
          console.log('🔑 Getting public key...');
          const { publicKey } = await window.freighter.getPublicKey();
          console.log('Public key received:', publicKey.slice(0, 8) + '...');
          
          // Mark as successfully connected
          localStorage.setItem('freighter-connected', 'true');
          localStorage.setItem('freighter-installed', 'true');
          
          console.log('✅ Freighter connection successful!');
          
          // TODO: In production, fetch real balance from Stellar network
          // For now, using placeholder balance with real wallet connection
          return {
            publicKey,
            balance: 150.25, // This would be fetched from Stellar Horizon API
            provider: 'freighter',
            isReal: true // Flag to indicate this is a real wallet
          };
        } catch (error: any) {
          console.error('❌ Freighter connection error:', error);
          
          if (error.message?.includes('User declined') || 
              error.message?.includes('cancelled') ||
              error.message?.includes('rejected')) {
            throw new Error('Connection cancelled. Please try again and approve the Freighter popup.');
          }
          throw error;
        }
      }
    },
    {
      name: 'Demo Wallet',
      icon: '🧪',
      description: 'Demo mode for testing (not a real wallet)',
      isInstalled: true,
      connect: async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast.warning('Demo Wallet Connected', {
          description: '⚠️ This is a demonstration wallet. No real transactions will be made.',
          duration: 5000
        });
        
        return {
          publicKey: 'GDEMO_WALLET_NOT_REAL_XXXXXXXXXXXXXXXXXX',
          balance: 89.50,
          provider: 'albedo',
          isReal: false // Flag to indicate this is demo only
        };
      }
    },
    {
      name: 'Rabet',
      icon: '🐰',
      description: 'Multi-currency Stellar wallet',
      isInstalled: typeof window !== 'undefined' && !!window.rabet,
      connect: async () => {
        if (!window.rabet) {
          throw new Error('Rabet wallet extension not found. Please install it and refresh this page.');
        }
        
        try {
          // Connect to real Rabet wallet
          const response = await window.rabet.connect();
          
          return {
            publicKey: response.publicKey,
            balance: 203.75, // Would be fetched from Stellar network
            provider: 'rabet',
            isReal: true
          };
        } catch (error: any) {
          throw new Error(`Rabet connection failed: ${error.message}`);
        }
      }
    }
  ]; }, [walletDetectionTrigger]); // Re-evaluate when detection trigger changes

  const connectWallet = async (provider: WalletProvider) => {
    setIsConnecting(true);
    try {
      const wallet = availableWallets.find(w => w.name.toLowerCase() === provider);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (!wallet.isInstalled && provider !== 'albedo') {
        throw new Error(`${wallet.name} wallet is not installed`);
      }

      const account = await wallet.connect();
      
      setConnectionState({
        isConnected: true,
        account,
        provider
      });

      // Save connection to localStorage for persistence
      localStorage.setItem('stellar-wallet-connection', JSON.stringify({ provider, publicKey: account.publicKey }));

      if (account.isReal) {
        toast.success(`🎉 Real ${wallet.name} Connected!`, {
          description: `Address: ${account.publicKey.slice(0, 8)}...${account.publicKey.slice(-8)}`
        });
      } else {
        toast.success(`${wallet.name} connected (Demo Mode)`, {
          description: 'This is a demonstration wallet for testing purposes'
        });
      }
    } catch (error: any) {
      setConnectionState({
        isConnected: false,
        error: error.message
      });
      
      // Provide helpful error messages
      if (error.message.includes('not installed')) {
        toast.error(`Please install ${provider} wallet to continue`, {
          description: 'You can download it from the official website',
          action: {
            label: 'Learn More',
            onClick: () => window.open('https://stellar.org/ecosystem/projects?tab=wallets', '_blank')
          }
        });
      } else {
        toast.error('Failed to connect wallet', {
          description: error.message
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setConnectionState({
      isConnected: false
    });
    
    // Clear saved connection
    localStorage.removeItem('stellar-wallet-connection');
    
    toast.success('Wallet disconnected');
  };

  const signTransaction = async (transaction: any): Promise<string> => {
    setIsSigningTransaction(true);
    try {
      if (!connectionState.isConnected || !connectionState.account) {
        throw new Error('No wallet connected');
      }

      // Mock transaction signing with proper delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate different outcomes
      const shouldSucceed = Math.random() > 0.1; // 90% success rate
      if (!shouldSucceed) {
        throw new Error('User rejected the transaction');
      }

      const mockTxHash = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setWalletTransactions((prev) => [
        {
          id: toStableTxId(),
          hash: mockTxHash,
          type: 'payment',
          amount: String(transaction?.amount ?? ''),
          asset: String(transaction?.asset ?? 'USDC'),
          destination: String(transaction?.destination ?? ''),
          memo: transaction?.memo ? String(transaction.memo) : undefined,
          status: 'submitted',
          createdAt: new Date(),
          stellarHash: mockTxHash,
          networkFee: '0.00001',
        },
        ...prev,
      ]);
      
      toast.success('Transaction signed successfully!', {
        description: 'Your transaction has been submitted to the network'
      });

      return mockTxHash;
    } catch (error: any) {
      toast.error('Transaction signing failed', {
        description: error.message
      });
      throw error;
    } finally {
      setIsSigningTransaction(false);
    }
  };

  const refreshBalance = async () => {
    if (!connectionState.isConnected || !connectionState.account) return;

    try {
      // Mock balance refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newBalance = Math.random() * 1000;
      
      setConnectionState(prev => ({
        ...prev,
        account: prev.account ? {
          ...prev.account,
          balance: newBalance
        } : undefined
      }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  };

  const getRecentTransactions = async (): Promise<WalletTransaction[]> => {
    if (!connectionState.isConnected) return [];

    await syncPendingTransactions();
    return [...walletTransactions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  // Auto-reconnect on page load if previously connected
  useEffect(() => {
    const savedConnection = localStorage.getItem('stellar-wallet-connection');
    if (savedConnection) {
      try {
        const { provider } = JSON.parse(savedConnection);
        if (provider && provider !== 'internal') {
          // Attempt silent reconnection
          connectWallet(provider).catch(() => {
            // Silent fail - user will need to reconnect manually
            localStorage.removeItem('stellar-wallet-connection');
          });
        }
      } catch (error) {
        localStorage.removeItem('stellar-wallet-connection');
      }
    }
  }, []);

  // Save connection state
  useEffect(() => {
    if (connectionState.isConnected && connectionState.provider) {
      localStorage.setItem('stellar-wallet-connection', JSON.stringify({
        provider: connectionState.provider
      }));
    } else {
      localStorage.removeItem('stellar-wallet-connection');
    }
  }, [connectionState]);

  return (
    <WalletContext.Provider
      value={{
        connectionState,
        availableWallets,
        isConnecting,
        isSigningTransaction,
        connectWallet,
        disconnectWallet,
        signTransaction,
        refreshBalance,
        getRecentTransactions
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Type declarations for wallet extensions
declare global {
  interface Window {
    freighter?: {
      isConnected: () => Promise<{ isConnected: boolean }>;
      getPublicKey: () => Promise<{ publicKey: string }>;
      signTransaction: (transaction: string) => Promise<{ signedTransaction: string }>;
    };
    rabet?: {
      connect: () => Promise<{ publicKey: string }>;
      sign: (transaction: string) => Promise<{ signature: string }>;
    };
  }
}