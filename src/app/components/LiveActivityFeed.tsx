'use client';

import React, { useState } from 'react';
import { CheckCircle2, ShieldX, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

// BACKEND INTEGRATION: Replace with WebSocket subscription to contract PaymentAuthorized/PaymentRejected events
const ACTIVITY_ITEMS = [
  {
    id: 'act-001',
    type: 'authorized',
    provider: 'TranslationService A',
    service: 'English → Hindi translation',
    amount: 2.0,
    requestId: 'req_8f4a2b3c',
    txHash: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    block: 7842387,
    timestamp: '2026-09-11T10:44:12Z',
    deliveryHash: '0xkec_9a3f...2b7c',
    status: 'DELIVERED',
    retries: 1,
  },
  {
    id: 'act-002',
    type: 'authorized',
    provider: 'ComputeService',
    service: 'Matrix computation job #447',
    amount: 2.0,
    requestId: 'req_c7d8e9f0',
    txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    block: 7842388,
    timestamp: '2026-09-11T10:45:33Z',
    deliveryHash: '0xkec_4d8a...9c1e',
    status: 'DELIVERED',
    retries: 1,
  },
  {
    id: 'act-003',
    type: 'replay',
    provider: 'TranslationService A',
    service: 'English → Hindi translation (retry)',
    amount: 2.0,
    requestId: 'req_8f4a2b3c',
    txHash: null,
    block: 7842388,
    timestamp: '2026-09-11T10:45:48Z',
    deliveryHash: null,
    status: 'REJECTED',
    rejectReason: 'RequestAlreadyProcessed',
    retries: 2,
  },
  {
    id: 'act-004',
    type: 'blocked',
    provider: 'PremiumCompute',
    service: 'Premium GPU compute job',
    amount: 3.0,
    requestId: 'req_f1a2b3c4',
    txHash: null,
    block: 7842389,
    timestamp: '2026-09-11T10:46:55Z',
    deliveryHash: null,
    status: 'BLOCKED',
    rejectReason: 'BudgetExceeded',
    budgetDetails: { limit: 5.0, spent: 4.0, attempted: 3.0, remaining: 1.0 },
    retries: 1,
  },
  {
    id: 'act-005',
    type: 'authorized',
    provider: 'TranslationService B',
    service: 'French → English translation',
    amount: 3.0,
    requestId: 'req_d5e6f7a8',
    txHash: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    block: 7842385,
    timestamp: '2026-09-11T10:41:02Z',
    deliveryHash: '0xkec_7b2e...5f4a',
    status: 'DELIVERED',
    retries: 1,
  },
  {
    id: 'act-006',
    type: 'blocked',
    provider: 'ComputeService',
    service: 'Bulk compute batch #12',
    amount: 3.0,
    requestId: 'req_b9c0d1e2',
    txHash: null,
    block: 7842383,
    timestamp: '2026-09-11T10:38:44Z',
    deliveryHash: null,
    status: 'BLOCKED',
    rejectReason: 'BudgetExceeded',
    budgetDetails: { limit: 5.0, spent: 5.0, attempted: 3.0, remaining: 0.0 },
    retries: 1,
  },
  {
    id: 'act-007',
    type: 'authorized',
    provider: 'TranslationService A',
    service: 'Spanish → English (batch)',
    amount: 2.0,
    requestId: 'req_e3f4a5b6',
    txHash: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    block: 7842381,
    timestamp: '2026-09-11T10:35:19Z',
    deliveryHash: '0xkec_1c9d...8e3b',
    status: 'DELIVERED',
    retries: 1,
  },
  {
    id: 'act-008',
    type: 'replay',
    provider: 'ComputeService',
    service: 'Matrix computation job #447 (retry)',
    amount: 2.0,
    requestId: 'req_c7d8e9f0',
    txHash: null,
    block: 7842389,
    timestamp: '2026-09-11T10:46:01Z',
    deliveryHash: null,
    status: 'REJECTED',
    rejectReason: 'RequestAlreadyProcessed',
    retries: 2,
  },
];

function ActivityIcon({ type }: { type: string }) {
  if (type === 'authorized') return <CheckCircle2 size={16} className="text-primary" />;
  if (type === 'blocked') return <ShieldX size={16} className="text-accent" />;
  if (type === 'replay') return <RefreshCw size={14} className="text-purple-400" />;
  return null;
}

function StatusBadge({ item }: { item: typeof ACTIVITY_ITEMS[0] }) {
  if (item.status === 'DELIVERED') {
    return <span className="status-badge-authorized">✓ DELIVERED</span>;
  }
  if (item.status === 'BLOCKED') {
    return <span className="status-badge-blocked">🛡 BLOCKED</span>;
  }
  if (item.status === 'REJECTED') {
    return <span className="status-badge-replay">↺ REPLAY</span>;
  }
  return null;
}

export default function LiveActivityFeed() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'authorized' | 'blocked' | 'replay'>('all');

  const filtered = ACTIVITY_ITEMS.filter((item) =>
    filter === 'all' ? true : item.type === filter
  );

  return (
    <div className="glass-card rounded-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-green" />
          <h2 className="text-sm font-semibold text-foreground">Live Activity</h2>
          <span className="text-xs text-muted-foreground">· {ACTIVITY_ITEMS.length} events</span>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'authorized', 'blocked', 'replay'] as const).map((f) => (
            <button
              key={`filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                filter === f
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'authorized' ? 'Authorized' : f === 'blocked' ? 'Blocked' : 'Replay'}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className="animate-slide-up">
              <div
                className={`px-5 py-3.5 cursor-pointer transition-all duration-150 hover:bg-muted ${
                  item.type === 'blocked' ? 'bg-red-950 bg-opacity-20' : ''
                }`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <ActivityIcon type={item.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{item.provider}</span>
                      <StatusBadge item={item} />
                      {item.type === 'blocked' && item.rejectReason && (
                        <span className="text-xs font-mono text-accent bg-red-950 px-1.5 py-0.5 rounded border border-red-900">
                          {item.rejectReason}
                        </span>
                      )}
                      {item.type === 'replay' && item.rejectReason && (
                        <span className="text-xs font-mono text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-900">
                          {item.rejectReason}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{item.service}</span>
                      <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                        ${item.amount.toFixed(2)} USDC
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.requestId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Block #{item.block.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.txHash && (
                      <a
                        href="#"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="View on Sepolia Etherscan"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-4 bg-muted bg-opacity-30 border-t border-border animate-fade-in">
                  {item.type === 'blocked' && item.budgetDetails && (
                    <div className="mt-3 p-4 rounded-xl border border-accent border-opacity-40 bg-red-950 bg-opacity-30">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldX size={14} className="text-accent" />
                        <p className="text-sm font-bold text-accent">🛡️ BLOCKED BY PROTOCOL</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Budget Limit</p>
                          <p className="font-mono font-semibold text-foreground tabular-nums">${item.budgetDetails.limit.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Already Spent</p>
                          <p className="font-mono font-semibold text-foreground tabular-nums">${item.budgetDetails.spent.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Agent Attempted</p>
                          <p className="font-mono font-semibold text-accent tabular-nums">${item.budgetDetails.attempted.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Available</p>
                          <p className="font-mono font-semibold text-warning tabular-nums">${item.budgetDetails.remaining.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-red-900">
                        <p className="text-xs font-mono text-muted-foreground">
                          Contract revert: <span className="text-accent">BudgetExceeded</span>
                          {' '}· require({item.budgetDetails.spent} + {item.budgetDetails.attempted} &lt;= {item.budgetDetails.limit})
                        </p>
                        <p className="text-xs text-green-400 mt-1 font-semibold">Funds lost: $0.00 ✓</p>
                      </div>
                    </div>
                  )}

                  {item.type === 'replay' && (
                    <div className="mt-3 p-4 rounded-xl border border-purple-800 bg-purple-950 bg-opacity-30">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw size={14} className="text-purple-400" />
                        <p className="text-sm font-bold text-purple-400">Replay Protection Triggered</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        requestId <span className="font-mono text-foreground">{item.requestId}</span> was already processed.
                        The contract mapping <span className="font-mono text-purple-400">processedRequests[requestId]</span> returned true.
                      </p>
                      <p className="text-xs text-green-400 mt-2 font-semibold">Double charge prevented: $0.00 extra ✓</p>
                    </div>
                  )}

                  {item.type === 'authorized' && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">Transaction Hash</p>
                        <p className="font-mono text-foreground truncate">{item.txHash}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Delivery Hash (keccak256)</p>
                        <p className="font-mono text-primary truncate">{item.deliveryHash}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Request ID</p>
                        <p className="font-mono text-foreground">{item.requestId}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Retry Count</p>
                        <p className="font-mono text-foreground">{item.retries}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last updated: <span className="font-mono">2026-09-11 10:46:55 UTC</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {filtered.filter(i => i.type === 'blocked').length} blocked · {filtered.filter(i => i.type === 'authorized').length} authorized
        </p>
      </div>
    </div>
  );
}