'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp, Lock, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

const BudgetRadialChart = dynamic(() => import('./BudgetRadialChart'), { ssr: false });

export default function BudgetHeroCard({ agentName }: { agentName: string }) {
  const AGENT_ID = ethers.encodeBytes32String(agentName);
  const [budgetData, setBudgetData] = useState({ limit: 0, spent: 0, remaining: 0 });
  const [lastBlock, setLastBlock] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBudget() {
      const win = window as any;
      if (typeof window === 'undefined' || !win.ethereum) return;

      try {
        const provider = new ethers.BrowserProvider(win.ethereum);
        
        // 1. Check if the contract exists at this address on the current network
        const code = await provider.getCode(Addresses.SpendGuard);
        if (code === '0x') {
          console.warn("No contract found at SpendGuard address on the current network. Check your wallet connection.");
          setLoading(false);
          return;
        }

        const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

        const [limit, spent, active] = await contract.getBudget(AGENT_ID);
        
        // Format from 6 decimal USDC
        const formattedLimit = Number(ethers.formatUnits(limit, 6));
        const formattedSpent = Number(ethers.formatUnits(spent, 6));

        setBudgetData({
          limit: formattedLimit,
          spent: formattedSpent,
          remaining: formattedLimit - formattedSpent
        });
        
        const blockNum = await provider.getBlockNumber();
        setLastBlock(blockNum);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch budget:", err);
        setLoading(false);
      }
    }

    fetchBudget();
    
    const interval = setInterval(fetchBudget, 10000);
    return () => clearInterval(interval);
  }, []);

  const utilizationPct = budgetData.limit > 0 ? Math.round((budgetData.spent / budgetData.limit) * 100) : 0;
  const isNearLimit = utilizationPct >= 80;

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
        {isNearLimit && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950 border border-amber-800">
            <AlertTriangle size={12} className="text-warning" />
            <span className="text-xs font-semibold text-warning">Near Limit</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <BudgetRadialChart spent={budgetData.spent} limit={budgetData.limit} />
        </div>
        <div className="flex flex-col gap-4 flex-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${budgetData.limit.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">USDC limit</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spent</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${budgetData.spent.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">authorized</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remaining</p>
              <p className={`text-2xl font-bold tabular-nums ${isNearLimit ? 'text-warning' : 'text-primary'}`}>
                ${budgetData.remaining.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">available</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{utilizationPct}% utilized</span>
              <span className="font-mono">${budgetData.spent} / ${budgetData.limit}</span>
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
            <span>Last tx block:</span>
            <span className="font-mono text-foreground">#{lastBlock.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <p className="text-xs text-muted-foreground">
            Enforcement: <span className="text-primary font-semibold">SpendGuard.sol · pay()</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          require(spent + amount &lt;= limit)
        </p>
      </div>
    </div>
  );
}