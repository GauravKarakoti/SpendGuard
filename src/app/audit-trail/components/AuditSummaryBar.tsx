import React from 'react';
import { CheckCircle2, ShieldX, RefreshCw, Hash } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const SUMMARY = [
  { key: 'sum-authorized', label: 'Authorized', value: '4', icon: CheckCircle2, color: 'text-primary', bg: 'bg-green-950', border: 'border-green-900' },
  { key: 'sum-blocked', label: 'Budget Blocked', value: '3', icon: ShieldX, color: 'text-accent', bg: 'bg-red-950', border: 'border-red-900' },
  { key: 'sum-replay', label: 'Replay Blocked', value: '2', icon: RefreshCw, color: 'text-purple-400', bg: 'bg-purple-950', border: 'border-purple-900' },
  { key: 'sum-hashes', label: 'Hashes Verified', value: '4/4', icon: Hash, color: 'text-info', bg: 'bg-blue-950', border: 'border-blue-900' },
];

export default function AuditSummaryBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SUMMARY?.map((s) => {
        const Icon = s?.icon;
        return (
          <div key={s?.key} className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 border ${s?.border}`}>
            <div className={`p-2 rounded-lg ${s?.bg}`}>
              <Icon size={15} className={s?.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground tabular-nums">{s?.value}</p>
              <p className="text-xs text-muted-foreground">{s?.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}