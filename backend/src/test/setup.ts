// Test setup for backend
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STELLAR_NETWORK = 'TESTNET';
process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_DISTRIBUTION_SECRET = 'STEST123456789ABCDEF';
process.env.STELLAR_DISTRIBUTION_ACCOUNT = 'GTEST123456789ABCDEF';

// Mock console methods in test environment
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};