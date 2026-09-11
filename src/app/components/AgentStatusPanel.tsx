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
      const win = window as any;
      if (typeof window === 'undefined' || !win.ethereum) return;
      
      try {
        const provider = new ethers.BrowserProvider(win.ethereum);

        // Guard: Check if contract exists on the current network
        const code = await provider.getCode(Addresses.SpendGuard);
        if (code === '0x') {
          console.warn("SpendGuard contract not found on the current network.");
          return;
        }

        const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

        const [authorizedLogs, rejectedLogs] = await Promise.all([
          contract.queryFilter(contract.filters.PaymentAuthorized()),
          contract.queryFilter(contract.filters.PaymentRejected())
        ]);

        let replayCount = 0;
        rejectedLogs.forEach((log: any) => {
          if (log.args[3] === 'RequestAlreadyProcessed') replayCount++;
        });

        const [limit] = await contract.getBudget(agentId);

        let lastActionTime = '—';
        const allLogs = [...authorizedLogs, ...rejectedLogs].sort((a, b) => b.blockNumber - a.blockNumber);
        
        if (allLogs.length > 0) {
          const latestBlock = await provider.getBlock(allLogs[0].blockNumber);
          if (latestBlock) {
            lastActionTime = new Date(latestBlock.timestamp * 1000).toISOString().split('T')[1].slice(0, 8) + ' UTC';
          }
        }

        setStatus({
          budgetLimit: Number(ethers.formatUnits(limit, 6)),
          authorized: authorizedLogs.length,
          blocked: rejectedLogs.length - replayCount,
          replay: replayCount,
          lastAction: lastActionTime
        });
      } catch (err) {
        console.error("Failed to fetch agent status", err);
      }
    }

    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 15000);
    return () => clearInterval(interval);
  }, []);

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
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Bot size={12} />
            Agent ID
          </span>
          <span className="font-mono text-foreground">{agentName}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Shield size={12} />
            Budget Control
          </span>
          <span className="text-primary font-semibold">SpendGuard.sol</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Zap size={12} />
            Wallet Access
          </span>
          <span className="text-accent font-semibold">RESTRICTED</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock size={12} />
            Last Action
          </span>
          <span className="font-mono text-foreground">{status.lastAction}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Agent cannot modify its own budget, transfer USDC directly, or bypass the payment contract.
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