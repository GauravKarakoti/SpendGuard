'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Zap, Shield, Clock } from 'lucide-react';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

export default function AgentStatusPanel({ agentName }: { agentName: string }) {
  const agentId = ethers.encodeBytes32String(agentName);
  const [status, setStatus] = useState({
    budgetLimit: 0,
    authorized: 0,
    blocked: 0,
    replay: 0,
    lastAction: '—'
  });

  useEffect(() => {
    async function fetchAgentStatus() {
      try {
        let currentLimit = 0;
        const win = window as any;
        if (typeof window !== 'undefined' && win.ethereum) {
          const provider = new ethers.BrowserProvider(win.ethereum);
          const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);
          const [limit] = await contract.getBudget(agentId);
          currentLimit = Number(ethers.formatUnits(limit, 18)); // Switched to 18 decimals
        }

        const res = await fetch('/api/logs/audit');
        const data = await res.json();

        let authCount = 0, blockedCount = 0, replayCount = 0;
        let lastActionTime = '—';

        if (data && data.length > 0) {
          lastActionTime = new Date(data[0].createdAt).toISOString().split('T')[1].slice(0, 8) + ' UTC';
        }

        data.forEach((log: any) => {
          if (log.status === 'COMPLETED' || log.status === 'SIGNED_OFFCHAIN' || log.status === 'PAID') authCount++;
          else if (log.status === 'BUDGET_EXCEEDED' || log.status === '402_PAYWALL') blockedCount++;
          else if (log.status === 'REPLAY_BLOCKED') replayCount++;
        });

        setStatus({
          budgetLimit: currentLimit,
          authorized: authCount,
          blocked: blockedCount,
          replay: replayCount,
          lastAction: lastActionTime
        });

      } catch (err) {
        console.error("Failed to fetch agent status", err);
      }
    }

    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Agent Status</h3>
        </div>
        <span className="status-badge-authorized">● ACTIVE</span>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><Bot size={12} />Agent ID</span>
          <span className="font-mono text-foreground">{agentName}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><Shield size={12} />Budget Control</span>
          <span className="text-primary font-semibold">SpendGuard.sol</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><Zap size={12} />Wallet Access</span>
          <span className="text-accent font-semibold">RESTRICTED</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5"><Clock size={12} />Last Action</span>
          <span className="font-mono text-foreground">{status.lastAction}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Agent utilizes EIP-712 signatures. It cannot modify its own budget, execute transactions, or pay gas.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center px-2 py-1.5 rounded-lg bg-muted">
          <p className="text-base font-bold text-foreground tabular-nums">{status.authorized}</p>
          <p className="text-xs text-muted-foreground">Authorized</p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-lg bg-red-950 border border-red-900">
          <p className="text-base font-bold text-accent tabular-nums">{status.blocked}</p>
          <p className="text-xs text-muted-foreground">Blocked</p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-lg bg-purple-950 border border-purple-900">
          <p className="text-base font-bold text-purple-400 tabular-nums">{status.replay}</p>
          <p className="text-xs text-muted-foreground">Replay</p>
        </div>
      </div>
    </div>
  );
}