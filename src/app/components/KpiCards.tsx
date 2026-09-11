import React from 'react';
import { CheckCircle2, ShieldX, BadgeCheck, RefreshCw } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// BACKEND INTEGRATION: Replace with /api/metrics endpoint or contract event queries
const KPI_DATA = [
  {
    key: 'kpi-authorized',
    label: 'Payments Authorized',
    value: '4',
    sub: '2 providers · $4.00 USDC',
    icon: CheckCircle2,
    color: 'text-primary',
    bg: 'bg-green-950',
    border: 'border-green-900',
    trend: '+2 today',
    trendUp: true,
  },
  {
    key: 'kpi-blocked',
    label: 'Overspend Blocked',
    value: '3',
    sub: '$7.00 prevented',
    icon: ShieldX,
    color: 'text-accent',
    bg: 'bg-red-950',
    border: 'border-red-900',
    trend: 'Contract enforced',
    trendUp: false,
  },
  {
    key: 'kpi-delivered',
    label: 'Delivery Verified',
    value: '100%',
    sub: '4 of 4 hashes match',
    icon: BadgeCheck,
    color: 'text-info',
    bg: 'bg-blue-950',
    border: 'border-blue-900',
    trend: 'keccak256 verified',
    trendUp: true,
  },
  {
    key: 'kpi-replay',
    label: 'Replay Blocked',
    value: '2',
    sub: 'RequestAlreadyProcessed',
    icon: RefreshCw,
    color: 'text-purple-400',
    bg: 'bg-purple-950',
    border: 'border-purple-900',
    trend: 'requestId unique',
    trendUp: true,
  },
];

export default function KpiCards() {
  return (
    <>
      {KPI_DATA?.map((kpi) => {
        const Icon = kpi?.icon;
        return (
          <div
            key={kpi?.key}
            className={`glass-card rounded-xl p-4 flex flex-col gap-3 border ${kpi?.border}`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${kpi?.bg}`}>
                <Icon size={16} className={kpi?.color} />
              </div>
              <span className={`text-xs font-medium ${kpi?.color} bg-opacity-20 ${kpi?.bg} px-2 py-0.5 rounded-full border ${kpi?.border}`}>
                {kpi?.trend}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{kpi?.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {kpi?.label}
              </p>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              {kpi?.sub}
            </p>
          </div>
        );
      })}
    </>
  );
}