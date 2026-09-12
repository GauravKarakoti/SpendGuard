'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import AppLayout from '@/components/AppLayout';
import ConsoleHeader from './components/ConsoleHeader';
import Http402Viewer from './components/Http402Viewer';
import ContractResponsePanel from './components/ContractResponsePanel';
import AgentCommandPanel from '@/app/components/AgentCommandPanel'; // Verify paths match your structure
import ProviderSelectionPanel from '@/app/components/ProviderSelectionPanel';
import { Loader2, Shield } from 'lucide-react';
import Link from 'next/link';

export default function AgentConsolePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWalletAndAgent = async () => {
      const win = window as any;
      if (typeof window === 'undefined' || !win.ethereum) {
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(win.ethereum);
        const accounts = await provider.send('eth_accounts', []); // Don't force prompt on console page, just check
        
        if (accounts.length > 0) {
          const address = accounts[0];
          setWalletAddress(address);

          const res = await fetch(`/api/agent?owner=${address}`);
          if (res.ok) {
            const data = await res.json();
            if (data.agent && data.agent.agentName) {
              setActiveAgentName(data.agent.agentName);
            }
          }
        }
      } catch (err) {
        console.error("Error verifying wallet:", err);
      } finally {
        setLoading(false);
      }
    };

    checkWalletAndAgent();

    const win = window as any;
    if (win.ethereum) {
      win.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          window.location.reload();
        } else {
          setWalletAddress(null);
          setActiveAgentName(null);
        }
      });
    }
  }, []);

  if (loading) {
    return (
      <AppLayout agentName={activeAgentName as string}>
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // If they somehow navigate here without setting up an agent first
  if (!walletAddress || !activeAgentName) {
    return (
      <AppLayout agentName={activeAgentName as string}>
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6">
          <Shield size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-foreground mb-2">Agent Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            You must connect your wallet and register an agent on the main dashboard before using the console.
          </p>
          <Link href="/" className="btn-primary px-6 py-2 rounded-lg text-sm">
            Go to Dashboard
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout agentName={activeAgentName as string}>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        <ConsoleHeader agentName={activeAgentName} />

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mt-5">
          {/* Left Column: Command & Logs */}
          <div className="col-span-1 lg:col-span-2 xl:col-span-2 2xl:col-span-2 flex flex-col gap-4">
            {/* The Command Interface is now the primary interaction point here */}
            <div className="h-[250px]">
              <AgentCommandPanel ownerAddress={walletAddress} />
            </div>
          </div>

          {/* Right Column: Providers, 402 Traffic & Contract Responses */}
          <div className="col-span-1 flex flex-col gap-4">
            <ProviderSelectionPanel />
            <Http402Viewer />
            <ContractResponsePanel />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}