'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Fuel, Loader2, PlusCircle, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import MockUSDCABI from '@/contracts/MockUSDC.json';
import Addresses from '@/contracts/addresses.json';

interface FundAgentPanelProps {
  agentAddress: string;
}

export default function FundAgentPanel({ agentAddress }: FundAgentPanelProps) {
  const [usdcAmount, setUsdcAmount] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [loadingUsdc, setLoadingUsdc] = useState(false);
  const [loadingEth, setLoadingEth] = useState(false);
  
  // State for balances
  const [vaultBalance, setVaultBalance] = useState<string>('0.00');
  const [agentEthBalance, setAgentEthBalance] = useState<string>('0.0000');
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
      mockUsdc: new ethers.Contract(Addresses.MockUSDC, MockUSDCABI.abi, signer),
    };
  }

  // Fetch balances on mount and after transactions
  const fetchBalances = async () => {
    try {
      setIsFetchingBalances(true);
      const { provider, signer, spendGuard } = await getContractsAndSigner();
      
      const userAddress = await signer.getAddress();

      // 1. Fetch User's isolated USDC vault balance from SpendGuard
      const usdcBalanceBigInt = await spendGuard.userBalances(userAddress);
      setVaultBalance(Number(ethers.formatUnits(usdcBalanceBigInt, 6)).toFixed(2));

      // 2. Fetch Agent's ETH Gas balance
      const ethBalanceBigInt = await provider.getBalance(agentAddress);
      setAgentEthBalance(Number(ethers.formatEther(ethBalanceBigInt)).toFixed(4));
      
    } catch (err) {
      console.error("Failed to fetch balances:", err);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [agentAddress]);

  const handleDepositUSDC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usdcAmount || isNaN(Number(usdcAmount)) || Number(usdcAmount) <= 0) {
      toast.error('Enter a valid USDC amount');
      return;
    }

    setLoadingUsdc(true);
    try {
      const { spendGuard, mockUsdc } = await getContractsAndSigner();
      const depositUnits = ethers.parseUnits(usdcAmount, 6);

      toast.info('Approving MockUSDC deposit...');
      const txApprove = await mockUsdc.approve(Addresses.SpendGuard, depositUnits);
      await txApprove.wait();

      toast.info('Depositing MockUSDC into contract vault...');
      const txDeposit = await spendGuard.deposit(depositUnits);
      await txDeposit.wait();

      toast.success(`Successfully deposited $${usdcAmount} USDC into your vault!`);
      setUsdcAmount('');
      fetchBalances(); // Refresh balances after success
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'USDC Deposit failed');
    } finally {
      setLoadingUsdc(false);
    }
  };

  const handleFundGas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ethAmount || isNaN(Number(ethAmount)) || Number(ethAmount) <= 0) {
      toast.error('Enter a valid ETH amount');
      return;
    }

    setLoadingEth(true);
    try {
      const { signer } = await getContractsAndSigner();
      
      toast.info(`Sending ${ethAmount} ETH to agent wallet...`);
      const tx = await signer.sendTransaction({
        to: agentAddress,
        value: ethers.parseEther(ethAmount),
      });
      await tx.wait();

      toast.success(`Successfully funded agent with ${ethAmount} ETH for gas!`);
      setEthAmount('');
      fetchBalances(); // Refresh balances after success
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'ETH Transfer failed');
    } finally {
      setLoadingEth(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <PlusCircle size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Fund & Top-Up</h3>
        </div>
        {isFetchingBalances && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>

      {/* USDC Vault Deposit */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Coins size={12} className="text-primary" />
            Vault Balance
          </span>
          <span className="font-mono text-foreground font-semibold">
            ${vaultBalance} USDC
          </span>
        </div>
        <form onSubmit={handleDepositUSDC} className="flex gap-2">
          <input
            type="text"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary transition-colors"
            placeholder="Amount (e.g. 50)"
          />
          <button type="submit" disabled={loadingUsdc} className="btn-primary px-3 py-1.5 rounded-lg text-xs whitespace-nowrap">
            {loadingUsdc ? <Loader2 size={14} className="animate-spin" /> : 'Deposit'}
          </button>
        </form>
      </div>

      {/* Agent Gas Funding */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Fuel size={12} className="text-warning" />
            Agent Gas 
          </span>
          <div className="text-right">
            <span className="font-mono text-foreground font-semibold block">
              {agentEthBalance} ETH
            </span>
            <span className="font-mono text-[9px] text-muted-foreground opacity-70 block" title={agentAddress}>
              ({agentAddress.slice(0, 6)}...{agentAddress.slice(-4)})
            </span>
          </div>
        </div>
        <form onSubmit={handleFundGas} className="flex gap-2">
          <input
            type="text"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-warning transition-colors"
            placeholder="Amount (e.g. 0.01)"
          />
          <button type="submit" disabled={loadingEth} className="bg-secondary text-foreground hover:bg-secondary/80 border border-border px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap transition-colors">
            {loadingEth ? <Loader2 size={14} className="animate-spin" /> : <><ArrowUpRight size={14} /> Send</>}
          </button>
        </form>
      </div>
    </div>
  );
}