'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldX, BadgeCheck, RefreshCw } from 'lucide-react';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

export default function KpiCards() {
  const [metrics, setMetrics] = useState({
    authorizedCount: 0,
    authorizedAmount: 0,
    blockedCount: 0,
    blockedAmount: 0,
    replayCount: 0,
    deliveries: 0,
  });

  useEffect(() => {
    async function loadKpis() {
      if (typeof window === 'undefined' || !window.ethereum) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

        // Fetch logs
        const [authorized, rejected, deliveries] = await Promise.all([
          contract.queryFilter(contract.filters.PaymentAuthorized()),
          contract.queryFilter(contract.filters.PaymentRejected()),
          contract.queryFilter(contract.filters.DeliveryRecorded())
        ]);

        let authAmount = 0;
        authorized.forEach((log: any) => {
          authAmount += Number(ethers.formatUnits(log.args[3], 6));
        });

        let blockAmount = 0;
        let replayCount = 0;
        rejected.forEach((log: any) => {
          const reason = log.args[3];
          if (reason === 'RequestAlreadyProcessed') {
            replayCount++;
          } else {
            blockAmount += Number(ethers.formatUnits(log.args[2], 6));
          }
        });

        setMetrics({
          authorizedCount: authorized.length,
          authorizedAmount: authAmount,
          blockedCount: rejected.length - replayCount,
          blockedAmount: blockAmount,
          replayCount: replayCount,
          deliveries: deliveries.length
        });
      } catch (err) {
        console.error("Failed to load KPIs", err);
      }
    }

    loadKpis();
    const interval = setInterval(loadKpis, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

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
      label: 'Overspend Blocked',
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