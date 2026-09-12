'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import AppLayout from '@/components/AppLayout';
import AuditTable from './components/AuditTable';
import DeliveryHashVerifier from './components/DeliveryHashVerifier';
import AuditSummaryBar from './components/AuditSummaryBar';

export default function AuditTrailPage() {
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    const checkWallet = async () => {
      const win = window as any;
      if (typeof window !== 'undefined' && win.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(win.ethereum);
          // Check for already connected accounts without forcing a popup
          const accounts = await provider.send('eth_accounts', []);
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (err) {
          console.error("Failed to check wallet:", err);
        }
      }
    };

    checkWallet();

    // Listen for account changes
    const win = window as any;
    if (win.ethereum) {
      win.ethereum.on('accountsChanged', (accounts: string[]) => {
        setWalletAddress(accounts.length > 0 ? accounts[0] : '');
      });
    }
  }, []);

  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Audit Trail</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cryptographic record of every payment request, authorization, and delivery
            </p>
          </div>
        </div>

        {/* Summary bar */}
        <AuditSummaryBar ownerAddress={walletAddress} />

        {/* Main layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mt-5">
          <div className="xl:col-span-2 2xl:col-span-2">
            <AuditTable ownerAddress={walletAddress} />
          </div>
          <div className="xl:col-span-1 2xl:col-span-1">
            <DeliveryHashVerifier />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}