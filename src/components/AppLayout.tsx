'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  agentName?: string; // Make agentName an optional prop
}

export default function AppLayout({ children, agentName }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Sidebar 
        collapsed={collapsed} 
        onToggle={() => setCollapsed((c) => !c)} 
        agentName={agentName || 'No Agent'} // Pass it down with a fallback
      />
      <main
        className={`transition-all duration-300 ease-in-out min-h-screen ${
          collapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {children}
      </main>
    </div>
  );
}