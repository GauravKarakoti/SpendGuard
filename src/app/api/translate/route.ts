/**
 * TranslationService Backend — x402-style HTTP 402 Payment Flow
 *
 * Endpoints:
 *   POST /api/translate
 *
 * Flow:
 *   1. Agent calls POST /api/translate (no payment header)
 *      → 402 Payment Required + payment requirements JSON
 *   2. Agent submits payment to SpendGuard contract
 *   3. Agent retries POST /api/translate with X-Payment-Proof header
 *      → 200 OK + translated resource + delivery receipt
 *
 * Price: $2.00 USDC
 */

import { createHash } from 'crypto';
import { simulateContractPay } from '../payment/verify/route';
import Addresses from '@/contracts/addresses.json';

const PROVIDER_NAME = 'TranslationService';
const PRICE_USDC = 2_000_000; // $2.00 in 6-decimal USDC
const PAYMENT_CONTRACT = Addresses.SpendGuard;
const PAYMENT_NETWORK = 'ethereum-sepolia';

// ---------------------------------------------------------------------------
// Simple mock translation engine
// ---------------------------------------------------------------------------

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    hi: 'बजट प्रवर्तन ऑन-चेन है।',
    es: 'La aplicación del presupuesto está en cadena.',
    fr: "L'application du budget est sur la chaîne.",
    de: 'Die Budgetdurchsetzung erfolgt on-chain.',
    ja: '予算の執行はオンチェーンです。',
  },
};

function mockTranslate(text: string, sourceLang: string, targetLang: string): string {
  // Return a deterministic mock translation
  const key = `${sourceLang}-${targetLang}`;
  const lookup = TRANSLATIONS[sourceLang]?.[targetLang];
  if (lookup) return lookup;
  return `[${targetLang.toUpperCase()}] ${text}`;
}

// ---------------------------------------------------------------------------
// POST /api/translate
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
      price: '2.00',
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
        'X-Price-USDC': '2.00',
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
        attempted: '2.00',
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
  const text = String(body.text ?? 'The budget enforcement is on-chain.');
  const sourceLang = String(body.sourceLang ?? 'en');
  const targetLang = String(body.targetLang ?? 'hi');

  const translatedText = mockTranslate(text, sourceLang, targetLang);

  // Compute content hash of the delivered resource (SHA-256)
  const contentHash = sha256Hash(translatedText);

  const deliveryReceipt = {
    requestId: proof.requestId,
    provider: PROVIDER_NAME,
    service: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()} translation`,
    amount: '2.00',
    currency: 'USDC',
    paymentTx: verificationResult.txHash,
    blockNumber: verificationResult.blockNumber,
    resource: translatedText,
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
// GET /api/translate — service info / health check
// ---------------------------------------------------------------------------

export async function GET() {
  return Response.json({
    provider: PROVIDER_NAME,
    version: '1.0.0',
    price: '2.00',
    currency: 'USDC',
    paymentNetwork: PAYMENT_NETWORK,
    paymentContract: PAYMENT_CONTRACT,
    endpoint: 'POST /api/translate',
    paymentFlow: 'x402-compatible',
    description:
      'Call POST /api/translate without X-Payment-Proof to receive HTTP 402 with payment requirements. Submit payment to SpendGuard contract, then retry with X-Payment-Proof header.',
    supportedLanguages: ['en', 'hi', 'es', 'fr', 'de', 'ja'],
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
  // Return full 32-byte SHA-256 hash formatted as bytes32
  return '0x' + createHash('sha256').update('keccak:' + data).digest('hex');
}
