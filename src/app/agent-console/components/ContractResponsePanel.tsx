'use client';

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

type LogEvent = {
  id: string;
  event: string;
  status: 'success' | 'error';
  requestId: string;
  provider: string;
  amount: string;
  block: number;
  txHash: string;
  reason?: string;
};

export default function ContractResponsePanel() {
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

    const onAuthorized = (agentId: string, requestId: string, providerAddr: string, amount: bigint, eventPayload: any) => {
      const txHash = eventPayload.log.transactionHash;
      
      setEvents(prev => {
        // DEDUPLICATION CHECK
        if (prev.some(e => e.txHash === txHash)) return prev;
        
        return [{
          id: txHash,
          event: 'PaymentAuthorized', // Fixed to match LogEvent type
          provider: providerAddr,
          amount: ethers.formatUnits(amount, 6), // Fixed to be a string
          requestId: ethers.decodeBytes32String(requestId).replace(/\0/g, ''),
          txHash: txHash,
          block: eventPayload.log.blockNumber,
          status: 'success', // Fixed to match 'success' | 'error'
        }, ...prev];
      });
    };

    const onRejected = (agentId: string, requestId: string, amount: bigint, reason: string, eventPayload: any) => {
      const txHash = eventPayload.log.transactionHash;

      setEvents(prev => {
        // DEDUPLICATION CHECK
        if (prev.some(e => e.txHash === txHash)) return prev;

        return [{
          id: txHash,
          event: 'PaymentRejected', // Fixed
          provider: 'Unknown Provider (Revert)',
          amount: ethers.formatUnits(amount, 6), // Fixed
          requestId: ethers.decodeBytes32String(requestId).replace(/\0/g, ''),
          txHash: txHash,
          block: eventPayload.log.blockNumber,
          status: 'error', // Fixed
          reason: reason, // Fixed to match 'reason' instead of 'rejectReason'
        }, ...prev];
      });
    };

    contract.on('PaymentAuthorized', onAuthorized);
    contract.on('PaymentRejected', onRejected);

    return () => {
      contract.removeAllListeners('PaymentAuthorized');
      contract.removeAllListeners('PaymentRejected');
    };
  }, []);

  return (
    <div className="glass-card rounded-xl flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <Shield size={15} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground">Contract Events</h3>
        <span className="ml-auto text-xs text-muted-foreground">SpendGuard.sol</span>
      </div>

      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Waiting for on-chain events...</p>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className={`p-3 rounded-lg border text-xs ${
                evt.status === 'success' ? 'border-green-900 bg-green-950 bg-opacity-30' : 'border-red-900 bg-red-950 bg-opacity-30'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {evt.status === 'success' ? (
                    <CheckCircle2 size={12} className="text-primary" />
                  ) : (
                    <XCircle size={12} className="text-accent" />
                  )}
                  <span className={`font-semibold font-mono ${evt.status === 'success' ? 'text-primary' : 'text-accent'}`}>
                    {evt.event}
                  </span>
                </div>
                <span className="font-mono text-muted-foreground">#{evt.block}</span>
              </div>
              <div className="space-y-0.5 text-muted-foreground font-mono">
                <div>requestId: <span className="text-foreground">{evt.requestId}</span></div>
                {evt.status === 'success' && <div>provider: <span className="text-foreground truncate">{evt.provider.slice(0,16)}...</span></div>}
                <div>amount: <span className="text-foreground">${Number(evt.amount).toFixed(2)} 0G</span></div>
                {evt.status === 'error' && evt.reason && (
                  <div>reason: <span className="text-accent">{evt.reason}</span></div>
                )}
                {evt.txHash && (
                  <div>tx: <span className="text-info">{evt.txHash.slice(0, 14)}...</span></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mx-3 mb-3 p-3 rounded-lg bg-muted border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-semibold">Security proof:</span> All PaymentRejected events originate from the contract layer — not the agent. The agent submitted the transaction; the contract reverted it.
        </p>
      </div>
    </div>
  );
}