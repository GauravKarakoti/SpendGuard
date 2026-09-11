import React from 'react';
import AppLayout from '@/components/AppLayout';
import BudgetHeroCard from './components/BudgetHeroCard';
import KpiCards from './components/KpiCards';
import LiveActivityFeed from './components/LiveActivityFeed';
import DemoStepper from './components/DemoStepper';
import AgentStatusPanel from './components/AgentStatusPanel';
import ProviderSelectionPanel from './components/ProviderSelectionPanel';
import TaglineBar from './components/TaglineBar';

export default function MainDashboardPage() {
  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              SpendGuard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Programmable spending controls for autonomous AI agents
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green" />
            <span className="font-mono">Sepolia Testnet · Block #7,842,391</span>
          </div>
        </div>

        {/* Tagline */}
        <TaglineBar />

        {/* Budget Hero + KPI row */}
        {/* Grid plan: 1 hero (col-span-2) + 2 KPIs = 4-col row 1; 4 KPIs row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 mt-5">
          {/* Hero spans 2 cols */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 2xl:col-span-2">
            <BudgetHeroCard />
          </div>
          {/* KPI 1 + 2 */}
          <KpiCards />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mt-4">
          {/* Live Activity Feed — 2 cols */}
          <div className="col-span-1 lg:col-span-2 xl:col-span-2 2xl:col-span-2">
            <LiveActivityFeed />
          </div>
          {/* Right column */}
          <div className="col-span-1 flex flex-col gap-4">
            <AgentStatusPanel />
            <ProviderSelectionPanel />
          </div>
        </div>

        {/* Demo Stepper — full width */}
        <div className="mt-4">
          <DemoStepper />
        </div>
      </div>
    </AppLayout>
  );
}