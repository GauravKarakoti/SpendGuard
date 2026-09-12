'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldX, RefreshCw, Hash } from 'lucide-react';

export default function AuditSummaryBar({ ownerAddress }: { ownerAddress: string }) {
  const [metrics, setMetrics] = useState({
    authorized: 0,
    blocked: 0,
    replay: 0,
    hashes: 0,
  });

  useEffect(() => {
    async function loadSummary() {
      if (!ownerAddress) return;
      try {
        const res = await fetch(`/api/logs/audit?owner=${ownerAddress.toLowerCase()}`);
        const data = await res.json();

        let authCount = 0, blockedCount = 0, replayCount = 0, hashCount = 0;

        data.forEach((log: any) => {
          if (log.status === 'COMPLETED' || log.status === 'PAID') {
            authCount++;
            if (log.contentHash && log.contentHash !== 'NoHashProvided') hashCount++;
          } else if (log.status === 'BUDGET_EXCEEDED' || log.status === '402_PAYWALL') {
            blockedCount++;
          } else if (log.status === 'REPLAY_BLOCKED') {
            replayCount++;
          }
        });

        setMetrics({
          authorized: authCount,
          blocked: blockedCount,
          replay: replayCount,
          hashes: hashCount,
        });
      } catch (err) {
        console.error("Failed to load audit summary", err);
      }
    }

    loadSummary();
    const interval = setInterval(loadSummary, 5000);
    return () => clearInterval(interval);
  }, [ownerAddress]);

  const SUMMARY = [
    { key: 'sum-authorized', label: 'Authorized', value: metrics.authorized.toString(), icon: CheckCircle2, color: 'text-primary', bg: 'bg-green-950', border: 'border-green-900' },
    { key: 'sum-blocked', label: '402 Blocked', value: metrics.blocked.toString(), icon: ShieldX, color: 'text-accent', bg: 'bg-red-950', border: 'border-red-900' },
    { key: 'sum-replay', label: 'Replay Blocked', value: metrics.replay.toString(), icon: RefreshCw, color: 'text-purple-400', bg: 'bg-purple-950', border: 'border-purple-900' },
    { key: 'sum-hashes', label: 'Hashes Verified', value: `${metrics.hashes}/${metrics.authorized}`, icon: Hash, color: 'text-info', bg: 'bg-blue-950', border: 'border-blue-900' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SUMMARY.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.key} className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 border ${s.border}`}>
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <Icon size={15} className={s.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}