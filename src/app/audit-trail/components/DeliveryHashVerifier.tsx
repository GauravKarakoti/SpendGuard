'use client';

import React, { useState } from 'react';
import { Hash, CheckCircle2, XCircle, Search, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import SpendGuardABI from '@/contracts/SpendGuard.json';
import Addresses from '@/contracts/addresses.json';

type VerifyState = 'idle' | 'match' | 'mismatch' | 'notfound' | 'loading';

export default function DeliveryHashVerifier() {
  const [requestId, setRequestId] = useState('');
  const [inputHash, setInputHash] = useState('');
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [expectedHash, setExpectedHash] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!requestId.trim() || !inputHash.trim()) {
      toast.error('Enter both requestId and content hash');
      return;
    }
    
    setVerifyState('loading');

    try {
      if (typeof window === 'undefined' || !window.ethereum) throw new Error("Web3 provider missing. Please connect a wallet.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(Addresses.SpendGuard, SpendGuardABI.abi, provider);

      // Safely pad the string to bytes32 format as required by the contract
      let encodedRequestId: string;
      try {
        encodedRequestId = ethers.encodeBytes32String(requestId.trim());
      } catch (encodeErr) {
        toast.error('Request ID is too long (max 31 characters for bytes32)');
        setVerifyState('idle');
        return;
      }

      const onChainHash = await contract.getDeliveryHash(encodedRequestId);

      if (onChainHash === ethers.ZeroHash) {
        setVerifyState('notfound');
        setExpectedHash(null);
        return;
      }

      setExpectedHash(onChainHash);

      if (inputHash.trim().toLowerCase() === onChainHash.toLowerCase()) {
        setVerifyState('match');
        toast.success('Hash verified — 0G delivery confirmed ✓');
      } else {
        setVerifyState('mismatch');
        toast.error('Hash mismatch — delivery cannot be confirmed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.reason || err.message || 'Failed to query 0G Network');
      setVerifyState('idle');
    }
  };

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-4 sticky top-6">
      <div className="flex items-center gap-2">
        <Hash size={16} className="text-info" />
        <h3 className="text-sm font-semibold text-foreground">0G Delivery Verifier</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Verify that the resource you received matches the content hash securely anchored on the 0G Network by the provider during settlement.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Request ID</label>
          <input
            type="text"
            value={requestId}
            onChange={(e) => { setRequestId(e.target.value); setVerifyState('idle'); }}
            placeholder="e.g., req_8f4a2b3c"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder-muted-foreground outline-none focus:border-ring transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Content Hash (keccak256)</label>
          <textarea
            value={inputHash}
            onChange={(e) => { setInputHash(e.target.value); setVerifyState('idle'); }}
            placeholder="0x..."
            rows={3}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder-muted-foreground outline-none focus:border-ring transition-colors resize-none"
          />
        </div>
        <button onClick={handleVerify} disabled={verifyState === 'loading'} className="btn-primary w-full justify-center">
          {verifyState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Verify on 0G Network
        </button>
      </div>

      {verifyState === 'match' && (
        <div className="p-4 rounded-xl border border-green-800 bg-green-950 bg-opacity-40 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-primary" />
            <p className="text-sm font-bold text-primary">Hash Verified ✓</p>
          </div>
          <p className="text-xs text-muted-foreground">Matches the exact on-chain record anchored on the 0G network.</p>
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
          <p className="text-xs text-muted-foreground mb-2">The provided hash does not match the 0G Network on-chain record.</p>
          <div className="space-y-1.5 text-xs">
            <div>
              <p className="text-muted-foreground">Expected (on-chain):</p>
              <p className="font-mono text-primary break-all">{expectedHash}</p>
            </div>
          </div>
        </div>
      )}

      {verifyState === 'notfound' && (
        <div className="p-4 rounded-xl border border-amber-800 bg-amber-950 bg-opacity-40 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-warning" />
            <p className="text-sm font-bold text-warning">Hash Not Found</p>
          </div>
          <p className="text-xs text-muted-foreground">No delivery record was anchored on-chain for this requestId.</p>
        </div>
      )}
    </div>
  );
}