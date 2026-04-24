#!/bin/bash

# SwiftSend Test Runner
# Runs all tests across frontend, backend, and contracts

set -e

echo "🧪 SwiftSend Test Suite Runner"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "contracts" ]; then
    print_error "Please run this script from the swift-send root directory"
    exit 1
fi

# Frontend Tests
echo ""
echo "🎨 Running Frontend Tests..."
echo "----------------------------"

if npm test -- --coverage --watchAll=false; then
    print_status "Frontend tests passed"
else
    print_error "Frontend tests failed"
    exit 1
fi

# Backend Tests
echo ""
echo "🔧 Running Backend Tests..."
echo "---------------------------"

cd backend
if npm test -- --coverage --watchAll=false; then
    print_status "Backend tests passed"
else
    print_error "Backend tests failed"
    exit 1
fi
cd ..

# Contract Tests (if Rust/Soroban is available)
echo ""
echo "📜 Running Contract Tests..."
echo "----------------------------"

if command -v cargo &> /dev/null; then
    cd contracts
    
    # Test each contract
    for contract_dir in */; do
        if [ -f "$contract_dir/Cargo.toml" ]; then
            echo "Testing contract: $contract_dir"
            cd "$contract_dir"
            
            if cargo test; then
                print_status "Contract tests passed for $contract_dir"
            else
                print_error "Contract tests failed for $contract_dir"
                exit 1
            fi
            
            cd ..
        fi
    done
    
    cd ..
else
    print_warning "Rust/Cargo not found, skipping contract tests"
fi

# Linting
echo ""
echo "🔍 Running Linters..."
echo "--------------------"

if npm run lint; then
    print_status "Frontend linting passed"
else
    print_warning "Frontend linting issues found"
fi

# Summary
echo ""
echo "📊 Test Summary"
echo "==============="
print_status "All tests completed successfully!"
echo ""
echo "Coverage reports generated:"
echo "  - Frontend: ./coverage/index.html"
echo "  - Backend: ./backend/coverage/index.html"
echo ""
echo "To run tests individually:"
echo "  Frontend: npm test"
echo "  Backend: cd backend && npm test"
echo "  Contracts: cd contracts && cargo test"