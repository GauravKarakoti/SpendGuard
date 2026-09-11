'use client';

import React, { useState } from 'react';
import { Hash, CheckCircle2, XCircle, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';

// BACKEND INTEGRATION: Replace with call to /api/verify-hash?requestId=...&hash=...
const KNOWN_HASHES: Record<string, string> = {
  'req_8f4a2b3c': '0x9a3f7b2e1c8d5f4a3b9c2e7d1f8a4b3c9e2d7f1a',
  'req_c7d8e9f0': '0x4d8a9c1e7b2f3a5d8c1e4f7a2b5d8c1e4f7a2b5d',
  'req_d5e6f7a8': '0x7b2e5f4a1c8d3e9b2f5a8c1d4e7b2f5a8c1d4e7b',
  'req_e3f4a5b6': '0x1c9d8e3b7f2a5d4c1e8b3f7a2d5c8e1b4f7a2d5c',
  'req_g7h8i9j0': '0x3e7b2f5a8c1d4e7b2f5a8c1d4e7b2f5a8c1d4e7b',
};

type VerifyState = 'idle' | 'match' | 'mismatch' | 'notfound';

export default function DeliveryHashVerifier() {
  const [requestId, setRequestId] = useState('');
  const [inputHash, setInputHash] = useState('');
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [expectedHash, setExpectedHash] = useState<string | null>(null);

  const handleVerify = () => {
    if (!requestId.trim() || !inputHash.trim()) {
      toast.error('Enter both requestId and content hash');
      return;
    }
    const known = KNOWN_HASHES[requestId.trim()];
    if (!known) {
      setVerifyState('notfound');
      setExpectedHash(null);
      return;
    }
    setExpectedHash(known);
    if (inputHash.trim().toLowerCase() === known.toLowerCase()) {
      setVerifyState('match');
      toast.success('Hash verified — delivery confirmed ✓');
    } else {
      setVerifyState('mismatch');
      toast.error('Hash mismatch — delivery cannot be confirmed');
    }
  };

  const handleQuickFill = (reqId: string) => {
    setRequestId(reqId);
    setInputHash(KNOWN_HASHES[reqId] || '');
    setVerifyState('idle');
    setExpectedHash(null);
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-4 sticky top-6">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-info" />
        <h3 className="text-sm font-semibold text-foreground">Delivery Hash Verifier</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Verify that the resource you received matches the content hash recorded on-chain.
        Proves what was actually delivered for a specific payment.
      </p>

      {/* Input */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
            Request ID
          </label>
          <input
            type="text"
            value={requestId}
            onChange={(e) => { setRequestId(e.target.value); setVerifyState('idle'); }}
            placeholder="req_8f4a2b3c"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
            Content Hash (keccak256 of delivered resource)
          </label>
          <textarea
            value={inputHash}
            onChange={(e) => { setInputHash(e.target.value); setVerifyState('idle'); }}
            placeholder="0x9a3f7b2e1c8d5f4a..."
            rows={3}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder-muted-foreground outline-none focus:border-ring transition-colors resize-none"
          />
        </div>
        <button
          onClick={handleVerify}
          className="btn-primary w-full justify-center"
        >
          <Search size={14} />
          Verify Delivery Hash
        </button>
      </div>

      {/* Result */}
      {verifyState === 'match' && (
        <div className="p-4 rounded-xl border border-green-800 bg-green-950 bg-opacity-40 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-primary" />
            <p className="text-sm font-bold text-primary">Hash Verified ✓</p>
          </div>
          <p className="text-xs text-muted-foreground">
            The delivered resource matches the on-chain content hash. This payment delivered exactly what was recorded.
          </p>
          <div className="mt-2 p-2 rounded-lg bg-background">
            <p className="text-xs font-mono text-green-400 break-all">{expectedHash}</p>
          </div>
        </div>
      )}

      {verifyState === 'mismatch' && (
        <div className="p-4 rounded-xl border border-red-800 bg-red-950 bg-opacity-40 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={16} className="text-accent" />
            <p className="text-sm font-bold text-accent">Hash Mismatch ✗</p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            The provided hash does not match the on-chain record. The resource may have been tampered with.
          </p>
          <div className="space-y-1.5 text-xs">
            <div>
              <p className="text-muted-foreground">Expected (on-chain):</p>
              <p className="font-mono text-primary break-all">{expectedHash}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Provided:</p>
              <p className="font-mono text-accent break-all">{inputHash}</p>
            </div>
          </div>
        </div>
      )}

      {verifyState === 'notfound' && (
        <div className="p-4 rounded-xl border border-amber-800 bg-amber-950 bg-opacity-40 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-warning" />
            <p className="text-sm font-bold text-warning">Request Not Found</p>
          </div>
          <p className="text-xs text-muted-foreground">
            No delivery record found for requestId <span className="font-mono text-foreground">{requestId}</span>. Check the audit table.
          </p>
        </div>
      )}

      {/* Quick fill */}
      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Quick Fill — Verified Requests</p>
        <div className="space-y-1.5">
          {Object.keys(KNOWN_HASHES).map((reqId) => (
            <button
              key={`quickfill-${reqId}`}
              onClick={() => handleQuickFill(reqId)}
              className="w-full text-left px-3 py-2 rounded-lg bg-muted hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 border border-border"
            >
              {reqId}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}