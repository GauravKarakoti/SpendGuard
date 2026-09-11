'use client';

import React, { useState } from 'react';
import { Bot, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import MockUSDCABI from '@/contracts/MockUSDC.json';
import Addresses from '@/contracts/addresses.json';

interface Props {
  userAddress: string;
  onRegistered: () => void;
}

export default function UserAgentRegistration({ userAddress, onRegistered }: Props) {
  const [loading, setLoading] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [depositAmount, setDepositAmount] = useState('50.00');
  const [budgetLimit, setBudgetLimit] = useState('10.00');

  async function getContracts() {
    const win = window as any;
    if (!win.ethereum) throw new Error("Wallet not connected");
    const provider = new ethers.BrowserProvider(win.ethereum);
    const signer = await provider.getSigner();
    
    return {
      spendGuard: new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, signer),
      mockUsdc: new ethers.Contract(Addresses.MockUSDC, MockUSDCABI.abi, signer),
    };
  }

  const handleFullSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName) {
      toast.error('Please enter an agent name');
      return;
    }

    setLoading(true);
    try {
      toast.info('Generating autonomous agent keypair & sponsoring gas...');
      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, ownerAddress: userAddress }),
      });

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text || res.statusText}`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to register agent backend');

      const agentAddress = data.agentAddress;
      toast.success(`Agent wallet created: ${agentAddress.slice(0, 6)}... (Gas sponsored!)`);

      const { spendGuard, mockUsdc } = await getContracts();
      const agentIdBytes = ethers.encodeBytes32String(agentName);
      const limitUnits = ethers.parseUnits(budgetLimit, 6);
      const depositUnits = ethers.parseUnits(depositAmount, 6);

      toast.info('Registering agent on-chain...');
      const txReg = await spendGuard.registerAgent(agentIdBytes, agentAddress);
      await txReg.wait();

      toast.info('Setting on-chain spending limit...');
      const txBudget = await spendGuard.createBudget(agentIdBytes, limitUnits);
      await txBudget.wait();

      toast.info('Approving MockUSDC deposit...');
      const txApprove = await mockUsdc.approve(Addresses.SpendGuard, depositUnits);
      await txApprove.wait();

      toast.info('Depositing MockUSDC into contract vault...');
      const txDeposit = await spendGuard.deposit(depositUnits);
      await txDeposit.wait();

      toast.success(`Setup complete! Agent "${agentName}" is active.`);
      onRegistered();
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 flex flex-col gap-4 border border-border max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Bot size={20} className="text-primary" />
        <h3 className="text-base font-semibold text-foreground">Autonomous Agent Provisioning</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Configure your agent for wallet <span className="font-mono text-foreground">{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>. We will automatically generate its execution wallet, sponsor gas, and lock in your budget.
      </p>

      <form onSubmit={handleFullSetup} className="space-y-4 pt-2 border-t border-border">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Agent Name / Identifier
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none"
            placeholder="e.g. MyTradingAgent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Agent Spending Limit (USDC)
          </label>
          <input
            type="text"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none"
            placeholder="10.00"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Fund Contract Vault (MockUSDC Deposit)
          </label>
          <input
            type="text"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none"
            placeholder="50.00"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2 py-2.5">
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Provisioning & Sponsoring Gas...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              Initialize Autonomous Agent
            </>
          )}
        </button>
      </form>
    </div>
  );
}