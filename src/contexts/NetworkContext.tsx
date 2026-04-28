import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type StellarNetwork = 'testnet' | 'mainnet';

export interface NetworkConfig {
  network: StellarNetwork;
  horizonUrl: string;
  networkPassphrase: string;
  label: string;
}

const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    label: 'Testnet',
  },
  mainnet: {
    network: 'mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    label: 'Mainnet',
  },
};

const DEFAULT_NETWORK: StellarNetwork =
  (import.meta.env.VITE_STELLAR_NETWORK as StellarNetwork | undefined) || 'testnet';

const STORAGE_KEY = 'swift-send-network';

function readPersistedNetwork(): StellarNetwork {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'mainnet' || stored === 'testnet') return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_NETWORK;
}

interface NetworkContextType {
  config: NetworkConfig;
  network: StellarNetwork;
  switchNetwork: (network: StellarNetwork) => void;
  isMainnet: boolean;
  isTestnet: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<StellarNetwork>(readPersistedNetwork);

  const switchNetwork = useCallback((next: StellarNetwork) => {
    setNetwork(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const config = NETWORK_CONFIGS[network];

  return (
    <NetworkContext.Provider
      value={{
        config,
        network,
        switchNetwork,
        isMainnet: network === 'mainnet',
        isTestnet: network === 'testnet',
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider');
  return ctx;
}

export { NETWORK_CONFIGS };
