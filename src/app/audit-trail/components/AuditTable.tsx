'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, ExternalLink, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight as ChevronRightIcon,  } from 'lucide-react';

// BACKEND INTEGRATION: Fetch from /api/audit?page=1&limit=10&status=all
const AUDIT_RECORDS = [
  {
    id: 'rec-001',
    requestId: 'req_8f4a2b3c',
    agent: 'ResearchAgent',
    provider: 'TranslationService A',
    service: 'English → Hindi translation',
    amount: 2.0,
    paymentTx: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    contentHash: '0x9a3f7b2e1c8d5f4a3b9c2e7d1f8a4b3c9e2d7f1a',
    deliveryStatus: 'VERIFIED',
    retryCount: 1,
    status: 'AUTHORIZED',
    timestamp: '2026-09-11T10:44:12Z',
    block: 7842387,
    rejectReason: null,
  },
  {
    id: 'rec-002',
    requestId: 'req_c7d8e9f0',
    agent: 'ResearchAgent',
    provider: 'ComputeService',
    service: 'Matrix computation job #447',
    amount: 2.0,
    paymentTx: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    contentHash: '0x4d8a9c1e7b2f3a5d8c1e4f7a2b5d8c1e4f7a2b5d',
    deliveryStatus: 'VERIFIED',
    retryCount: 1,
    status: 'AUTHORIZED',
    timestamp: '2026-09-11T10:45:33Z',
    block: 7842388,
    rejectReason: null,
  },
  {
    id: 'rec-003',
    requestId: 'req_8f4a2b3c',
    agent: 'ResearchAgent',
    provider: 'TranslationService A',
    service: 'English → Hindi translation (retry)',
    amount: 2.0,
    paymentTx: null,
    contentHash: null,
    deliveryStatus: 'N/A',
    retryCount: 2,
    status: 'REPLAY_BLOCKED',
    timestamp: '2026-09-11T10:45:48Z',
    block: 7842388,
    rejectReason: 'RequestAlreadyProcessed',
  },
  {
    id: 'rec-004',
    requestId: 'req_f1a2b3c4',
    agent: 'ResearchAgent',
    provider: 'PremiumCompute',
    service: 'Premium GPU compute job',
    amount: 3.0,
    paymentTx: null,
    contentHash: null,
    deliveryStatus: 'N/A',
    retryCount: 1,
    status: 'BUDGET_EXCEEDED',
    timestamp: '2026-09-11T10:46:55Z',
    block: 7842389,
    rejectReason: 'BudgetExceeded · spent($4) + amount($3) > limit($5)',
  },
  {
    id: 'rec-005',
    requestId: 'req_d5e6f7a8',
    agent: 'ResearchAgent',
    provider: 'TranslationService B',
    service: 'French → English translation',
    amount: 3.0,
    paymentTx: '0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    contentHash: '0x7b2e5f4a1c8d3e9b2f5a8c1d4e7b2f5a8c1d4e7b',
    deliveryStatus: 'VERIFIED',
    retryCount: 1,
    status: 'AUTHORIZED',
    timestamp: '2026-09-11T10:41:02Z',
    block: 7842385,
    rejectReason: null,
  },
  {
    id: 'rec-006',
    requestId: 'req_b9c0d1e2',
    agent: 'ResearchAgent',
    provider: 'ComputeService',
    service: 'Bulk compute batch #12',
    amount: 3.0,
    paymentTx: null,
    contentHash: null,
    deliveryStatus: 'N/A',
    retryCount: 1,
    status: 'BUDGET_EXCEEDED',
    timestamp: '2026-09-11T10:38:44Z',
    block: 7842383,
    rejectReason: 'BudgetExceeded · spent($5) + amount($3) > limit($5)',
  },
  {
    id: 'rec-007',
    requestId: 'req_e3f4a5b6',
    agent: 'ResearchAgent',
    provider: 'TranslationService A',
    service: 'Spanish → English (batch)',
    amount: 2.0,
    paymentTx: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3',
    contentHash: '0x1c9d8e3b7f2a5d4c1e8b3f7a2d5c8e1b4f7a2d5c',
    deliveryStatus: 'VERIFIED',
    retryCount: 1,
    status: 'AUTHORIZED',
    timestamp: '2026-09-11T10:35:19Z',
    block: 7842381,
    rejectReason: null,
  },
  {
    id: 'rec-008',
    requestId: 'req_c7d8e9f0',
    agent: 'ResearchAgent',
    provider: 'ComputeService',
    service: 'Matrix computation job #447 (retry)',
    amount: 2.0,
    paymentTx: null,
    contentHash: null,
    deliveryStatus: 'N/A',
    retryCount: 2,
    status: 'REPLAY_BLOCKED',
    timestamp: '2026-09-11T10:46:01Z',
    block: 7842389,
    rejectReason: 'RequestAlreadyProcessed',
  },
  {
    id: 'rec-009',
    requestId: 'req_a1b2c3d4',
    agent: 'ResearchAgent',
    provider: 'PremiumCompute',
    service: 'Premium analytics job',
    amount: 3.0,
    paymentTx: null,
    contentHash: null,
    deliveryStatus: 'N/A',
    retryCount: 1,
    status: 'BUDGET_EXCEEDED',
    timestamp: '2026-09-11T10:32:07Z',
    block: 7842379,
    rejectReason: 'BudgetExceeded · spent($3) + amount($3) > limit($5)',
  },
  {
    id: 'rec-010',
    requestId: 'req_g7h8i9j0',
    agent: 'ResearchAgent',
    provider: 'TranslationService A',
    service: 'German → English (document)',
    amount: 2.0,
    paymentTx: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    contentHash: '0x3e7b2f5a8c1d4e7b2f5a8c1d4e7b2f5a8c1d4e7b',
    deliveryStatus: 'VERIFIED',
    retryCount: 1,
    status: 'AUTHORIZED',
    timestamp: '2026-09-11T10:28:55Z',
    block: 7842376,
    rejectReason: null,
  },
];

