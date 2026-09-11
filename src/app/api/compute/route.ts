/**
 * ComputeService Backend — x402-style HTTP 402 Payment Flow
 *
 * Endpoints:
 *   POST /api/compute
 *
 * Flow:
 *   1. Agent calls POST /api/compute (no payment header)
 *      → 402 Payment Required + payment requirements JSON
 *   2. Agent submits payment to SpendGuard contract
 *   3. Agent retries POST /api/compute with X-Payment-Proof header
 *      → 200 OK + compute result + delivery receipt
 *
 * Price: $3.00 USDC (standard) / $3.00 USDC (premium — triggers BudgetExceeded in demo)
 */

import { createHash } from 'crypto';
import { simulateContractPay } from '../payment/verify/route';
import Addresses from '@/contracts/addresses.json';

const PROVIDER_NAME = 'ComputeService';
const PRICE_USDC = 3_000_000; // $3.00 in 6-decimal USDC
const PAYMENT_CONTRACT = Addresses.SpendGuard;
const PAYMENT_NETWORK = 'ethereum-sepolia';

// ---------------------------------------------------------------------------
// Mock compute engine
// ---------------------------------------------------------------------------

type JobResult = {
  jobId: string;
  jobType: string;
  result: string;
  computeMs: number;
};

function mockCompute(jobType: string, jobId: string, dimensions?: string): JobResult {
  const computeMs = 400 + Math.floor(Math.random() * 600);

  switch (jobType) {
    case 'matrix_multiply': {
      const dim = dimensions ?? '512x512';
      return {
        jobId,
        jobType,
        result: `Matrix multiplication ${dim} completed. Result shape: ${dim}. Peak FLOPS: 2.4T.`,
        computeMs,
      };
    }
    case 'prime_sieve': {
      return {
        jobId,
        jobType,
        result: 'Sieve of Eratosthenes up to 10^7: 664,579 primes found.',
        computeMs,
      };
    }
    case 'hash_benchmark': {
      return {
        jobId,
        jobType,
        result: 'SHA-256 throughput: 1.2 GB/s. keccak256 throughput: 890 MB/s.',
        computeMs,
      };
    }
    default: {
      return {
        jobId,
        jobType,
        result: `Generic compute job "${jobType}" completed successfully.`,
        computeMs,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// POST /api/compute
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const paymentProofHeader = request.headers.get('x-payment-proof');

  // -------------------------------------------------------------------------
  // STEP 1 — No payment header → return 402 Payment Required
  // -------------------------------------------------------------------------
  if (!paymentProofHeader) {
    const requestId = `req_${generateId()}`;

    const serviceHash = keccak256Mock(
      JSON.stringify({ provider: PROVIDER_NAME, requestId, price: PRICE_USDC })
    );

    const paymentRequirements = {
      price: '3.00',
      currency: 'USDC',
      provider: PROVIDER_NAME,
      requestId,
      paymentNetwork: PAYMENT_NETWORK,
      paymentContract: PAYMENT_CONTRACT,
      serviceHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      instructions:
        'Submit payment via SpendGuard.pay(agentId, requestId, provider, amount, serviceHash), then retry this request with the X-Payment-Proof header.',
    };

    return Response.json(paymentRequirements, {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Required': 'true',
        'X-Provider': PROVIDER_NAME,
        'X-Price-USDC': '3.00',
      },
    });
  }

  // -------------------------------------------------------------------------
  // STEP 2 — Payment proof provided → verify via SpendGuard contract
  // -------------------------------------------------------------------------
  let proof: {
    agentId: string;
    requestId: string;
    serviceHash: string;
    txHash?: string;
  };

  try {
    proof = JSON.parse(Buffer.from(paymentProofHeader, 'base64').toString('utf-8'));
  } catch {
    return Response.json({ error: 'Malformed X-Payment-Proof header' }, { status: 400 });
  }

  const verificationResult = simulateContractPay({
    agentId: proof.agentId,
    requestId: proof.requestId,
    provider: PROVIDER_NAME,
    amount: PRICE_USDC,
    serviceHash: proof.serviceHash,
    txHash: proof.txHash,
  });

  if (!verificationResult.success) {
    const statusCode =
      verificationResult.reason === 'RequestAlreadyProcessed' ? 409 : 402;

    return Response.json(
      {
        error: verificationResult.reason,
        requestId: proof.requestId,
        provider: PROVIDER_NAME,
        attempted: '3.00',
        spent: verificationResult.spentAfter
          ? (verificationResult.spentAfter / 1_000_000).toFixed(2)
          : undefined,
        remaining: verificationResult.remainingAfter
          ? (verificationResult.remainingAfter / 1_000_000).toFixed(2)
          : undefined,
        message:
          verificationResult.reason === 'BudgetExceeded' ?'SpendGuard contract rejected: budget limit exceeded.'
            : verificationResult.reason === 'RequestAlreadyProcessed' ?'SpendGuard contract rejected: this requestId was already processed (replay protection).' :'Payment verification failed.',
      },
      { status: statusCode }
    );
  }

  // -------------------------------------------------------------------------
  // STEP 3 — Payment verified → deliver resource + receipt
  // -------------------------------------------------------------------------
  const jobType = String(body.jobType ?? 'matrix_multiply');
  const jobId = String(body.jobId ?? `job_${generateId()}`);
  const dimensions = body.dimensions ? String(body.dimensions) : undefined;

  const jobResult = mockCompute(jobType, jobId, dimensions);

  // Compute content hash of the delivered resource (SHA-256)
  const contentHash = sha256Hash(JSON.stringify(jobResult));

  const deliveryReceipt = {
    requestId: proof.requestId,
    provider: PROVIDER_NAME,
    service: `Compute job: ${jobType}`,
    amount: '3.00',
    currency: 'USDC',
    paymentTx: verificationResult.txHash,
    blockNumber: verificationResult.blockNumber,
    resource: jobResult,
    contentHash,
    deliveredAt: new Date().toISOString(),
    budgetAfter: {
      spent: verificationResult.spentAfter
        ? (verificationResult.spentAfter / 1_000_000).toFixed(2)
        : undefined,
      remaining: verificationResult.remainingAfter
        ? (verificationResult.remainingAfter / 1_000_000).toFixed(2)
        : undefined,
    },
  };

  return Response.json(deliveryReceipt, {
    status: 200,
    headers: {
      'X-Content-Hash': contentHash,
      'X-Request-Id': proof.requestId,
      'X-Provider': PROVIDER_NAME,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/compute — service info / health check
// ---------------------------------------------------------------------------

export async function GET() {
  return Response.json({
    provider: PROVIDER_NAME,
    version: '1.0.0',
    price: '3.00',
    currency: 'USDC',
    paymentNetwork: PAYMENT_NETWORK,
    paymentContract: PAYMENT_CONTRACT,
    endpoint: 'POST /api/compute',
    paymentFlow: 'x402-compatible',
    description:
      'Call POST /api/compute without X-Payment-Proof to receive HTTP 402 with payment requirements. Submit payment to SpendGuard contract, then retry with X-Payment-Proof header.',
    supportedJobTypes: ['matrix_multiply', 'prime_sieve', 'hash_benchmark'],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function sha256Hash(data: string): string {
  return '0x' + createHash('sha256').update(data).digest('hex');
}

function keccak256Mock(data: string): string {
  // Returns a full 64-character hex string (32 bytes / bytes32)
  return '0x' + createHash('sha256').update('keccak:' + data).digest('hex');
}