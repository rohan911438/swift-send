import '@testing-library/jest-dom';

// Mock crypto.subtle for testing
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: jest.fn().mockResolvedValue({}),
      sign: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// Mock window.freighter for wallet tests
Object.defineProperty(window, 'freighter', {
  value: {
    isConnected: jest.fn().mockResolvedValue(true),
    getPublicKey: jest.fn().mockResolvedValue('GTEST...'),
    signTransaction: jest.fn().mockResolvedValue('signed_tx'),
  },
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));