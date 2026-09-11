import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { db } from '@/lib/db'; // Update to match your actual db path
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { agentName, ownerAddress } = body;
    if (!agentName || !ownerAddress) {
      return NextResponse.json({ error: 'Agent name and owner address are required' }, { status: 400 });
    }

    // Check if agent already exists for this owner
    const existing = await db
      .select()
      .from(agents)
      .where(eq(agents.ownerAddress, ownerAddress.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        agentAddress: existing[0].agentAddress,
        message: 'Agent already registered for this wallet',
      });
    }

    // Generate isolated keypair for the agent
    const agentWallet = ethers.Wallet.createRandom();

    // Sponsor gas (Fund agent execution wallet with ETH)
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const adminSigner = new ethers.Wallet(
      process.env.DEPLOYER_PRIVATE_KEY!,
      provider
    );

    const tx = await adminSigner.sendTransaction({
      to: agentWallet.address,
      value: ethers.parseEther('0.01'),
    });
    await tx.wait();

    // Save to database via Drizzle
    await db.insert(agents).values({
      agentName,
      agentAddress: agentWallet.address,
      privateKey: agentWallet.privateKey,
      ownerAddress: ownerAddress.toLowerCase(),
    });

    return NextResponse.json({
      success: true,
      agentAddress: agentWallet.address,
      message: 'Agent keypair generated, gas sponsored, and saved successfully',
    });
  } catch (error: any) {
    console.error('Agent registration error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}