'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import BudgetHeroCard from './components/BudgetHeroCard';
import KpiCards from './components/KpiCards';
import LiveActivityFeed from './components/LiveActivityFeed';
import AgentStatusPanel from './components/AgentStatusPanel';
import ProviderSelectionPanel from './components/ProviderSelectionPanel';
import TaglineBar from './components/TaglineBar';
import UserAgentRegistration from './components/UserAgentRegistration';
import FundAgentPanel from './components/FundAgentPanel';
import AgentCommandPanel from './components/AgentCommandPanel';
import { Shield, Wallet, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';

export default function MainDashboardPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [activeAgentAddress, setActiveAgentAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkWalletAndAgent = async () => {
    const win = window as any;
    if (typeof window === 'undefined' || !win.ethereum) {
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(win.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);

        const res = await fetch(`/api/agent?owner=${address}`);
        const contentType = res.headers.get('content-type');

        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`API returned non-JSON response (${res.status}). Check if route file exists.`);
        }

        const data = await res.json();
        if (data.agent && data.agent.agentName) {
          setActiveAgentName(data.agent.agentName);
          setActiveAgentAddress(data.agent.agentAddress);
        }
      }
    } catch (err) {
      console.error("Error verifying wallet and agent setup:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkWalletAndAgent();

    const win = window as any;
    if (win.ethereum) {
      win.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          window.location.reload();
        } else {
          setWalletAddress(null);
          setActiveAgentName(null);
          setActiveAgentAddress(null);
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

  if (!walletAddress) {
    return (
      <AppLayout agentName={activeAgentName as string}>
        <div className="px-6 py-12 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center">
          <div className="p-4 rounded-2xl bg-green-950 border border-green-900 mb-6">
            <Shield size={36} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Welcome to SpendGuard</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Connect your Web3 wallet to manage your isolated autonomous agent vault and spending limits.
          </p>
          <button onClick={checkWalletAndAgent} className="btn-primary px-6 py-3 text-sm flex items-center gap-2">
            <Wallet size={16} />
            Connect Web3 Wallet
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!activeAgentName) {
    return (
      <AppLayout agentName={activeAgentName as string}>
        <div className="px-6 py-10 max-w-2xl mx-auto min-h-[80vh] flex flex-col justify-center">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Deploy Your Agent</h1>
            <p className="text-sm text-muted-foreground mt-1">
              No agent found for wallet <span className="font-mono text-foreground">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>. Complete the registration below to get started.
            </p>
          </div>
          <UserAgentRegistration userAddress={walletAddress} onRegistered={() => window.location.reload()} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout agentName={activeAgentName as string}>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              SpendGuard <span className="text-xs font-mono font-normal text-muted-foreground ml-2">({activeAgentName})</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Programmable spending controls for autonomous AI agents
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
            <span className="font-mono">Sepolia Testnet</span>
          </div>
        </div>

        <TaglineBar />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="col-span-1 md:col-span-2">
            <BudgetHeroCard agentName={activeAgentName} />
          </div>
          <KpiCards />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="col-span-1 lg:col-span-2">
            <LiveActivityFeed />
          </div>
          <div className="col-span-1 flex flex-col gap-4">
            <AgentStatusPanel agentName={activeAgentName} />
            {activeAgentAddress && <FundAgentPanel agentAddress={activeAgentAddress} />}
            <ProviderSelectionPanel />
            {walletAddress && <AgentCommandPanel ownerAddress={walletAddress} />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}