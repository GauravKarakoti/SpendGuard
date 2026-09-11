import React from 'react';
import { Bot, Zap, Shield, Clock } from 'lucide-react';

export default function AgentStatusPanel() {
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
          <span className="font-mono text-foreground">ResearchAgent</span>
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
          <span className="font-mono text-foreground">10:46:55 UTC</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Agent cannot modify its own budget, transfer USDC directly, or bypass the payment contract.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center px-2 py-1.5 rounded-lg bg-muted">
          <p className="text-base font-bold text-foreground tabular-nums">4</p>
          <p className="text-xs text-muted-foreground">Authorized</p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-lg bg-red-950 border border-red-900">
          <p className="text-base font-bold text-accent tabular-nums">3</p>
          <p className="text-xs text-muted-foreground">Blocked</p>
        </div>
        <div className="text-center px-2 py-1.5 rounded-lg bg-purple-950 border border-purple-900">
          <p className="text-base font-bold text-purple-400 tabular-nums">2</p>
          <p className="text-xs text-muted-foreground">Replay</p>
        </div>
      </div>
    </div>
  );
}