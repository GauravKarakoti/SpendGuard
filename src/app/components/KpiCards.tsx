'use client';
import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldX, BadgeCheck, RefreshCw } from 'lucide-react';

// FIX: Add ownerAddress prop
export default function KpiCards({ ownerAddress }: { ownerAddress: string }) {
  const [metrics, setMetrics] = useState({
    authorizedCount: 0, authorizedAmount: 0, blockedCount: 0, blockedAmount: 0, replayCount: 0, deliveries: 0,
  });

  useEffect(() => {
    async function loadKpis() {
      if (!ownerAddress) return; // FIX: Don't fetch until wallet is ready

      try {
        // FIX: Add owner parameter to the URL for multi-tenant isolation
        const res = await fetch(`/api/logs/audit?owner=${ownerAddress.toLowerCase()}`);
        const data = await res.json();

        let authCount = 0, authAmount = 0, blockedCount = 0, blockedAmount = 0, replayCount = 0, deliveries = 0;

        data.forEach((log: any) => {
          const amount = parseFloat(log.pricePaid || "0");
          if (log.status === 'COMPLETED' || log.status === 'PAID') {
            authCount++; authAmount += amount;
            if (log.contentHash && log.contentHash !== 'NoHashProvided') deliveries++;
          } else if (log.status === 'BUDGET_EXCEEDED') {
            blockedCount++; blockedAmount += amount;
          } else if (log.status === 'REPLAY_BLOCKED') {
            replayCount++;
          }
        });

        setMetrics({ authorizedCount: authCount, authorizedAmount: authAmount, blockedCount, blockedAmount, replayCount, deliveries });
      } catch (err) { console.error("Failed to load KPIs", err); }
    }
    
    loadKpis();
    const interval = setInterval(loadKpis, 5000);
    return () => clearInterval(interval);
  }, [ownerAddress]);

  const KPI_DATA = [
    {
      key: 'kpi-authorized',
      label: 'Payments Authorized',
      value: metrics.authorizedCount.toString(),
      sub: `$${metrics.authorizedAmount.toFixed(2)} USDC Spent`,
      icon: CheckCircle2,
      color: 'text-primary',
      bg: 'bg-green-950',
      border: 'border-green-900',
    },
    {
      key: 'kpi-blocked',
      label: '402 Blocked',
      value: metrics.blockedCount.toString(),
      sub: `$${metrics.blockedAmount.toFixed(2)} Prevented`,
      icon: ShieldX,
      color: 'text-accent',
      bg: 'bg-red-950',
      border: 'border-red-900',
    },
    {
      key: 'kpi-delivered',
      label: 'Delivery Hashes',
      value: metrics.deliveries.toString(),
      sub: `Anchored On-Chain`,
      icon: BadgeCheck,
      color: 'text-info',
      bg: 'bg-blue-950',
      border: 'border-blue-900',
    },
    {
      key: 'kpi-replay',
      label: 'Replay Blocked',
      value: metrics.replayCount.toString(),
      sub: 'Duplicate Requests',
      icon: RefreshCw,
      color: 'text-purple-400',
      bg: 'bg-purple-950',
      border: 'border-purple-900',
    },
  ];

  return (
    <>
      {KPI_DATA.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div key={kpi.key} className={`glass-card rounded-xl p-4 flex flex-col gap-3 border ${kpi.border}`}>
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <Icon size={16} className={kpi.color} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {kpi.label}
              </p>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              {kpi.sub}
            </p>
          </div>
        );
      })}
    </>
  );
}