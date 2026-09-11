'use client';

import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

type PaymentFlow = {
  id: string;
  label: string;
  method: string;
  endpoint: string;
  requestPayload: any;
  response402: any;
  response200: any;
};

export default function Http402Viewer() {
  const [flows, setFlows] = useState<PaymentFlow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [expanded402, setExpanded402] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlows() {
      try {
        const res = await fetch('/api/logs/http402');
        if (res.ok) {
          const data = await res.json();
          setFlows(data);
          if (data.length > 0 && !selectedFlow) {
            setSelectedFlow(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch HTTP 402 flows", err);
      } finally {
        setLoading(false);
      }
    }

    fetchFlows();
    const interval = setInterval(fetchFlows, 10000);
    return () => clearInterval(interval);
  }, [selectedFlow]);

  const flow = flows.find((f) => f.id === selectedFlow);

  return (
    <div className="glass-card rounded-xl flex flex-col min-h-[400px]">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground">HTTP 402 Flow Interception</h3>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto max-w-[50%]">
          {flows.map((f) => (
            <button
              key={`flowbtn-${f.id}`}
              onClick={() => setSelectedFlow(f.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                selectedFlow === f.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label.replace('Service', '').replace(' A', ' A').trim()}
            </button>
          ))}
        </div>
      </div>

      {loading && flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 h-64 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mb-2" />
          <p className="text-xs">Awaiting HTTP 402 interceptions...</p>
        </div>
      ) : !flow ? (
        <div className="flex flex-col items-center justify-center flex-1 h-64 text-muted-foreground text-xs">
          No HTTP payment flows recorded yet.
        </div>
      ) : (
        <div className="p-4 space-y-3 overflow-y-auto max-h-[500px]">
          {/* Step 1: Request */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold text-cyan-400">1</span>
              <span className="text-xs font-semibold text-foreground">Agent Request (no payment)</span>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-cyan-400">{flow.method}</span>
                <span className="text-xs font-mono text-foreground">{flow.endpoint}</span>
              </div>
              <pre className="text-xs font-mono text-muted-foreground overflow-auto leading-relaxed">
                {JSON.stringify(flow.requestPayload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Step 2: 402 Response */}
          {flow.response402 && (
            <div>
              <button
                className="flex items-center gap-2 mb-1.5 w-full text-left"
                onClick={() => setExpanded402((e) => !e)}
              >
                <span className="text-xs font-mono font-bold text-warning">2</span>
                <span className="text-xs font-semibold text-foreground">Provider Returns HTTP 402</span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-bold bg-amber-950 text-warning border border-amber-800">
                  402
                </span>
                {expanded402 ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
              </button>
              {expanded402 && (
                <div className="bg-background rounded-lg p-3 border border-amber-900 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-warning font-bold">HTTP/1.1 402 Payment Required</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mb-2">
                    {Object.entries(flow.response402.headers || {}).map(([k, v]) => (
                      <div key={`hdr-${k}`}>{k}: {String(v)}</div>
                    ))}
                  </div>
                  <pre className="text-xs font-mono text-amber-300 overflow-auto leading-relaxed">
                    {JSON.stringify(flow.response402.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {flow.response402?.body?.requestId && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-purple-400">3</span>
                <span className="text-xs font-semibold text-foreground">Agent → SpendGuard.pay()</span>
              </div>
              <div className="bg-background rounded-lg p-3 border border-purple-900">
                <pre className="text-xs font-mono text-purple-300 overflow-auto leading-relaxed">
{`SpendGuard.pay(
  agentId,
  "${flow.response402.body.requestId}",
  provider,
  ${parseFloat(flow.response402.body.price || "0") * 1_000_000}, // USDC 6 decimals
  "${flow.response402.body.serviceHash || '0x00'}"
)`}
                </pre>
              </div>
            </div>
          )}

          {/* Step 4: 200 OK */}
          {flow.response200 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-primary">4</span>
                <span className="text-xs font-semibold text-foreground">Provider Returns Resource</span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-bold bg-green-950 text-primary border border-green-800">
                  {flow.response200.status}
                </span>
              </div>
              <div className="bg-background rounded-lg p-3 border border-green-900">
                <pre className="text-xs font-mono text-green-300 overflow-auto leading-relaxed">
                  {JSON.stringify(flow.response200.body, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}