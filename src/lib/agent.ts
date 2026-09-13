import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

// Prevent TypeScript from complaining about the custom global variable
declare global {
  var _agentEventEmitter: EventEmitter | undefined;
}

// Ensure a single instance of EventEmitter across the entire Next.js application,
// preventing memory leaks and broken streams during development reloads.
export const agentEventEmitter = globalThis._agentEventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalThis._agentEventEmitter = agentEventEmitter;
}

// ---------------------------------------------------------------------------
// Helper Types & Functions
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'system' | 'contract' | 'http';

interface AgentLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

/**
 * Call this function from anywhere in your backend (like API routes or agent scripts)
 * to instantly broadcast a log to the frontend Agent Console.
 */
export function emitAgentLog(level: LogLevel, message: string, detail?: string) {
  const logData: AgentLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().split('T')[1].slice(0, 12), // HH:MM:SS.mmm format
    level,
    message,
    detail,
  };

  agentEventEmitter.emit('agentLog', logData);
}

// ---------------------------------------------------------------------------
// EIP-712 Payment Verification
// ---------------------------------------------------------------------------

export interface PaymentProof {
  agentId: string; // Can be agent name string or bytes32 hex
  requestId: string;
  provider: string;
  amount: number | string; // Native 0G token amount
  serviceHash: string;
  signature: string; // EIP-712 Off-chain signature
}

export interface PaymentVerificationResult {
  success: boolean;
  reason?: 'BudgetExceeded' | 'RequestAlreadyProcessed' | 'InvalidProof' | 'ContractRevert' | 'InsufficientUserBalance';
  spentAfter?: number;
}

/**
 * Verify off-chain payment proof against on-chain contract state.
 */
export async function verifyContractPay(proof: PaymentProof): Promise<PaymentVerificationResult> {
  const agentKey = proof.agentId.startsWith('0x') 
    ? ethers.decodeBytes32String(proof.agentId).replace(/\0/g, '') 
    : proof.agentId;

  try {
    const rpcUrl = process.env.ZEROG_RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);
    
    const agentIdBytes = ethers.encodeBytes32String(agentKey);
    const expectedSigner = await contract.agentAddresses(agentIdBytes);
    
    // 1. Recover EIP-712 Signer
    const domain = {
      name: 'SpendGuard',
      version: '1',
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: Addresses.SpendGuard
    };
    
    const types = {
      Payment: [
        { name: 'agentId', type: 'bytes32' },
        { name: 'requestId', type: 'bytes32' },
        { name: 'provider', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'serviceHash', type: 'bytes32' }
      ]
    };
    
    const amountWei = ethers.parseUnits(proof.amount.toString(), 18);
    
    const recoveredAddress = ethers.verifyTypedData(
      domain, 
      types, 
      { 
        agentId: agentIdBytes, 
        requestId: ethers.encodeBytes32String(proof.requestId), 
        provider: proof.provider, 
        amount: amountWei, 
        serviceHash: proof.serviceHash 
      }, 
      proof.signature
    );

    if (recoveredAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
      return { success: false, reason: 'InvalidProof' };
    }

    // 2. Dry-run Budget Verification
    const [limit, spent, active] = await contract.getBudget(agentIdBytes);
    if (!active || limit === BigInt(0)) {
      return { success: false, reason: 'InvalidProof' };
    }

    if (spent + amountWei > limit) {
      return { success: false, reason: 'BudgetExceeded' };
    }

    const isProcessed = await contract.processedRequests(ethers.encodeBytes32String(proof.requestId));
    if (isProcessed) {
      return { success: false, reason: 'RequestAlreadyProcessed' };
    }

    return { 
      success: true, 
      spentAfter: Number(ethers.formatUnits(spent + amountWei, 18)) 
    };

  } catch (err) {
    console.warn("Verification failed:", err);
    return { success: false, reason: 'ContractRevert' };
  }
}