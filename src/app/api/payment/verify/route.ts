/**
 * SpendGuard Payment Verification Utility
 *
 * This module simulates the on-chain SpendGuard contract interaction.
 * In production, this would call the deployed SpendGuard.sol contract
 * via ethers.js using the contract ABI and provider.
 *
 * Security model:
 *   - The contract is the FINAL authority on budget enforcement.
 *   - This backend verifies the payment proof submitted by the agent.
 *   - Even if this backend is compromised, the contract will reject overspends.
 */

export interface PaymentProof {
  agentId: string;
  requestId: string;
  provider: string;
  amount: number; // USDC in micro-units (6 decimals)
  serviceHash: string;
  txHash?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  reason?: 'BudgetExceeded' | 'RequestAlreadyProcessed' | 'InvalidProof' | 'ContractRevert';
  txHash?: string;
  blockNumber?: number;
  spentAfter?: number;
  remainingAfter?: number;
}

// ---------------------------------------------------------------------------
// In-memory simulation of SpendGuard contract state
// (Replace with ethers.js contract calls for real deployment)
// ---------------------------------------------------------------------------

interface BudgetState {
  limit: number;
  spent: number;
  active: boolean;
}

const budgets: Record<string, BudgetState> = {
  ResearchAgent: { limit: 10_000_000, spent: 0, active: true }, // $10.00 USDC
};

const processedRequests = new Set<string>();

let simulatedBlock = 7_842_380;

function nextBlock() {
  return ++simulatedBlock;
}

function randomTxHash(): string {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `0x${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`;
}

/**
 * Simulate SpendGuard.pay() on-chain call.
 *
 * Replicates the Solidity logic:
 *   require(budget.active, "BudgetNotActive");
 *   require(!processedRequests[requestId], "RequestAlreadyProcessed");
 *   require(budget.spent + amount <= budget.limit, "BudgetExceeded");
 *   budget.spent += amount;
 *   processedRequests[requestId] = true;
 *   emit PaymentAuthorized(...);
 */
export function simulateContractPay(proof: PaymentProof): PaymentVerificationResult {
  const budget = budgets[proof.agentId];

  if (!budget || !budget.active) {
    return { success: false, reason: 'InvalidProof' };
  }

  // Replay protection — mirrors: require(!processedRequests[requestId])
  if (processedRequests.has(proof.requestId)) {
    return { success: false, reason: 'RequestAlreadyProcessed' };
  }

  // Hard budget enforcement — mirrors: require(spent + amount <= limit)
  if (budget.spent + proof.amount > budget.limit) {
    return {
      success: false,
      reason: 'BudgetExceeded',
      spentAfter: budget.spent,
      remainingAfter: budget.limit - budget.spent,
    };
  }

  // Commit state changes
  budget.spent += proof.amount;
  processedRequests.add(proof.requestId);

  const txHash = randomTxHash();
  const blockNumber = nextBlock();

  return {
    success: true,
    txHash,
    blockNumber,
    spentAfter: budget.spent,
    remainingAfter: budget.limit - budget.spent,
  };
}

/**
 * Reset budget state — used by the hackathon demo runner.
 */
export function resetBudgetState(agentId: string, limitUSDC: number) {
  budgets[agentId] = { limit: limitUSDC * 1_000_000, spent: 0, active: true };
  // Clear processed requests for this demo run
  processedRequests.clear();
}

/**
 * Get current budget state — used by the dashboard.
 */
export function getBudgetState(agentId: string) {
  const b = budgets[agentId];
  if (!b) return null;
  return {
    limit: b.limit / 1_000_000,
    spent: b.spent / 1_000_000,
    remaining: (b.limit - b.spent) / 1_000_000,
    active: b.active,
  };
}

// ---------------------------------------------------------------------------
// Next.js Route Handler — GET /api/payment/verify
// Returns current budget state for the dashboard
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId') ?? 'ResearchAgent';

  const state = getBudgetState(agentId);
  if (!state) {
    return Response.json({ error: 'Agent not found' }, { status: 404 });
  }

  return Response.json({ agentId, ...state });
}
