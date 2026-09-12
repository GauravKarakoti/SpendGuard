import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { agents, auditLogs, http402Flows, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  // 1. Declare dbLogId OUTSIDE the try block so both try and catch can access it
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

    // Fetch the currently selected providers from the DB
    const activeProviders = await db
      .select()
      .from(providers)
      .where(eq(providers.selected, true));

    if (command.includes('translate')) {
      const provider = activeProviders.find(p => p.id === 'prov_trans_primary');
      if (!provider) return NextResponse.json({ error: 'No translation provider configured.' }, { status: 400 });
      
      // Simulated LLM Parameter Extraction
      let textToTranslate = prompt.replace(/translate/i, '').trim();
      let targetLang = 'es'; // default
      
      // Extract target language if user said "to [Language]"
      const langMatch = prompt.match(/to\s+([a-zA-Z]+)/i);
      if (langMatch) {
        const langStr = langMatch[1].toLowerCase();
        const langMap: Record<string, string> = { hindi: 'hi', spanish: 'es', french: 'fr', german: 'de', japanese: 'ja', english: 'en' };
        targetLang = langMap[langStr] || 'es';
        
        // Remove the "to Hindi" part from the text being translated
        textToTranslate = textToTranslate.replace(new RegExp(`to\\s+${langStr}`, 'i'), '').trim();
      }

      targetApi = '/api/translate';
      taskType = 'Translation';
      requestBody = { text: textToTranslate, targetLang, providerId: provider.id };
      
      log(`Intent recognized: Routing to ${provider.name} at $${provider.price}`);
      log(`Agent extracted params -> Text: "${textToTranslate}", Target: "${targetLang}"`);
      
    } else if (command.includes('compute') || command.includes('matrix') || command.includes('run')) {
      const provider = activeProviders.find(p => p.id === 'prov_comp_primary');
      if (!provider) return NextResponse.json({ error: 'No compute provider configured.' }, { status: 400 });

      targetApi = '/api/compute';
      taskType = 'Compute';
      // Pass the raw prompt so the compute engine can extract the numbers
      requestBody = { jobType: 'matrix_multiply', payload: prompt, providerId: provider.id };
      
      log(`Intent recognized: Routing to ${provider.name} at $${provider.price}`);
      log(`Agent passing mathematical payload to compute engine...`);
      
    } else {
      return NextResponse.json({ error: "Unknown command. Try 'Translate Hello World'." }, { status: 400 });
    }

    // ---> DB ACTION 1 (HTTP FLOW): Log the outgoing request payload WITH ownerAddress
    const flowId = randomUUID();
    await db.insert(http402Flows).values({
      id: flowId,
      ownerAddress: normalizedOwnerAddress, // <--- ADDED ISOLATION HERE
      label: `Agent Task: ${taskType}`,
      method: 'POST',
      endpoint: targetApi,
      requestPayload: requestBody,
    });

    // STEP 3: Attempt the external API call
    let response = await fetch(`${baseUrl}${targetApi}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (response.status !== 402) {
      return NextResponse.json({ error: 'Expected 402 Paywall', logs: executionLogs });
    }

    const paymentReq = await response.json();
    
    // ---> DB ACTION 2 (HTTP FLOW): Record the 402 rejection payload
    await db.update(http402Flows)
      .set({ response402: paymentReq })
      .where(eq(http402Flows.id, flowId));

    // DB ACTION (AUDIT LOG): Create the business audit record
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

    // STEP 4: Smart Contract Execution
    const providerRpc = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const agentSigner = new ethers.Wallet(agent.privateKey, providerRpc);
    const spendGuard = new ethers.Contract(paymentReq.paymentContract, SpendGuardABI.abi, agentSigner);
    
    const tx = await spendGuard.pay(
      ethers.encodeBytes32String(agent.agentName),
      ethers.encodeBytes32String(paymentReq.requestId),
      ethers.Wallet.createRandom().address, 
      ethers.parseUnits(paymentReq.price, 6),
      paymentReq.serviceHash
    );
    const receipt = await tx.wait();

    await db.update(auditLogs).set({ status: 'PAID', txHash: receipt.hash }).where(eq(auditLogs.id, logId));

    // STEP 5: Retry with Proof
    const paymentProof = Buffer.from(JSON.stringify({
      agentId: agent.agentName,
      requestId: paymentReq.requestId,
      serviceHash: paymentReq.serviceHash,
      txHash: receipt.hash
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

      // FIX: Store the exact serviceHash that was anchored on-chain, 
      // instead of relying on the mock provider's HTTP headers!
      await db.update(auditLogs)
        .set({ 
          status: 'COMPLETED', 
          contentHash: paymentReq.serviceHash // <--- Changed this line
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
    let finalStatus = 'FAILED'; // Default failure

    if (error.data) {
      try {
        const spendGuardInterface = new ethers.Interface(SpendGuardABI.abi);
        const parsedError = spendGuardInterface.parseError(error.data);
        if (parsedError) {
          if (parsedError.name === 'BudgetExceeded') {
            finalStatus = 'BUDGET_EXCEEDED';
            const budgetLimit = Number(ethers.formatUnits(parsedError.args[1], 6));
            const totalSpent = Number(ethers.formatUnits(parsedError.args[2], 6));
            const attempted = Number(ethers.formatUnits(parsedError.args[3], 6));
            errorMessage = `SpendGuard Reverted: Budget Exceeded. Attempted: $${attempted.toFixed(2)}, Remaining: $${(budgetLimit - totalSpent).toFixed(2)}`;
          } else if (parsedError.name === 'RequestAlreadyProcessed') {
            finalStatus = 'REPLAY_BLOCKED';
            errorMessage = `SpendGuard Reverted: Replay Attack Prevented.`;
          }
        }
      } catch (e) {
        if (error.data.includes('1ff44dd9')) { finalStatus = 'BUDGET_EXCEEDED'; errorMessage = 'SpendGuard Reverted: Budget Exceeded.'; }
      }
    }

    // ---> DB ACTION: Update the database with the exact security block reason!
    if (dbLogId) {
      await db.update(auditLogs).set({ status: finalStatus }).where(eq(auditLogs.id, dbLogId));
    }

    return NextResponse.json({ error: errorMessage, logs: [`[ERROR] ${errorMessage}`] }, { status: 500 });
  }
}