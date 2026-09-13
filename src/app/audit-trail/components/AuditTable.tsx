'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';

type SortKey = 'timestamp' | 'amount' | 'status' | 'provider' | 'block';
type SortDir = 'asc' | 'desc';

interface AuditRecord {
  id: string;
  requestId: string;
  provider: string;
  amount: number;
  paymentTx: string | null;
  status: 'AUTHORIZED' | 'BUDGET_EXCEEDED' | 'REPLAY_BLOCKED' | 'PENDING';
  timestamp: string;
  block: number;
  rejectReason: string | null;
  contentHash: string | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'AUTHORIZED') return <span className="status-badge-authorized">✓ AUTHORIZED</span>;
  if (status === 'BUDGET_EXCEEDED') return <span className="status-badge-blocked">🛡 BLOCKED</span>;
  if (status === 'REPLAY_BLOCKED') return <span className="status-badge-replay">↺ REPLAY</span>;
  return <span className="status-badge-pending">{status}</span>;
}

export default function AuditTable({ ownerAddress }: { ownerAddress: string }) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 6;

  useEffect(() => {
    async function fetchAuditLogs() {
      if (!ownerAddress) return; 
      
      setLoading(true); 
      
      try {
        const res = await fetch(`/api/logs/audit?owner=${ownerAddress.toLowerCase()}`);
        const data = await res.json();
        
        const formatted = data.map((log: any) => ({
          id: log.id,
          requestId: log.requestId || 'Unknown',
          provider: log.provider || 'N/A',
          amount: parseFloat(log.pricePaid || "0"),
          paymentTx: log.txHash,
          status: log.status === 'COMPLETED' || log.status === 'SIGNED_OFFCHAIN' || log.status === 'PAID' ? 'AUTHORIZED' : log.status,
          timestamp: new Date(log.createdAt).toLocaleString(),
          block: 0, 
          rejectReason: log.status === 'BUDGET_EXCEEDED' ? 'Budget Limit Reached' : null,
          contentHash: log.contentHash
        }));

        setRecords(formatted);
      } catch (err) {
        console.error("Failed to fetch audit logs", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditLogs();
  }, [ownerAddress]);

  const filtered = records
    .filter((r) => {
      const matchSearch =
        search === '' ||
        r.requestId.toLowerCase().includes(search.toLowerCase()) ||
        r.provider.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'timestamp' || sortKey === 'block') cmp = a.block - b.block;
      if (sortKey === 'amount') cmp = a.amount - b.amount;
      if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      if (sortKey === 'provider') cmp = a.provider.localeCompare(b.provider);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
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

  if (loading) return <div className="glass-card rounded-xl h-64 animate-pulse bg-muted flex items-center justify-center text-muted-foreground">Loading on-chain audit trail...</div>;

  return (
    <div className="glass-card rounded-xl flex flex-col">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-muted rounded-lg px-3 py-2 border border-border">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search requestId or provider..."
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
        </div>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} records</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              {[
                { key: null, label: '' },
                { key: null, label: 'Request ID' },
                { key: 'provider' as SortKey, label: 'Provider' },
                { key: 'amount' as SortKey, label: 'Amount' },
                { key: 'status' as SortKey, label: 'Status' },
                { key: 'timestamp' as SortKey, label: 'Timestamp' },
              ].map((col, i) => (
                <th
                  key={`col-${i}`}
                  className={`px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap ${col.key ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}
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
                    className={`transition-all duration-150 cursor-pointer ${isExpanded ? 'bg-muted' : 'hover:bg-muted hover:bg-opacity-50'} ${record.status === 'BUDGET_EXCEEDED' ? 'bg-red-950 bg-opacity-10' : ''} ${record.status === 'REPLAY_BLOCKED' ? 'bg-purple-950 bg-opacity-10' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <td className="px-4 py-3">
                      {isExpanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3"><span className="font-mono text-foreground">{record.requestId}</span></td>
                    <td className="px-4 py-3"><span className="font-medium text-foreground whitespace-nowrap truncate block max-w-36">{record.provider}</span></td>
                    <td className="px-4 py-3"><span className={`font-mono font-semibold tabular-nums ${record.status !== 'AUTHORIZED' ? 'text-accent' : 'text-foreground'}`}>{record.amount.toFixed(4)} 0G</span></td>
                    <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                    <td className="px-4 py-3"><span className="font-mono text-muted-foreground whitespace-nowrap">{record.timestamp}</span></td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${record.id}-expanded`}>
                      <td colSpan={6} className="px-6 pb-4 pt-2 bg-muted bg-opacity-30">
                         <div className="space-y-2">
                           {record.paymentTx && (
                             <p className="text-xs text-muted-foreground"><strong>EIP-712 Signature (Sent to Provider):</strong> <span className="font-mono text-primary break-all select-all">{record.paymentTx}</span></p>
                           )}
                           {record.rejectReason && <p className="text-xs text-accent"><strong>Revert Reason:</strong> {record.rejectReason}</p>}
                           {record.contentHash && record.contentHash !== 'NoHashProvided' && (
                              <p className="text-xs text-info mt-1">
                                <strong>Content Hash:</strong> <span className="font-mono break-all select-all">{record.contentHash}</span>
                              </p>
                           )}
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

      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} records
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-40">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-40">
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}