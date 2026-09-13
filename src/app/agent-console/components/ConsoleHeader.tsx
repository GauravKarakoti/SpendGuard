import React from 'react';
import { Terminal, Bot, Shield, Wifi } from 'lucide-react';

export default function ConsoleHeader({ agentName }: { agentName: string }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-muted border border-border">
          <Terminal size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Agent Console</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time AI agent reasoning, HTTP 402 flows, and contract enforcement log
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs">
          <Bot size={13} className="text-primary" />
          <span className="text-foreground font-medium">{agentName}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs">
          <Shield size={13} className="text-primary" />
          <span className="text-foreground font-medium">SpendGuard Active</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs">
          <Wifi size={13} className="text-info" />
          <span className="text-foreground font-mono">0G Testnet</span>
        </div>
      </div>
    </div>
  );
}