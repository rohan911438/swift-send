# SwiftSend Testing Guide

This document outlines the comprehensive testing strategy implemented for the SwiftSend project.

## Overview

SwiftSend now includes a robust testing framework covering:
- **Frontend Components** - React component testing with Jest & Testing Library
- **Business Logic** - Fee calculations, compliance checks, transfer logic
- **Backend Services** - API routes, transfer lifecycle, request signing
- **Integration Tests** - End-to-end API testing with Supertest

## Test Structure

```
swift-send/
├── src/
│   ├── lib/__tests__/           # Frontend utility tests
│   │   ├── feeCalculation.test.ts
│   │   ├── transfers.test.ts
│   │   └── compliance.test.ts
│   └── components/__tests__/    # Component tests
│       ├── FeeBreakdown.test.tsx
│       └── BalanceCard.test.tsx
├── backend/src/
│   ├── modules/transfers/__tests__/  # Backend service tests
│   │   ├── requestSigning.test.ts
│   │   └── transferLifecycle.test.ts
│   └── routes/__tests__/        # API route tests
│       └── transfers.test.ts
└── contracts/                   # Smart contract tests
    └── */tests/test.rs
```

## Running Tests

### All Tests
```bash
# Run comprehensive test suite
./test-runner.sh

# Or run individually:
npm test                    # Frontend tests
cd backend && npm test      # Backend tests
cd contracts && cargo test # Contract tests
```

### Frontend Tests
```bash
# Run once
npm test -- --watchAll=false

# Watch mode for development
npm run test:watch

# With coverage
npm run test:coverage
```

### Backend Tests
```bash
cd backend

# Run once
npm test -- --watchAll=false

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Test Categories

### 1. Fee Calculation Tests (`feeCalculation.test.ts`)

Tests the core fee calculation logic:
- ✅ Standard fee calculations (0.5% service fee + network fee)
- ✅ Minimum fee enforcement ($0.01)
- ✅ Maximum fee cap ($25.00)
- ✅ Edge cases (zero, negative, very large amounts)
- ✅ Precision handling for financial calculations

**Key Test Cases:**
```typescript
// Standard calculation
calculateFees(100) → { serviceFee: 0.5, networkFee: 0.00001, totalFee: 0.50001 }

// Minimum fee
calculateFees(0.1) → { serviceFee: 0.01, ... }

// Maximum fee cap
calculateFees(100000) → { serviceFee: 25, ... }
```

### 2. Transfer Logic Tests (`transfers.test.ts`)

Tests transfer creation and status checking:
- ✅ Payload canonicalization for consistent signing
- ✅ HMAC-SHA256 signature generation and verification
- ✅ API integration with proper error handling
- ✅ Idempotency key handling

**Key Test Cases:**
```typescript
// Consistent canonicalization
canonicalizeTransferPayload(payload1) === canonicalizeTransferPayload(payload2)

// Signature verification
createTransfer(payload, secret) // Includes valid signature
```

### 3. Compliance Tests (`compliance.test.ts`)

Tests compliance and risk assessment:
- ✅ Tier-based transaction limits (Starter, Verified, Premium)
- ✅ Daily, monthly, yearly spending limits
- ✅ High-risk country detection
- ✅ Risk score calculation based on amount, frequency, destination
- ✅ Enhanced verification requirements

**Key Test Cases:**
```typescript
// Limit enforcement
checkComplianceLimits(starterUser, 2000, 'US') → { allowed: false }

// Risk assessment
calculateRiskScore(9000, 'AF', 10, 15000) → { level: 'high' }
```

### 4. Component Tests

#### FeeBreakdown Component (`FeeBreakdown.test.tsx`)
- ✅ Renders fee breakdown correctly
- ✅ Handles different amount ranges
- ✅ Shows institutional messaging
- ✅ Displays settlement time information

#### BalanceCard Component (`BalanceCard.test.tsx`)
- ✅ Displays balance with proper formatting
- ✅ Navigation to different pages
- ✅ Button state management (disabled when balance is zero)
- ✅ FDIC protection messaging

### 5. Backend Service Tests

#### Request Signing (`requestSigning.test.ts`)
- ✅ Payload canonicalization with nested object sorting
- ✅ HMAC-SHA256 signature generation and verification
- ✅ Tamper detection
- ✅ Signature field exclusion from canonicalization

#### Transfer Lifecycle (`transferLifecycle.test.ts`)
- ✅ Transfer creation with validation
- ✅ Idempotency key handling
- ✅ Different recipient types (wallet, cash_pickup, bank)
- ✅ Amount and currency validation
- ✅ Status history tracking

### 6. API Route Tests (`transfers.test.ts`)

Integration tests for transfer endpoints:
- ✅ POST /transfers with authentication
- ✅ GET /transfers/:id/status
- ✅ Request validation and error handling
- ✅ Different recipient types
- ✅ Duplicate idempotency key handling

## Test Configuration

### Frontend (Jest + Testing Library)
```javascript
// jest.config.js
{
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapping: { '^@/(.*)$': '<rootDir>/src/$1' }
}
```

### Backend (Jest + Supertest)
```javascript
// jest.config.js
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']
}
```

## Mocking Strategy

### Frontend Mocks
- **Crypto API**: Mocked for signature generation tests
- **Wallet APIs**: Freighter, Rabet wallet mocks
- **Router**: React Router navigation mocks
- **API calls**: Fetch/axios mocks for API integration

### Backend Mocks
- **Environment variables**: Test-specific configuration
- **External services**: Stellar SDK, database connections
- **Console methods**: Suppressed in test environment

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Current coverage reports are generated in:
- Frontend: `./coverage/index.html`
- Backend: `./backend/coverage/index.html`

## Continuous Integration

GitHub Actions workflow (`.github/workflows/test.yml`) runs:
1. Frontend tests with coverage
2. Backend tests with coverage
3. Contract tests (when Rust is available)
4. Coverage upload to Codecov

## Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert

### Test Data
- Use realistic test data that matches production scenarios
- Test edge cases and boundary conditions
- Include both positive and negative test cases

### Assertions
- Use specific assertions (`toBe`, `toEqual`, `toContain`)
- Test both success and error scenarios
- Verify side effects (API calls, state changes)

### Maintenance
- Update tests when business logic changes
- Remove obsolete tests for deprecated features
- Keep test dependencies up to date

## Running Specific Tests

```bash
# Run specific test file
npm test feeCalculation.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="fee calculation"

# Run tests in specific directory
npm test src/lib/__tests__/

# Debug mode
npm test -- --verbose --no-coverage
```

## Troubleshooting

### Common Issues

1. **Module resolution errors**: Check `moduleNameMapping` in Jest config
2. **Async test timeouts**: Increase timeout or check for unresolved promises
3. **Mock issues**: Ensure mocks are properly reset between tests
4. **Coverage gaps**: Add tests for uncovered branches and edge cases

### Debug Tips

```bash
# Run single test with full output
npm test -- --testNamePattern="specific test" --verbose

# Check test coverage details
npm run test:coverage -- --verbose

# Run tests without cache
npm test -- --no-cache
```

This comprehensive testing setup ensures SwiftSend's reliability across all components, from fee calculations to API endpoints to smart contract interactions.