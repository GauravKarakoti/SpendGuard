import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { agents, auditLogs, http402Flows, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  let dbLogId: string | null = null;

  try {
    const { ownerAddress, prompt } = await request.json();
    const baseUrl = new URL(request.url).origin;
    const executionLogs: string[] = [];
    const log = (msg: string) => { console.log(`[Agent] ${msg}`); executionLogs.push(msg); };

    const normalizedOwnerAddress = ownerAddress.trim().toLowerCase();
    const agentRecords = await db.select().from(agents).where(eq(agents.ownerAddress, normalizedOwnerAddress)).limit(1);
    if (agentRecords.length === 0) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    const agent = agentRecords[0];

    const command = prompt.toLowerCase();
    let targetApi = '';
    let requestBody = {};
    let taskType = '';

    const activeProviders = await db
      .select()
      .from(providers)
      .where(eq(providers.selected, true));

    if (command.includes('translate')) {
      const provider = activeProviders.find(p => p.id === 'prov_trans_primary');
      if (!provider) return NextResponse.json({ error: 'No translation provider configured.' }, { status: 400 });
      
      let textToTranslate = prompt.replace(/translate/i, '').trim();
      let targetLang = 'es'; 
      
      const langMatch = prompt.match(/to\s+([a-zA-Z]+)/i);
      if (langMatch) {
        const langStr = langMatch[1].toLowerCase();
        const langMap: Record<string, string> = { hindi: 'hi', spanish: 'es', french: 'fr', german: 'de', japanese: 'ja', english: 'en' };
        targetLang = langMap[langStr] || 'es';
        textToTranslate = textToTranslate.replace(new RegExp(`to\\s+${langStr}`, 'i'), '').trim();
      }

      targetApi = '/api/translate';
      taskType = 'Translation';
      requestBody = { text: textToTranslate, targetLang, providerId: provider.id };
      
      log(`Intent recognized: Routing to ${provider.name} at ${provider.price} 0G`);
      
    } else if (command.includes('compute') || command.includes('matrix') || command.includes('run')) {
      const provider = activeProviders.find(p => p.id === 'prov_comp_primary');
      if (!provider) return NextResponse.json({ error: 'No compute provider configured.' }, { status: 400 });

      targetApi = '/api/compute';
      taskType = 'Compute';
      requestBody = { jobType: 'matrix_multiply', payload: prompt, providerId: provider.id };
      
      log(`Intent recognized: Routing to ${provider.name} at ${provider.price} 0G`);
      
    } else {
      return NextResponse.json({ error: "Unknown command. Try 'Translate Hello World'." }, { status: 400 });
    }

    const flowId = randomUUID();
    await db.insert(http402Flows).values({
      id: flowId,
      ownerAddress: normalizedOwnerAddress,
      label: `Agent Task: ${taskType}`,
      method: 'POST',
      endpoint: targetApi,
      requestPayload: requestBody,
    });

    let response = await fetch(`${baseUrl}${targetApi}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.status !== 402) {
      return NextResponse.json({ error: 'Expected 402 Paywall', logs: executionLogs });
    }

    const paymentReq = await response.json();
    
    await db.update(http402Flows)
      .set({ response402: paymentReq })
      .where(eq(http402Flows.id, flowId));

    const logId = randomUUID();
    dbLogId = logId;
    await db.insert(auditLogs).values({
      id: logId,
      ownerAddress: normalizedOwnerAddress,
      agentName: agent.agentName,
      provider: paymentReq.provider,
      requestId: paymentReq.requestId,
      taskType: taskType,
      status: '402_PAYWALL',
      pricePaid: paymentReq.price,
    });

    // STEP 4: Gasless EIP-712 Signature Generation
    const providerRpc = new ethers.JsonRpcProvider(process.env.ZEROG_RPC_URL || 'http://127.0.0.1:8545');
    const agentSigner = new ethers.Wallet(agent.privateKey, providerRpc);
    
    const domain = {
      name: 'SpendGuard',
      version: '1',
      chainId: (await providerRpc.getNetwork()).chainId,
      verifyingContract: paymentReq.paymentContract
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

    // Use 18 decimals for native 0G token
    const amountInWei = ethers.parseUnits(paymentReq.price.toString(), 18);
    const agentIdBytes = ethers.encodeBytes32String(agent.agentName);
    const requestIdBytes = ethers.encodeBytes32String(paymentReq.requestId);

    const message = {
      agentId: agentIdBytes,
      requestId: requestIdBytes,
      provider: paymentReq.provider,
      amount: amountInWei,
      serviceHash: paymentReq.serviceHash
    };

    const signature = await agentSigner.signTypedData(domain, types, message);
    log(`Generated EIP-712 payment signature for ${paymentReq.price} 0G`);

    await db.update(auditLogs).set({ status: 'SIGNED_OFFCHAIN' }).where(eq(auditLogs.id, logId));

    // STEP 5: Retry with Off-Chain Proof
    const paymentProof = Buffer.from(JSON.stringify({
      agentId: agent.agentName,
      requestId: paymentReq.requestId,
      serviceHash: paymentReq.serviceHash,
      signature: signature
    })).toString('base64');

    response = await fetch(`${baseUrl}${targetApi}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Payment-Proof': paymentProof },
      body: JSON.stringify(requestBody)
    });

    const finalData = await response.json();
    
    if (response.ok) {
      await db.update(http402Flows)
        .set({ response200: finalData })
        .where(eq(http402Flows.id, flowId));

      await db.update(auditLogs)
        .set({ 
          status: 'COMPLETED', 
          contentHash: paymentReq.serviceHash 
        })
        .where(eq(auditLogs.id, logId));
    } else {
      await db.update(auditLogs).set({ status: 'DELIVERY_FAILED' }).where(eq(auditLogs.id, logId));
    }

    return NextResponse.json({
      success: true,
      logs: executionLogs,
      result: finalData.resource || finalData.result || finalData
    });

  } catch (error: any) {
    console.error("Agent execution failed:", error);
    let errorMessage = error.reason || error.message || 'Execution failed';
    let finalStatus = 'FAILED';

    if (error.data) {
      try {
        const spendGuardInterface = new ethers.Interface(SpendGuardABI.abi);
        const parsedError = spendGuardInterface.parseError(error.data);
        if (parsedError) {
          if (parsedError.name === 'BudgetExceeded') {
            finalStatus = 'BUDGET_EXCEEDED';
            const budgetLimit = Number(ethers.formatUnits(parsedError.args[1], 18));
            const totalSpent = Number(ethers.formatUnits(parsedError.args[2], 18));
            const attempted = Number(ethers.formatUnits(parsedError.args[3], 18));
            errorMessage = `SpendGuard Reverted: Budget Exceeded. Attempted: ${attempted.toFixed(4)} 0G, Remaining: ${(budgetLimit - totalSpent).toFixed(4)} 0G`;
          } else if (parsedError.name === 'RequestAlreadyProcessed') {
            finalStatus = 'REPLAY_BLOCKED';
            errorMessage = `SpendGuard Reverted: Replay Attack Prevented.`;
          }
        }
      } catch (e) {
        if (error.data.includes('1ff44dd9')) { finalStatus = 'BUDGET_EXCEEDED'; errorMessage = 'SpendGuard Reverted: Budget Exceeded.'; }
      }
    }

    if (dbLogId) {
      await db.update(auditLogs).set({ status: finalStatus }).where(eq(auditLogs.id, dbLogId));
    }

    return NextResponse.json({ error: errorMessage, logs: [`[ERROR] ${errorMessage}`] }, { status: 500 });
  }
}