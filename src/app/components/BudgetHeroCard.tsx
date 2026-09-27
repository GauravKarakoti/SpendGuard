'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp, Lock, AlertTriangle, Settings2, X, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

const BudgetRadialChart = dynamic(() => import('./BudgetRadialChart'), { ssr: false });

// Dynamic formatter: shows 2 decimals for round numbers, up to 6 for micro-transactions
const format0G = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(val);
};

export default function BudgetHeroCard({ agentName }: { agentName: string }) {
  const AGENT_ID = ethers.encodeBytes32String(agentName);
  const [budgetData, setBudgetData] = useState({ limit: 0, spent: 0, remaining: 0 });
  const [vaultBalance, setVaultBalance] = useState<number>(0);
  const [lastBlock, setLastBlock] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  
  // Update Budget State
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [newLimitInput, setNewLimitInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBudget = async () => {
    const win = window as any;
    if (typeof window === 'undefined' || !win.ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(win.ethereum);
      const code = await provider.getCode(Addresses.SpendGuard);
      if (code === '0x') {
        setLoading(false);
        return;
      }

      const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);
      const [limit, spent, active] = await contract.getBudget(AGENT_ID);
      
      const formattedLimit = Number(ethers.formatEther(limit));
      const formattedSpent = Number(ethers.formatEther(spent));

      setBudgetData({
        limit: formattedLimit,
        spent: formattedSpent,
        remaining: formattedLimit - formattedSpent
      });

      // Fetch user's actual deposited vault balance to compare against the limit
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        const vBalance = await contract.userBalances(accounts[0].address);
        setVaultBalance(Number(ethers.formatEther(vBalance)));
      }
      
      const blockNum = await provider.getBlockNumber();
      setLastBlock(blockNum);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch budget:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
    const interval = setInterval(fetchBudget, 10000);
    return () => clearInterval(interval);
  }, [AGENT_ID]);

  const handleUpdateLimit = async () => {
    if (!newLimitInput || isNaN(Number(newLimitInput))) {
      toast.error('Enter a valid 0G amount');
      return;
    }

    const newLimitNum = Number(newLimitInput);
    if (newLimitNum < budgetData.spent) {
      toast.error(`New limit must be at least the already spent amount (${format0G(budgetData.spent)} 0G)`);
      return;
    }

    setIsUpdating(true);
    try {
      const win = window as any;
      const provider = new ethers.BrowserProvider(win.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, signer);

      const limitUnits = ethers.parseEther(newLimitInput);
      
      toast.info('Updating budget limit on-chain...');
      const tx = await contract.updateBudgetLimit(AGENT_ID, limitUnits);
      await tx.wait();

      toast.success(`Budget successfully increased to ${newLimitInput} 0G`);
      setShowUpdateForm(false);
      setNewLimitInput('');
      fetchBudget(); // Instantly refresh UI
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'Failed to update budget');
    } finally {
      setIsUpdating(false);
    }
  };

  const utilizationPct = budgetData.limit > 0 ? Math.round((budgetData.spent / budgetData.limit) * 100) : 0;
  const isNearLimit = utilizationPct >= 80;
  
  const parsedNewLimit = Number(newLimitInput);
  const showsVaultWarning = !isNaN(parsedNewLimit) && parsedNewLimit > vaultBalance;

  if (loading) return <div className="glass-card rounded-xl p-5 h-full animate-pulse bg-muted" />;

  return (
    <div className={`glass-card rounded-xl p-5 h-full flex flex-col gap-4 ${isNearLimit ? 'border-amber-800 glow-amber' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={14} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              On-Chain Budget
            </p>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            Agent: {agentName} · {Addresses.SpendGuard.slice(0, 18)}...
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isNearLimit && !showUpdateForm && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950 border border-amber-800">
              <AlertTriangle size={12} className="text-warning" />
              <span className="text-xs font-semibold text-warning">Near Limit</span>
            </div>
          )}
          <button 
            onClick={() => {
              setShowUpdateForm(!showUpdateForm);
              setNewLimitInput(budgetData.limit.toString());
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"
            title="Update Budget Limit"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {showUpdateForm && (
        <div className="bg-muted border border-border rounded-lg p-3 flex flex-col gap-2 animate-fade-in">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                New Total Limit (0G)
              </label>
              <input
                type="text"
                value={newLimitInput}
                onChange={(e) => setNewLimitInput(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-primary"
                placeholder={`Current: ${budgetData.limit}`}
              />
            </div>
            <button 
              onClick={handleUpdateLimit} 
              disabled={isUpdating}
              className="btn-primary px-4 py-1.5 rounded-md text-xs h-[34px] flex items-center justify-center min-w-[70px]"
            >
              {isUpdating ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
            </button>
            <button 
              onClick={() => setShowUpdateForm(false)}
              className="h-[34px] px-2 text-muted-foreground hover:text-foreground flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
          {showsVaultWarning && (
            <p className="text-[11px] text-amber-500/90 bg-amber-950/30 px-2.5 py-2 rounded border border-amber-900/50 mt-1 leading-relaxed">
              ⚠️ <strong>Notice:</strong> Your actual vault balance is <strong>{format0G(vaultBalance)} 0G</strong>. You will need to deposit more funds for the agent to fully utilize this new limit.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-6 mt-1">
        <div className="flex-shrink-0">
          <BudgetRadialChart spent={budgetData.spent} limit={budgetData.limit} />
        </div>
        <div className="flex flex-col gap-4 flex-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {format0G(budgetData.limit)}
              </p>
              <p className="text-xs text-muted-foreground">0G limit</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spent</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {format0G(budgetData.spent)}
              </p>
              <p className="text-xs text-muted-foreground">authorized</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remaining</p>
              <p className={`text-2xl font-bold tabular-nums ${isNearLimit ? 'text-warning' : 'text-primary'}`}>
                {format0G(budgetData.remaining)}
              </p>
              <p className="text-xs text-muted-foreground">available</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{utilizationPct}% utilized</span>
              <span className="font-mono">{format0G(budgetData.spent)} / {format0G(budgetData.limit)} 0G</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  utilizationPct >= 80 ? 'bg-warning' : 'bg-primary'
                }`}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp size={12} className="text-primary" />
            <span>Latest 0G Block:</span>
            <span className="font-mono text-foreground">#{lastBlock.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <p className="text-xs text-muted-foreground">
            Enforcement: <span className="text-primary font-semibold">SpendGuard.sol · claimPayment()</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          require(spent + amount &lt;= limit)
        </p>
      </div>
    </div>
  );
}