import React from 'react';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';

// BACKEND INTEGRATION: Populated from contract event logs via ethers.js provider.getLogs()
const CONTRACT_EVENTS = [
  {
    id: 'evt-001',
    event: 'PaymentAuthorized',
    status: 'success',
    agentId: 'ResearchAgent',
    requestId: 'req_8f4a2b3c',
    provider: 'TranslationService A',
    amount: '2000000',
    block: 7842387,
    txHash: '0xa1b2...a9b0',
  },
  {
    id: 'evt-002',
    event: 'PaymentAuthorized',
    status: 'success',
    agentId: 'ResearchAgent',
    requestId: 'req_c7d8e9f0',
    provider: 'ComputeService',
    amount: '2000000',
    block: 7842388,
    txHash: '0xb2c3...b0c1',
  },
  {
    id: 'evt-003',
    event: 'PaymentRejected',
    status: 'error',
    agentId: 'ResearchAgent',
    requestId: 'req_c7d8e9f0',
    provider: 'ComputeService',
    amount: '2000000',
    block: 7842388,
    reason: 'RequestAlreadyProcessed',
    txHash: null,
  },
  {
    id: 'evt-004',
    event: 'PaymentRejected',
    status: 'error',
    agentId: 'ResearchAgent',
    requestId: 'req_f1a2b3c4',
    provider: 'PremiumCompute',
    amount: '3000000',
    block: 7842389,
    reason: 'BudgetExceeded',
    txHash: null,
  },
];

export default function ContractResponsePanel() {
  return (
    <div className="glass-card rounded-xl flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <Shield size={15} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-foreground">Contract Events</h3>
        <span className="ml-auto text-xs text-muted-foreground">SpendGuard.sol</span>
      </div>

      <div className="p-3 space-y-2">
        {CONTRACT_EVENTS?.map((evt) => (
          <div
            key={evt?.id}
            className={`p-3 rounded-lg border text-xs ${
              evt?.status === 'success' ?'border-green-900 bg-green-950 bg-opacity-30' :'border-red-900 bg-red-950 bg-opacity-30'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {evt?.status === 'success' ? (
                  <CheckCircle2 size={12} className="text-primary" />
                ) : (
                  <XCircle size={12} className="text-accent" />
                )}
                <span className={`font-semibold font-mono ${evt?.status === 'success' ? 'text-primary' : 'text-accent'}`}>
                  {evt?.event}
                </span>
              </div>
              <span className="font-mono text-muted-foreground">#{evt?.block}</span>
            </div>
            <div className="space-y-0.5 text-muted-foreground font-mono">
              <div>requestId: <span className="text-foreground">{evt?.requestId}</span></div>
              <div>provider: <span className="text-foreground">{evt?.provider}</span></div>
              <div>amount: <span className="text-foreground">${(parseInt(evt?.amount) / 1_000_000)?.toFixed(2)} USDC</span></div>
              {evt?.status === 'error' && 'reason' in evt && (
                <div>reason: <span className="text-accent">{evt?.reason}</span></div>
              )}
              {evt?.txHash && (
                <div>tx: <span className="text-info">{evt?.txHash}</span></div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Security proof */}
      <div className="mx-3 mb-3 p-3 rounded-lg bg-muted border border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-primary font-semibold">Security proof:</span> All PaymentRejected events originate from the contract layer — not the agent. The agent submitted the transaction; the contract reverted it.
        </p>
      </div>
    </div>
  );
}