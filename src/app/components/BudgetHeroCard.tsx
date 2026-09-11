'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp, Lock, AlertTriangle } from 'lucide-react';

const BudgetRadialChart = dynamic(() => import('./BudgetRadialChart'), { ssr: false });

// BACKEND INTEGRATION: Replace mock data with contract call: spendGuard.getBudget(agentId)
const BUDGET_DATA = {
  limit: 5.0,
  spent: 4.0,
  remaining: 1.0,
  agentId: '0x526573656172636841...', // ResearchAgent
  contractAddress: '0x4f3e9a2b8d1c6e7f3a9b2c8d1e6f7a3b8c2a',
  lastTx: '0xabc1234...def5678',
  lastBlock: 7842389,
};

export default function BudgetHeroCard() {
  const utilizationPct = Math.round((BUDGET_DATA?.spent / BUDGET_DATA?.limit) * 100);
  const isNearLimit = utilizationPct >= 80;

  return (
    <div className={`glass-card rounded-xl p-5 h-full flex flex-col gap-4 ${isNearLimit ? 'border-amber-800 glow-amber' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={14} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              On-Chain Budget
            </p>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            Agent: ResearchAgent · {BUDGET_DATA?.contractAddress?.slice(0, 18)}...
          </p>
        </div>
        {isNearLimit && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950 border border-amber-800">
            <AlertTriangle size={12} className="text-warning" />
            <span className="text-xs font-semibold text-warning">Near Limit</span>
          </div>
        )}
      </div>

      {/* Chart + Numbers */}
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <BudgetRadialChart spent={BUDGET_DATA?.spent} limit={BUDGET_DATA?.limit} />
        </div>
        <div className="flex flex-col gap-4 flex-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${BUDGET_DATA?.limit?.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">USDC limit</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spent</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                ${BUDGET_DATA?.spent?.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">authorized</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remaining</p>
              <p className={`text-2xl font-bold tabular-nums ${isNearLimit ? 'text-warning' : 'text-primary'}`}>
                ${BUDGET_DATA?.remaining?.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">available</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{utilizationPct}% utilized</span>
              <span className="font-mono">${BUDGET_DATA?.spent} / ${BUDGET_DATA?.limit}</span>
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

          {/* Last TX */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp size={12} className="text-primary" />
            <span>Last tx:</span>
            <span className="font-mono text-foreground">{BUDGET_DATA?.lastTx}</span>
            <span>· Block #{BUDGET_DATA?.lastBlock?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Enforcement proof */}
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