import React from 'react';
import { Shield } from 'lucide-react';

export default function TaglineBar() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-green-900 bg-green-950 bg-opacity-40">
      <Shield size={18} className="text-primary flex-shrink-0" />
      <p className="text-sm font-semibold text-green-300 tracking-wide">
        &ldquo;The agent can ask. The contract decides.&rdquo;
      </p>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Enforcement layer:</span>
        <span className="text-xs font-mono font-semibold text-primary">SpendGuard.sol</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">NOT the agent</span>
      </div>
    </div>
  );
}