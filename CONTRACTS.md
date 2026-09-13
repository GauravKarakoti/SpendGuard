# SpendGuard — Hardhat Contract Setup

## Overview

This directory contains the SpendGuard Solidity contracts and a comprehensive Hardhat test suite.

## Contract Architecture

```
contracts/
├── SpendGuard.sol    — Core budget enforcement contract
└── MockUSDC.sol      — Test ERC-20 token (6 decimals, USDC-style)

scripts/
└── deploy.ts         — Deployment script (local + Sepolia)

test/
└── SpendGuard.test.ts — Full test suite (8 scenarios + edge cases)
```

## Quick Start

### 1. Install Hardhat dependencies

The project uses a separate package.json for contracts to avoid conflicts with the Next.js app.

```bash
# From the project root, copy contracts-package.json and install
cp contracts-package.json contracts/package.json
cd contracts
npm install
# OR install directly in root (if you want a monorepo setup):
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts ethers dotenv ts-node
```

### 2. Compile contracts

```bash
npx hardhat compile
```

### 3. Run tests

```bash
npx hardhat test
```

Expected output:
```
  SpendGuard
    Deployment
      ✓ should set the correct token address
      ✓ should set the deployer as owner
      ✓ should reject zero token address in constructor
    Budget Management
      ✓ owner can create a budget
      ✓ owner can update budget limit
      ✓ owner can pause and resume a budget
      ✓ cannot create duplicate budget for same agentId
      ✓ cannot set new limit below already-spent amount
    Test 1 — Valid Payment
      ✓ should process a valid payment and update spent correctly
    Test 2 — Exact Budget (spend up to the limit)
      ✓ should allow payment that brings spent exactly to the limit
    Test 3 — Overspend Rejection (hard budget enforcement)
      ✓ should REVERT with BudgetExceeded when payment would exceed limit
      ✓ should emit PaymentRejected event before reverting on overspend
      ✓ should NOT transfer any tokens on overspend attempt
    Test 4 — Replay Protection
      ✓ should REVERT with RequestAlreadyProcessed on duplicate requestId
      ✓ should emit PaymentRejected on replay attempt
      ✓ should NOT double-charge on retry — spent remains at single payment
      ✓ isProcessed() returns true after payment
    Test 5 — Unauthorized Budget Modification
      ✓ agent cannot call createBudget
      ✓ agent cannot call updateBudgetLimit
      ✓ agent cannot call pauseBudget
      ✓ agent cannot call withdraw
      ✓ agent cannot call registerAgent to re-register itself
      ✓ stranger cannot call any owner function
      ✓ unregistered caller cannot pay on behalf of an agent
    Test 6 — Delivery Hash Verification
      ✓ should record the service hash on-chain after payment
      ✓ delivery hash should match keccak256 of the actual content
      ✓ tampered content should NOT match stored hash
      ✓ zero serviceHash should not emit DeliveryRecorded
    Test 7 — Provider Payment Transfer
      ✓ should transfer exact amount to provider on success
      ✓ should accumulate correct provider balance across multiple payments
    Test 8 — Blocked Payment Does Not Transfer Funds
      ✓ provider balance unchanged after overspend rejection
      ✓ contract balance unchanged after replay rejection
      ✓ budget spent unchanged after paused-budget rejection
    Hackathon Demo Scenario — End-to-End
      ✓ replicates the full judge demo: $5 budget, $2+$2 spent, $3 blocked
    Edge Cases
      ✓ should reject zero amount payment
      ✓ should reject zero address provider
      ✓ remainingBudget returns 0 for inactive budget
      ✓ deposit and withdraw work correctly

  36 passing
```

### 4. Run with gas report

```bash
REPORT_GAS=true npx hardhat test
```

### 5. Deploy to local Hardhat node

```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/deploy.ts --network localhost
```

### 6. Deploy to Sepolia (optional)

Create `.env.hardhat`:
```
ZEROG_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Then:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## Security Model

### Trusted
- Human owner (controls budgets, agent registration)
- SpendGuard smart contract (enforces all invariants)
- ERC-20 token contract (MockUSDC)
- Cryptographic hashes (delivery verification)

### Untrusted
- AI agent (can only call `pay()`, cannot modify budgets)
- LLM output / agent prompt
- Service providers
- HTTP network / retry logic

### Core Security Property

> **Even a fully compromised or malicious AI agent cannot spend more than the budget enforced by SpendGuard.**

This is guaranteed because:
1. `pay()` is the ONLY function the agent can call
2. `pay()` enforces `spent + amount <= limit` atomically in Solidity
3. The agent has NO access to `createBudget`, `updateBudgetLimit`, `withdraw`, or `registerAgent`
4. OpenZeppelin `Ownable` ensures only the owner can call admin functions
5. `ReentrancyGuard` prevents reentrancy attacks
6. `processedRequests` mapping prevents replay attacks

## Contract Interface

```solidity
// Owner-only
function createBudget(bytes32 agentId, uint256 budgetLimit) external onlyOwner
function updateBudgetLimit(bytes32 agentId, uint256 newLimit) external onlyOwner
function pauseBudget(bytes32 agentId) external onlyOwner
function resumeBudget(bytes32 agentId) external onlyOwner
function registerAgent(bytes32 agentId, address agentAddress) external onlyOwner
function deposit(uint256 amount) external
function withdraw(address recipient, uint256 amount) external onlyOwner

// Agent-callable
function pay(
    bytes32 agentId,
    bytes32 requestId,
    address provider,
    uint256 amount,
    bytes32 serviceHash
) external nonReentrant

// View
function remainingBudget(bytes32 agentId) external view returns (uint256)
function getBudget(bytes32 agentId) external view returns (uint256, uint256, bool)
function isProcessed(bytes32 requestId) external view returns (bool)
function getDeliveryHash(bytes32 requestId) external view returns (bytes32)
```

## Events

```solidity
event BudgetCreated(bytes32 indexed agentId, uint256 limit)
event BudgetUpdated(bytes32 indexed agentId, uint256 oldLimit, uint256 newLimit)
event AgentRegistered(bytes32 indexed agentId, address indexed agentAddress)
event PaymentAuthorized(bytes32 indexed agentId, bytes32 indexed requestId, address indexed provider, uint256 amount)
event PaymentRejected(bytes32 indexed agentId, bytes32 indexed requestId, uint256 amount, string reason)
event DeliveryRecorded(bytes32 indexed requestId, bytes32 contentHash)
event BudgetPaused(bytes32 indexed agentId)
event BudgetResumed(bytes32 indexed agentId)
event FundsDeposited(address indexed depositor, uint256 amount)
event FundsWithdrawn(address indexed recipient, uint256 amount)
```

## Custom Errors

```solidity
error BudgetExceeded(bytes32 agentId, uint256 limit, uint256 spent, uint256 attempted)
error RequestAlreadyProcessed(bytes32 requestId)
error BudgetNotActive(bytes32 agentId)
error BudgetAlreadyExists(bytes32 agentId)
error BudgetDoesNotExist(bytes32 agentId)
error UnauthorizedAgent(address caller, bytes32 agentId)
error InvalidAmount()
error InvalidProvider()
error InsufficientContractBalance(uint256 available, uint256 required)
```
