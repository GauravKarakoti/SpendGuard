'use client';

import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';

// BACKEND INTEGRATION: Populated from actual HTTP 402 responses intercepted by the agent middleware
const PAYMENT_FLOWS = [
  {
    id: 'flow-trans-a',
    label: 'TranslationService A',
    method: 'POST',
    endpoint: '/api/translate',
    requestPayload: {
      text: 'Please translate: "The budget enforcement is on-chain."',
      sourceLang: 'en',
      targetLang: 'hi',
    },
    response402: {
      status: 402,
      headers: { 'Content-Type': 'application/json', 'X-Payment-Required': 'true' },
      body: {
        price: '2.00',
        currency: 'USDC',
        provider: 'TranslationService A',
        requestId: 'req_8f4a2b3c',
        paymentNetwork: 'ethereum-sepolia',
        paymentContract: '0x4f3e9a2b8d1c6e7f3a9b2c8d1e6f7a3b8c2a',
        serviceHash: '0xabc123def456...',
        expiresAt: '2026-09-11T10:44:33Z',
      },
    },
    response200: {
      status: 200,
      body: {
        requestId: 'req_8f4a2b3c',
        translation: '"बजट प्रवर्तन ऑन-चेन है।"',
        sourceLang: 'en',
        targetLang: 'hi',
        contentHash: '0x9a3f7b2e1c8d5f4a3b9c2e7d1f8a4b3c9e2d7f1a',
        deliveredAt: '2026-09-11T10:44:06Z',
      },
    },
  },
  {
    id: 'flow-compute',
    label: 'ComputeService',
    method: 'POST',
    endpoint: '/api/compute',
    requestPayload: {
      jobType: 'matrix_multiply',
      dimensions: '512x512',
      jobId: 'job_447',
    },
    response402: {
      status: 402,
      headers: { 'Content-Type': 'application/json', 'X-Payment-Required': 'true' },
      body: {
        price: '2.00',
        currency: 'USDC',
        provider: 'ComputeService',
        requestId: 'req_c7d8e9f0',
        paymentNetwork: 'ethereum-sepolia',
        paymentContract: '0x4f3e9a2b8d1c6e7f3a9b2c8d1e6f7a3b8c2a',
        serviceHash: '0xdef789abc012...',
        expiresAt: '2026-09-11T10:45:53Z',
      },
    },
    response200: {
      status: 200,
      body: {
        requestId: 'req_c7d8e9f0',
        result: '[[2.14, 0.87, ...], ...]',
        jobId: 'job_447',
        computeMs: 847,
        contentHash: '0x4d8a9c1e7b2f3a5d8c1e4f7a2b5d8c1e4f7a2b5d',
        deliveredAt: '2026-09-11T10:45:33Z',
      },
    },
  },
];

export default function Http402Viewer() {
  const [selectedFlow, setSelectedFlow] = useState(PAYMENT_FLOWS[0].id);
  const [showResponse, setShowResponse] = useState<'402' | '200'>('402');
  const [expanded402, setExpanded402] = useState(true);

  const flow = PAYMENT_FLOWS.find((f) => f.id === selectedFlow)!;

  return (
    <div className="glass-card rounded-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-cyan-400" />
          <h3 className="text-sm font-semibold text-foreground">HTTP 402 Flow</h3>
        </div>
        <div className="flex items-center gap-1">
          {PAYMENT_FLOWS.map((f) => (
            <button
              key={`flowbtn-${f.id}`}
              onClick={() => setSelectedFlow(f.id)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-150 ${
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

      <div className="p-4 space-y-3">
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
                {Object.entries(flow.response402.headers).map(([k, v]) => (
                  <div key={`hdr-${k}`}>{k}: {v}</div>
                ))}
              </div>
              <pre className="text-xs font-mono text-amber-300 overflow-auto leading-relaxed">
                {JSON.stringify(flow.response402.body, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Step 3: Payment */}
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
  ${parseFloat(flow.response402.body.price) * 1_000_000}, // USDC 6 decimals
  "${flow.response402.body.serviceHash}"
)`}
            </pre>
          </div>
        </div>

        {/* Step 4: 200 OK */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-bold text-primary">4</span>
            <span className="text-xs font-semibold text-foreground">Provider Returns Resource</span>
            <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-bold bg-green-950 text-primary border border-green-800">
              200 OK
            </span>
          </div>
          <div className="bg-background rounded-lg p-3 border border-green-900">
            <pre className="text-xs font-mono text-green-300 overflow-auto leading-relaxed">
              {JSON.stringify(flow.response200.body, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}