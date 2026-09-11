'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, ShieldX, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

type ActivityEvent = {
  id: string;
  type: 'authorized' | 'blocked' | 'replay';
  provider: string;
  amount: number;
  requestId: string;
  txHash: string;
  block: number;
  status: string;
  rejectReason?: string;
};

export default function LiveActivityFeed() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'authorized' | 'blocked' | 'replay'>('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

    const onAuthorized = (agentId: string, requestId: string, providerAddr: string, amount: bigint, eventPayload: any) => {
      const newEvent: ActivityEvent = {
        id: eventPayload.log.transactionHash,
        type: 'authorized',
        provider: providerAddr,
        amount: Number(ethers.formatUnits(amount, 6)),
        requestId: ethers.decodeBytes32String(requestId).replace(/\0/g, ''),
        txHash: eventPayload.log.transactionHash,
        block: eventPayload.log.blockNumber,
        status: 'DELIVERED',
      };
      setEvents(prev => [newEvent, ...prev]);
    };

    const onRejected = (agentId: string, requestId: string, amount: bigint, reason: string, eventPayload: any) => {
      const newEvent: ActivityEvent = {
        id: eventPayload.log.transactionHash,
        type: reason === 'RequestAlreadyProcessed' ? 'replay' : 'blocked',
        provider: 'Unknown Provider (Revert)',
        amount: Number(ethers.formatUnits(amount, 6)),
        requestId: ethers.decodeBytes32String(requestId).replace(/\0/g, ''),
        txHash: eventPayload.log.transactionHash,
        block: eventPayload.log.blockNumber,
        status: reason === 'RequestAlreadyProcessed' ? 'REJECTED' : 'BLOCKED',
        rejectReason: reason,
      };
      setEvents(prev => [newEvent, ...prev]);
    };

    contract.on('PaymentAuthorized', onAuthorized);
    contract.on('PaymentRejected', onRejected);

    return () => {
      contract.off('PaymentAuthorized', onAuthorized);
      contract.off('PaymentRejected', onRejected);
    };
  }, []);

  const filtered = events.filter((item) => filter === 'all' ? true : item.type === filter);

  return (
    <div className="glass-card rounded-xl flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-green" />
          <h2 className="text-sm font-semibold text-foreground">Live On-Chain Activity</h2>
          <span className="text-xs text-muted-foreground">· {events.length} events</span>
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'authorized', 'blocked', 'replay'] as const).map((f) => (
            <button
              key={`filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'All' : f === 'authorized' ? 'Authorized' : f === 'blocked' ? 'Blocked' : 'Replay'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
            Listening for SpendGuard events on Sepolia...
          </div>
        ) : (
          filtered.map((item) => {
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
                      {item.type === 'authorized' && <CheckCircle2 size={16} className="text-primary" />}
                      {item.type === 'blocked' && <ShieldX size={16} className="text-accent" />}
                      {item.type === 'replay' && <RefreshCw size={14} className="text-purple-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {item.provider.slice(0, 16)}...
                        </span>
                        {item.type === 'blocked' && (
                          <span className="text-xs font-mono text-accent bg-red-950 px-1.5 py-0.5 rounded border border-red-900">
                            {item.rejectReason}
                          </span>
                        )}
                        {item.type === 'replay' && (
                          <span className="text-xs font-mono text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded border border-purple-900">
                            {item.rejectReason}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                          href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}