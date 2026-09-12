import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { agents, auditLogs, http402Flows, providers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
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
      
      targetApi = '/api/translate';
      taskType = 'Translation';
      requestBody = { text: prompt, targetLang: 'es', providerId: provider.id };
      log(`Intent recognized: Routing to ${provider.name} at $${provider.price}`);
      
    } else if (command.includes('compute') || command.includes('matrix') || command.includes('run')) {
      const provider = activeProviders.find(p => p.id === 'prov_comp_primary');
      if (!provider) return NextResponse.json({ error: 'No compute provider configured.' }, { status: 400 });

      targetApi = '/api/compute';
      taskType = 'Compute';
      requestBody = { jobType: 'matrix_multiply', providerId: provider.id };
      log(`Intent recognized: Routing to ${provider.name} at $${provider.price}`);
      
    } else {
      return NextResponse.json({ error: "Unknown command. Try 'Translate Hello World'." }, { status: 400 });
    }

    // ---> DB ACTION 1 (HTTP FLOW): Log the outgoing request payload
    const flowId = randomUUID();
    await db.insert(http402Flows).values({
      id: flowId,
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
      // ---> DB ACTION 3 (HTTP FLOW): Record the final 200 OK delivery payload
      await db.update(http402Flows)
        .set({ response200: finalData })
        .where(eq(http402Flows.id, flowId));

      await db.update(auditLogs)
        .set({ status: 'COMPLETED', contentHash: response.headers.get('x-content-hash') || 'NoHashProvided' })
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

    // Decode Solidity Custom Errors
    if (error.data) {
      try {
        const spendGuardInterface = new ethers.Interface(SpendGuardABI.abi);
        const parsedError = spendGuardInterface.parseError(error.data);
        
        if (parsedError) {
          if (parsedError.name === 'BudgetExceeded') {
            // args[0] is agentId
            // args[1] is budgetLimit (e.g., 10.00)
            // args[2] is totalSpent (e.g., 10.00)
            // args[3] is attemptedAmount (e.g., 3.00)
            const budgetLimit = Number(ethers.formatUnits(parsedError.args[1], 6));
            const totalSpent = Number(ethers.formatUnits(parsedError.args[2], 6));
            const attempted = Number(ethers.formatUnits(parsedError.args[3], 6));
            const remaining = budgetLimit - totalSpent;
            
            errorMessage = `SpendGuard Reverted: Budget Exceeded. Attempted: $${attempted.toFixed(2)}, Remaining: $${remaining.toFixed(2)}`;
          } else if (parsedError.name === 'RequestAlreadyProcessed') {
            errorMessage = `SpendGuard Reverted: Replay Attack Prevented (Request ID already paid).`;
          } else {
            errorMessage = `SpendGuard Reverted: ${parsedError.name}`;
          }
        }
      } catch (parseErr) {
        if (error.data.includes('1ff44dd9')) {
          errorMessage = 'SpendGuard Reverted: Budget Exceeded.';
        }
      }
    }

    // Since the API failed, we must pass the error message inside the `logs` array 
    // so the frontend terminal knows how to display it!
    return NextResponse.json({ 
      error: errorMessage,
      logs: [`[ERROR] ${errorMessage}`] 
    }, { status: 500 });
  }
}