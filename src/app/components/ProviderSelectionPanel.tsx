'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Globe, CheckCircle2, Loader2 } from 'lucide-react';

type ProviderInfo = {
  id: string;
  name: string;
  iconType: 'compute' | 'translate';
  price: number | string;
  quality: number | string;
  latency: number | string;
  selected: boolean;
  reason: string | null;
};

export default function ProviderSelectionPanel() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          setProviders(data);
        }
      } catch (err) {
        console.error("Failed to fetch providers", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProviders();
    const interval = setInterval(fetchProviders, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-3 h-auto">
      <div className="flex items-center gap-2">
        <Cpu size={16} className="text-info" />
        <h3 className="text-sm font-semibold text-foreground">Live Provider Discovery</h3>
      </div>
      <p className="text-xs text-muted-foreground">Agent decision — all payments still enforced by contract</p>

      <div className="space-y-2 flex-1">
        {loading && providers.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={16} className="text-muted-foreground animate-spin" />
          </div>
        ) : (
          providers.map((p) => {
            const IconComponent = p.iconType === 'compute' ? Cpu : Globe;
            
            // Safely parse numeric fields coming from Drizzle
            const priceNum = Number(p.price) || 0;
            const qualityNum = Number(p.quality) || 0;
            const latencyNum = Number(p.latency) || 0;

            return (
              <div
                key={p.id}
                className={`p-3 rounded-lg border text-xs transition-all duration-150 ${
                  p.selected
                    ? 'border-green-800 bg-green-950 bg-opacity-40' : 'border-border bg-muted'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <IconComponent size={12} className={p.selected ? 'text-primary' : 'text-muted-foreground'} />
                    <span className={`font-semibold ${p.selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {p.name}
                    </span>
                    {p.selected && <CheckCircle2 size={11} className="text-primary" />}
                  </div>
                  <span className="font-mono font-bold text-foreground tabular-nums">${priceNum.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>Quality: {(qualityNum * 100).toFixed(0)}%</span>
                  <span>Latency: {latencyNum}s</span>
                </div>
                {p.selected && p.reason && (
                  <p className="mt-1 text-green-400 italic">{p.reason}</p>
                )}
              </div>
            );
          })
        )}
        {!loading && providers.length === 0 && (
          <div className="text-xs text-muted-foreground p-4 text-center border border-border border-dashed rounded-lg">
            No active providers detected.
          </div>
        )}
      </div>
    </div>
  );
}