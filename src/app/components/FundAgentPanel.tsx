'use client';

import React, { useState, useEffect } from 'react';
import { Coins, ShieldCheck, Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

interface FundAgentPanelProps {
  agentAddress: string;
}

const format0G = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(val);
};

export default function FundAgentPanel({ agentAddress }: FundAgentPanelProps) {
  const [Amount, setAmount] = useState('');
  const [loading0G, setLoading0G] = useState(false);
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [isFetchingBalances, setIsFetchingBalances] = useState(true);

  async function getContractsAndSigner() {
    const win = window as any;
    if (!win.ethereum) throw new Error("Wallet not connected");
    const provider = new ethers.BrowserProvider(win.ethereum);
    const signer = await provider.getSigner();
    
    return {
      provider,
      signer,
      spendGuard: new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, signer),
    };
  }

  const fetchBalances = async () => {
    try {
      setIsFetchingBalances(true);
      const { signer, spendGuard } = await getContractsAndSigner();
      const userAddress = await signer.getAddress();

      const vaultBalanceBigInt = await spendGuard.userBalances(userAddress);
      setVaultBalance(Number(ethers.formatEther(vaultBalanceBigInt)));
      
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [agentAddress]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Amount || isNaN(Number(Amount)) || Number(Amount) <= 0) {
      toast.error('Enter a valid native token amount');
      return;
    }

    setLoading0G(true);
    try {
      const { spendGuard } = await getContractsAndSigner();
      const depositUnits = ethers.parseEther(Amount);

      toast.info('Depositing native 0G into SpendGuard vault...');
      const txDeposit = await spendGuard.deposit({ value: depositUnits });
      await txDeposit.wait();

      toast.success(`Successfully deposited ${Amount} 0G into your vault!`);
      setAmount('');
      fetchBalances(); 
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'Deposit failed');
    } finally {
      setLoading0G(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <PlusCircle size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Fund Vault</h3>
        </div>
        {isFetchingBalances && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Coins size={12} className="text-primary" />
            Vault Balance
          </span>
          <span className="font-mono text-foreground font-semibold">
            {format0G(vaultBalance)} 0G
          </span>
        </div>
        <form onSubmit={handleDeposit} className="flex gap-2">
          <input
            type="text"
            value={Amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary transition-colors"
            placeholder="Amount (e.g. 0.005)"
          />
          <button type="submit" disabled={loading0G} className="btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
            {loading0G ? <Loader2 size={14} className="animate-spin" /> : 'Deposit'}
          </button>
        </form>
      </div>

      <div className="mt-1 p-3 rounded-lg border border-border bg-muted/50 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ShieldCheck size={14} className="text-primary" />
          Gasless Agent Architecture
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The agent authorizes payments using EIP-712 off-chain signatures. It does not require native 0G gas to operate.
        </p>
      </div>
    </div>
  );
}