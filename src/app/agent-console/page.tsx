import React from 'react';
import AppLayout from '@/components/AppLayout';
import ConsoleHeader from './components/ConsoleHeader';
import AgentLogStream from './components/AgentLogStream';
import Http402Viewer from './components/Http402Viewer';
import ContractResponsePanel from './components/ContractResponsePanel';

export default function AgentConsolePage() {
  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        <ConsoleHeader />

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mt-5">
          {/* Left: Log stream */}
          <div className="col-span-1 lg:col-span-2 xl:col-span-2 2xl:col-span-2 flex flex-col gap-4">
            <AgentLogStream />
          </div>

          {/* Right: 402 + contract panels */}
          <div className="col-span-1 flex flex-col gap-4">
            <Http402Viewer />
            <ContractResponsePanel />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}