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
    const interval = setInterval(fetchFlows, 8000);
    return () => clearInterval(interval);
  }, [selectedFlow]);

  const flow = flows.find((f) => f.id === selectedFlow);

  // Normalize data whether it's stored directly or nested in a body key
  const r402 = flow?.response402?.body ?? flow?.response402;
  const r200 = flow?.response200?.body ?? flow?.response200;

  return (
    <div className="glass-card rounded-xl flex flex-col min-h-[400px]">
      {/* Header with Dropdown */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Globe size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground">HTTP 402 Flow</h3>
        </div>

        {flows.length > 0 && (
          <select
            value={selectedFlow || ''}
            onChange={(e) => setSelectedFlow(e.target.value)}
            className="bg-muted text-foreground text-xs font-mono border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer max-w-[200px] truncate"
          >
            {flows.map((f) => (
              <option key={`flowopt-${f.id}`} value={f.id}>
                {f.label} ({f.endpoint})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 h-64 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mb-2 text-cyan-400" />
          <p className="text-xs">Awaiting HTTP 402 interceptions...</p>
        </div>
      ) : !flow ? (
        <div className="flex flex-col items-center justify-center flex-1 h-64 text-muted-foreground text-xs">
          No HTTP payment flows recorded yet.
        </div>
      ) : (
        <div className="p-4 space-y-3 overflow-y-auto max-h-[550px]">
          {/* Step 1: Request */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">1</span>
              <span className="text-xs font-semibold text-foreground">Agent Request (no payment header)</span>
            </div>
            <div className="bg-background rounded-lg p-3 border border-border">
              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span className="text-cyan-400 font-bold">{flow.method}</span>
                <span className="text-foreground">{flow.endpoint}</span>
              </div>
              <pre className="text-xs font-mono text-muted-foreground overflow-auto leading-relaxed bg-black/30 p-2 rounded">
                {JSON.stringify(flow.requestPayload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Step 2: 402 Response */}
          {r402 && (
            <div>
              <button
                className="flex items-center gap-2 mb-1.5 w-full text-left cursor-pointer"
                onClick={() => setExpanded402((e) => !e)}
              >
                <span className="text-xs font-mono font-bold text-warning bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">2</span>
                <span className="text-xs font-semibold text-foreground">Provider Returns HTTP 402</span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-warning border border-amber-800">
                  402 Payment Required
                </span>
                {expanded402 ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              {expanded402 && (
                <div className="bg-background rounded-lg p-3 border border-amber-900/60 space-y-2">
                  <div className="text-[11px] font-mono text-muted-foreground border-b border-border/60 pb-2 space-y-0.5">
                    <div>Content-Type: application/json</div>
                    <div>X-Payment-Required: true</div>
                    {r402.provider && <div>X-Provider: {r402.provider}</div>}
                    {r402.price && <div>X-Price-0G: ${r402.price}</div>}
                  </div>
                  <pre className="text-xs font-mono text-amber-300 overflow-auto leading-relaxed bg-black/30 p-2 rounded">
                    {JSON.stringify(r402, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment (Updated for EIP-712) */}
          {r402?.requestId && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.5 rounded">3</span>
                <span className="text-xs font-semibold text-foreground">Agent Signs EIP-712 Payment</span>
                <span className="ml-auto text-[11px] font-mono text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900">
                  Off-Chain Signature
                </span>
              </div>
              <div className="bg-background rounded-lg p-3 border border-purple-900/60">
                <pre className="text-xs font-mono text-purple-300 overflow-auto leading-relaxed bg-black/30 p-2 rounded">
{`// Off-chain typed data generation (Zero Gas)
agentSigner.signTypedData(
  domain: { name: "SpendGuard", version: "1" },
  message: {
    agentId: "${flow.label}",
    requestId: "${r402.requestId}",
    provider: "${r402.provider || 'Provider'}",
    amount: ${r402.price ? r402.price + 'e18' : '0'}, // ${r402.price || "0"} 0G (18 decimals)
    serviceHash: "${r402.serviceHash || '0x...'}"
  }
)`}
                </pre>
              </div>
            </div>
          )}

          {/* Step 4: 200 OK */}
          {r200 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-primary bg-green-950/60 border border-green-800/60 px-1.5 py-0.5 rounded">4</span>
                <span className="text-xs font-semibold text-foreground">Retry with X-Payment-Proof → 200 OK</span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-green-950 text-primary border border-green-800">
                  200 OK
                </span>
              </div>
              <div className="bg-background rounded-lg p-3 border border-green-900/60">
                <pre className="text-xs font-mono text-green-300 overflow-auto leading-relaxed bg-black/30 p-2 rounded">
                  {JSON.stringify(r200, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}