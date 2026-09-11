import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import SpendGuardABI from '@/contracts/SpendGuard.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownerAddress = body.ownerAddress;
    const prompt = body.prompt;
    const baseUrl = new URL(request.url).origin;
    const executionLogs: string[] = [];

    const log = (msg: string) => {
      console.log(`[Agent] ${msg}`);
      executionLogs.push(msg);
    };

    if (!ownerAddress || !prompt) {
      return NextResponse.json({ error: 'Owner address and prompt are required' }, { status: 400 });
    }

    const normalizedOwnerAddress = ownerAddress.trim().toLowerCase();

    // Fetch agent configured for this wallet
    const agentRecords = await db
      .select()
      .from(agents)
      .where(eq(agents.ownerAddress, normalizedOwnerAddress))
      .limit(1);

    console.log("Matching agents:", agentRecords);

    if (agentRecords.length === 0) {
      return NextResponse.json({ error: 'Agent not found for this wallet address' }, { status: 404 });
    }
    const agent = agentRecords[0];

    log(`Agent Identity loaded: ${agent.agentName} (${agent.agentAddress})`);

    // 2. Simple NLP routing
    let targetApi = '';
    let requestBody = {};
    const command = prompt.toLowerCase();

    if (command.includes('translate')) {
      targetApi = '/api/translate';
      requestBody = { text: prompt, targetLang: 'es' };
      log(`Intent recognized: Translation Service required.`);
    } else if (command.includes('compute') || command.includes('matrix') || command.includes('run')) {
      targetApi = '/api/compute';
      requestBody = { jobType: 'matrix_multiply' };
      log(`Intent recognized: Heavy Compute Service required.`);
    } else {
      return NextResponse.json({ error: "I don't know how to do that yet. Try 'Translate Hello World' or 'Run compute job'." }, { status: 400 });
    }

    // =====================================================================
    // STEP 3: Attempt the external API call (Hitting the 402 Paywall)
    // =====================================================================
    log(`Sending request to ${targetApi} without payment headers...`);
    let response = await fetch(`${baseUrl}${targetApi}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.status !== 402) {
      log(`Unexpected status: ${response.status}. Expected 402 Paywall.`);
      return NextResponse.json({ error: 'Expected 402 Paywall', logs: executionLogs });
    }

    // =====================================================================
    // STEP 4: Parse Paywall & Execute On-Chain Payment via SpendGuard
    // =====================================================================
    const paymentReq = await response.json();
    log(`HTTP 402 Payment Required intercepted. Cost: $${paymentReq.price} ${paymentReq.currency}`);
    log(`Provider: ${paymentReq.provider} | Request ID: ${paymentReq.requestId}`);

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const agentSigner = new ethers.Wallet(agent.privateKey, provider);
    const spendGuard = new ethers.Contract(paymentReq.paymentContract, SpendGuardABI.abi, agentSigner);

    const agentIdBytes = ethers.encodeBytes32String(agent.agentName);
    const requestIdBytes = ethers.encodeBytes32String(paymentReq.requestId);
    
    // Provider wallet address or mock receiver address
    const providerAddress = ethers.Wallet.createRandom().address; 
    const amountUnits = ethers.parseUnits(paymentReq.price, 6);

    log(`Authorizing SpendGuard transaction via execution wallet (${agent.agentAddress.slice(0, 6)}...)...`);
    
    const tx = await spendGuard.pay(
      agentIdBytes,
      requestIdBytes,
      providerAddress,
      amountUnits,
      paymentReq.serviceHash
    );
    
    log(`Transaction broadcasted. Waiting for confirmation (Hash: ${tx.hash.slice(0, 10)}...).`);
    const receipt = await tx.wait();
    log(`Transaction confirmed in block ${receipt.blockNumber}.`);

    // =====================================================================
    // STEP 5: Retry with Cryptographic Proof Header
    // =====================================================================
    const paymentProof = Buffer.from(JSON.stringify({
      agentId: agent.agentName,
      requestId: paymentReq.requestId,
      serviceHash: paymentReq.serviceHash,
      txHash: receipt.hash
    })).toString('base64');

    log(`Retrying ${targetApi} with X-Payment-Proof header...`);
    
    response = await fetch(`${baseUrl}${targetApi}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Proof': paymentProof
      },
      body: JSON.stringify(requestBody)
    });

    const finalData = await response.json();
    
    if (response.ok) {
      log(`Success! 200 OK received. Delivery receipt content hash: ${response.headers.get('x-content-hash')}`);
    } else {
      log(`Failed on retry: ${JSON.stringify(finalData)}`);
    }

    return NextResponse.json({
      success: true,
      logs: executionLogs,
      result: finalData.resource || finalData.result || finalData
    });

  } catch (error: any) {
    console.error("Agent execution failed:", error);
    return NextResponse.json({ error: error.message || error.reason || 'Execution failed' }, { status: 500 });
  }
}