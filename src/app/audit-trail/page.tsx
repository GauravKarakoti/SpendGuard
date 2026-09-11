import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuditTable from './components/AuditTable';
import DeliveryHashVerifier from './components/DeliveryHashVerifier';
import AuditSummaryBar from './components/AuditSummaryBar';

export default function AuditTrailPage() {
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
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs">
              Export CSV
            </button>
            <button className="btn-secondary text-xs">
              Export JSON
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <AuditSummaryBar />

        {/* Main layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 2xl:grid-cols-3 gap-4 mt-5">
          <div className="xl:col-span-2 2xl:col-span-2">
            <AuditTable />
          </div>
          <div className="xl:col-span-1 2xl:col-span-1">
            <DeliveryHashVerifier />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}