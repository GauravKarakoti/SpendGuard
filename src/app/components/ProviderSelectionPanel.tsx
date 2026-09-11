import React from 'react';
import { Cpu, Globe, CheckCircle2 } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// BACKEND INTEGRATION: Provider list comes from /api/providers discovery endpoint
const PROVIDERS = [
  {
    id: 'prov-trans-a',
    name: 'TranslationService A',
    icon: Globe,
    price: 2.0,
    quality: 0.91,
    latency: 1.2,
    selected: true,
    reason: 'Budget-efficient for current session',
  },
  {
    id: 'prov-trans-b',
    name: 'TranslationService B',
    icon: Globe,
    price: 3.0,
    quality: 0.98,
    latency: 0.8,
    selected: false,
    reason: 'Higher quality, exceeds budget threshold',
  },
  {
    id: 'prov-compute',
    name: 'ComputeService',
    icon: Cpu,
    price: 2.0,
    quality: 0.94,
    latency: 2.1,
    selected: false,
    reason: null,
  },
];

export default function ProviderSelectionPanel() {
  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-info" />
        <h3 className="text-sm font-semibold text-foreground">Provider Selection</h3>
      </div>
      <p className="text-xs text-muted-foreground">Agent decision — all payments still enforced by contract</p>

      <div className="space-y-2">
        {PROVIDERS?.map((p) => {
          const Icon = p?.icon;
          return (
            <div
              key={p?.id}
              className={`p-3 rounded-lg border text-xs transition-all duration-150 ${
                p?.selected
                  ? 'border-green-800 bg-green-950 bg-opacity-40' :'border-border bg-muted'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className={p?.selected ? 'text-primary' : 'text-muted-foreground'} />
                  <span className={`font-semibold ${p?.selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {p?.name}
                  </span>
                  {p?.selected && <CheckCircle2 size={11} className="text-primary" />}
                </div>
                <span className="font-mono font-bold text-foreground tabular-nums">${p?.price?.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>Quality: {(p?.quality * 100)?.toFixed(0)}%</span>
                <span>Latency: {p?.latency}s</span>
              </div>
              {p?.selected && p?.reason && (
                <p className="mt-1 text-green-400 italic">{p?.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}