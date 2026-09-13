/**
 * TranslationService Backend — x402-style HTTP 402 Payment Flow
 */

import { createHash } from 'crypto';
import { simulateContractPay } from '../payment/verify/route';
import Addresses from '@/contracts/addresses.json';

const PROVIDER_NAME = 'TranslationService';
const PRICE_0G = 2_000_000; // $2.00 in 6-decimal 0G
const PAYMENT_CONTRACT = Addresses.SpendGuard;
const PAYMENT_NETWORK = '0g-testnet';

// ---------------------------------------------------------------------------
// ACTUAL Translation Engine (Using free MyMemory API)
// ---------------------------------------------------------------------------

async function realTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    // Calling the free MyMemory translation API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    return `[API Error] Could not parse translation`;
  } catch (err) {
    console.error("Translation API failed:", err);
    return `[Network Error] Translation failed for: ${text}`;
  }
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

  // STEP 1 — Paywall
  if (!paymentProofHeader) {
    const requestId = `req_${generateId()}`;
    const serviceHash = keccak256Mock(JSON.stringify({ provider: PROVIDER_NAME, requestId, price: PRICE_0G }));

    return Response.json({
      price: '2.00',
      currency: '0G',
      provider: PROVIDER_NAME,
      requestId,
      paymentNetwork: PAYMENT_NETWORK,
      paymentContract: PAYMENT_CONTRACT,
      serviceHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      instructions: 'Submit payment via SpendGuard.pay(agentId, requestId, provider, amount, serviceHash), then retry this request with the X-Payment-Proof header.',
    }, {
      status: 402,
      headers: { 'Content-Type': 'application/json', 'X-Payment-Required': 'true', 'X-Provider': PROVIDER_NAME, 'X-Price-0G': '2.00' },
    });
  }

  // STEP 2 — Verification
  let proof: any;
  try { proof = JSON.parse(Buffer.from(paymentProofHeader, 'base64').toString('utf-8')); } 
  catch { return Response.json({ error: 'Malformed X-Payment-Proof header' }, { status: 400 }); }

  const verificationResult = simulateContractPay({
    agentId: proof.agentId, requestId: proof.requestId, provider: PROVIDER_NAME,
    amount: PRICE_0G, serviceHash: proof.serviceHash, txHash: proof.txHash,
  });

  if (!verificationResult.success) {
    const statusCode = verificationResult.reason === 'RequestAlreadyProcessed' ? 409 : 402;
    return Response.json({ error: verificationResult.reason }, { status: statusCode });
  }

  // STEP 3 — Execute Real Translation
  const text = String(body.text ?? 'The budget enforcement is on-chain.');
  const sourceLang = String(body.sourceLang ?? 'en');
  const targetLang = String(body.targetLang ?? 'es'); // Default to Spanish

  // Notice we await the actual translation network call now!
  const translatedText = await realTranslate(text, sourceLang, targetLang);

  const contentHash = sha256Hash(translatedText);

  return Response.json({
    requestId: proof.requestId,
    provider: PROVIDER_NAME,
    service: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()} translation`,
    amount: '2.00',
    currency: '0G',
    paymentTx: verificationResult.txHash,
    blockNumber: verificationResult.blockNumber,
    resource: translatedText,
    contentHash,
    deliveredAt: new Date().toISOString(),
  }, {
    status: 200,
    headers: { 'X-Content-Hash': contentHash, 'X-Request-Id': proof.requestId, 'X-Provider': PROVIDER_NAME },
  });
}

export async function GET() {
  return Response.json({
    provider: PROVIDER_NAME, version: '1.0.0', price: '2.00', endpoint: 'POST /api/translate',
    supportedLanguages: ['en', 'hi', 'es', 'fr', 'de', 'ja'], // MyMemory supports dozens more!
  });
}

function generateId(): string { return Math.random().toString(36).slice(2, 10); }
function sha256Hash(data: string): string { return '0x' + createHash('sha256').update(data).digest('hex'); }
function keccak256Mock(data: string): string { return '0x' + createHash('sha256').update('keccak:' + data).digest('hex'); }