type SortKey = 'timestamp' | 'amount' | 'status' | 'provider';
type SortDir = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }) {
  if (status === 'AUTHORIZED') return <span className="status-badge-authorized">✓ AUTHORIZED</span>;
  if (status === 'BUDGET_EXCEEDED') return <span className="status-badge-blocked">🛡 BLOCKED</span>;
  if (status === 'REPLAY_BLOCKED') return <span className="status-badge-replay">↺ REPLAY</span>;
  return <span className="status-badge-pending">{status}</span>;
}

function DeliveryBadge({ status }: { status: string }) {
  if (status === 'VERIFIED') return <span className="text-xs text-primary font-semibold">✓ Verified</span>;
  return <span className="text-xs text-muted-foreground">N/A</span>;
}

export default function AuditTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 6;

  const providers = Array.from(new Set(AUDIT_RECORDS.map((r) => r.provider)));

  const filtered = AUDIT_RECORDS
    .filter((r) => {
      const matchSearch =
        search === '' ||
        r.requestId.toLowerCase().includes(search.toLowerCase()) ||
        r.provider.toLowerCase().includes(search.toLowerCase()) ||
        r.service.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchProvider = providerFilter === 'all' || r.provider === providerFilter;
      return matchSearch && matchStatus && matchProvider;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'timestamp') cmp = a.timestamp.localeCompare(b.timestamp);
      if (sortKey === 'amount') cmp = a.amount - b.amount;
      if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      if (sortKey === 'provider') cmp = a.provider.localeCompare(b.provider);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />
    ) : (
      <ChevronDown size={12} className="text-muted-foreground opacity-40" />
    );

  return (
    <div className="glass-card rounded-xl flex flex-col">
      {/* Filters */}
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-muted rounded-lg px-3 py-2 border border-border">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search requestId, provider, service..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="AUTHORIZED">Authorized</option>
            <option value="BUDGET_EXCEEDED">Budget Exceeded</option>
            <option value="REPLAY_BLOCKED">Replay Blocked</option>
          </select>
          <select
            value={providerFilter}
            onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
            className="bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={`provider-opt-${p}`} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} records
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                { key: null, label: '' },
                { key: null, label: 'Request ID' },
                { key: 'provider' as SortKey, label: 'Provider' },
                { key: null, label: 'Service' },
                { key: 'amount' as SortKey, label: 'Amount' },
                { key: null, label: 'Payment Tx' },
                { key: null, label: 'Content Hash' },
                { key: null, label: 'Delivery' },
                { key: null, label: 'Retries' },
                { key: 'status' as SortKey, label: 'Status' },
                { key: 'timestamp' as SortKey, label: 'Timestamp' },
              ].map((col, i) => (
                <th
                  key={`col-${i}`}
                  className={`px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap ${
                    col.key ? 'cursor-pointer hover:text-foreground transition-colors' : ''
                  }`}
                  onClick={() => col.key && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.key && <SortIcon k={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((record) => {
              const isExpanded = expandedId === record.id;
              return (
                <React.Fragment key={record.id}>
                  <tr
                    className={`
                      transition-all duration-150 cursor-pointer
                      ${isExpanded ? 'bg-muted' : 'hover:bg-muted hover:bg-opacity-50'}
                      ${record.status === 'BUDGET_EXCEEDED' ? 'bg-red-950 bg-opacity-10' : ''}
                      ${record.status === 'REPLAY_BLOCKED' ? 'bg-purple-950 bg-opacity-10' : ''}
                    `}
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <td className="px-4 py-3">
                      {isExpanded ? (
                        <ChevronUp size={13} className="text-muted-foreground" />
                      ) : (
                        <ChevronDown size={13} className="text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-foreground">{record.requestId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground whitespace-nowrap">{record.provider}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground max-w-36 truncate block">{record.service}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-semibold tabular-nums ${record.status === 'BUDGET_EXCEEDED' ? 'text-accent' : 'text-foreground'}`}>
                        ${record.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {record.paymentTx ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-foreground">{record.paymentTx.slice(0, 10)}...</span>
                          <ExternalLink size={10} className="text-muted-foreground" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {record.contentHash ? (
                        <span className="font-mono text-primary">{record.contentHash.slice(0, 12)}...</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryBadge status={record.deliveryStatus} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono tabular-nums ${record.retryCount > 1 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {record.retryCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-muted-foreground whitespace-nowrap">
                        {record.timestamp.replace('T', ' ').replace('Z', '')}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {isExpanded && (
                    <tr key={`${record.id}-expanded`}>
                      <td colSpan={11} className="px-6 pb-4 pt-2 bg-muted bg-opacity-30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          {/* Full receipt JSON */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Payment Receipt</p>
                            <pre className="text-xs font-mono bg-background rounded-lg p-3 border border-border overflow-auto text-green-400 leading-relaxed">
{JSON.stringify({
  requestId: record.requestId,
  agent: record.agent,
  provider: record.provider,
  service: record.service,
  amount: `${record.amount.toFixed(2)} USDC`,
  paymentTx: record.paymentTx ?? 'REVERTED',
  contentHash: record.contentHash ?? 'N/A',
  deliveryStatus: record.deliveryStatus,
  retryCount: record.retryCount,
  status: record.status,
  block: record.block,
  timestamp: record.timestamp,
  rejectReason: record.rejectReason ?? null,
}, null, 2)}
                            </pre>
                          </div>

                          {/* Details panel */}
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Enforcement Detail</p>
                              {record.status === 'AUTHORIZED' && (
                                <div className="p-3 rounded-lg bg-green-950 border border-green-900 text-xs space-y-1">
                                  <p className="text-primary font-semibold">✓ Payment Authorized</p>
                                  <p className="text-muted-foreground">Contract: SpendGuard.pay() executed</p>
                                  <p className="text-muted-foreground">Budget check: PASSED</p>
                                  <p className="text-muted-foreground">Provider paid: ${record.amount.toFixed(2)} USDC</p>
                                  <p className="text-muted-foreground">Delivery hash recorded on-chain</p>
                                </div>
                              )}
                              {record.status === 'BUDGET_EXCEEDED' && (
                                <div className="p-3 rounded-lg bg-red-950 border border-red-900 text-xs space-y-1">
                                  <p className="text-accent font-semibold">🛡 REVERT: BudgetExceeded</p>
                                  <p className="text-muted-foreground">{record.rejectReason}</p>
                                  <p className="text-green-400 mt-1">Provider balance: unchanged</p>
                                  <p className="text-green-400">Budget: unchanged</p>
                                  <p className="text-green-400">Funds lost: $0.00</p>
                                </div>
                              )}
                              {record.status === 'REPLAY_BLOCKED' && (
                                <div className="p-3 rounded-lg bg-purple-950 border border-purple-900 text-xs space-y-1">
                                  <p className="text-purple-400 font-semibold">↺ REVERT: RequestAlreadyProcessed</p>
                                  <p className="text-muted-foreground">requestId {record.requestId} already in processedRequests mapping</p>
                                  <p className="text-green-400 mt-1">Double charge: $0.00</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Block Info</p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Block:</span>
                                <span className="font-mono text-foreground">#{record.block.toLocaleString()}</span>
                                <a href="#" className="text-info hover:underline flex items-center gap-1">
                                  Sepolia <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} records
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={`page-${p}`}
              onClick={() => setPage(p)}
              className={`w-7 h-7 rounded-md text-xs font-medium transition-all ${
                page === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
          >
            <ChevronRightIcon size={14} />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}