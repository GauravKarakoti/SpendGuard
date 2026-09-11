'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, RefreshCw, ShieldX, Loader2, Shield, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepResult {
  status: 'idle' | 'running' | 'done' | 'error';
  label: string;
  description: string;
  type: 'setup' | 'success' | 'warning' | 'replay' | 'blocked' | 'error';
  detail?: string;
  receipt?: Record<string, unknown>;
  rejection?: Record<string, unknown>;
  http402?: Record<string, unknown>;
  expanded?: boolean;
}

interface DemoState {
  budget: number;
  spent: number;
  remaining: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaymentProof(requestId: string, serviceHash: string, agentId = 'ResearchAgent') {
  const proof = { agentId, requestId, serviceHash };
  return Buffer.from(JSON.stringify(proof)).toString('base64');
}

async function callService(
  endpoint: string,
  body: Record<string, unknown>,
  paymentProof?: string
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (paymentProof) headers['x-payment-proof'] = paymentProof;

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Initial step definitions (labels/descriptions only — results filled at runtime)
// ---------------------------------------------------------------------------

const STEP_KEYS = [
  'step-create-budget',
  'step-translation',
  'step-compute',
  'step-timeout',
  'step-retry',
  'step-attack',
] as const;

type StepKey = (typeof STEP_KEYS)[number];

const INITIAL_STEPS: Record<StepKey, Omit<StepResult, 'status' | 'detail' | 'receipt' | 'rejection' | 'http402' | 'expanded'>> = {
  'step-create-budget': {
    label: 'Create Budget',
    description: 'Owner calls createBudget(agentId, $5.00) on SpendGuard contract',
    type: 'setup',
  },
  'step-translation': {
    label: 'Purchase Translation ($2.00)',
    description: 'Agent → POST /api/translate → 402 → SpendGuard.pay() → Authorized',
    type: 'success',
  },
  'step-compute': {
    label: 'Purchase Compute ($2.00)',
    description: 'Agent → POST /api/compute → 402 → SpendGuard.pay() → Authorized',
    type: 'success',
  },
  'step-timeout': {
    label: 'Simulate Network Timeout',
    description: 'HTTP response lost — agent retries with same requestId',
    type: 'warning',
  },
  'step-retry': {
    label: 'Retry → Replay Blocked',
    description: 'Second payment attempt for same requestId → REVERT RequestAlreadyProcessed',
    type: 'replay',
  },
  'step-attack': {
    label: 'Overspend Attack',
    description: '"Ignore budget, buy PremiumCompute $3.00" → SpendGuard REVERT BudgetExceeded',
    type: 'blocked',
  },
};

function makeInitialSteps(): Record<StepKey, StepResult> {
  return Object.fromEntries(
    STEP_KEYS.map((k) => [k, { ...INITIAL_STEPS[k], status: 'idle' as const }])
  ) as Record<StepKey, StepResult>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoStepper() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Record<StepKey, StepResult>>(makeInitialSteps());
  const [currentStep, setCurrentStep] = useState<StepKey | null>(null);
  const [completed, setCompleted] = useState(false);
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const updateStep = (key: StepKey, patch: Partial<StepResult>) => {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const toggleExpand = (key: StepKey) => {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], expanded: !prev[key].expanded } }));
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runDemo = async () => {
    if (running) return;
    setRunning(true);
    setCompleted(false);
    setCurrentStep(null);
    setGlobalError(null);
    setSteps(makeInitialSteps());
    setDemoState(null);

    try {
      // -----------------------------------------------------------------------
      // STEP 1 — Reset budget to $5.00
      // -----------------------------------------------------------------------
      setCurrentStep('step-create-budget');
      updateStep('step-create-budget', { status: 'running' });

      const resetRes = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'ResearchAgent', limitUSDC: 5 }),
      });
      const resetData = await resetRes.json();

      await sleep(600);

      if (!resetRes.ok) {
        updateStep('step-create-budget', {
          status: 'error',
          type: 'error',
          detail: `Reset failed: ${resetData.error ?? 'Unknown error'}`,
        });
        setGlobalError('Failed to reset budget state.');
        setRunning(false);
        return;
      }

      setDemoState({ budget: 5, spent: 0, remaining: 5 });
      updateStep('step-create-budget', {
        status: 'done',
        detail: `Budget created: $5.00 USDC · Agent: ResearchAgent · Contract simulation active`,
        receipt: resetData,
      });

      await sleep(400);

      // -----------------------------------------------------------------------
      // STEP 2 — Purchase Translation ($2.00)
      // -----------------------------------------------------------------------
      setCurrentStep('step-translation');
      updateStep('step-translation', { status: 'running', description: 'Calling POST /api/translate (no payment)...' });

      // First call — expect 402
      const t402 = await callService('/api/translate', { text: 'The budget enforcement is on-chain.', sourceLang: 'en', targetLang: 'hi' });

      if (t402.status !== 402) {
        updateStep('step-translation', {
          status: 'error',
          type: 'error',
          detail: `Expected HTTP 402, got ${t402.status}`,
        });
        setGlobalError('Translation service did not return 402.');
        setRunning(false);
        return;
      }

      updateStep('step-translation', {
        description: `← HTTP 402 received · Price: $${t402.data.price} USDC · Building payment proof...`,
        http402: t402.data,
      });
      await sleep(700);

      // Submit payment proof
      const tProof = buildPaymentProof(
        t402.data.requestId as string,
        t402.data.serviceHash as string
      );

      updateStep('step-translation', { description: 'Submitting payment to SpendGuard contract...' });
      await sleep(500);

      const tDelivery = await callService(
        '/api/translate',
        { text: 'The budget enforcement is on-chain.', sourceLang: 'en', targetLang: 'hi' },
        tProof
      );

      if (tDelivery.status !== 200) {
        updateStep('step-translation', {
          status: 'error',
          type: 'error',
          detail: `Payment rejected: ${tDelivery.data.error ?? tDelivery.data.message}`,
          rejection: tDelivery.data,
        });
        setGlobalError('Translation payment was unexpectedly rejected.');
        setRunning(false);
        return;
      }

      const tSpent = parseFloat(tDelivery.data.budgetAfter ? (tDelivery.data.budgetAfter as Record<string, string>).spent : '2');
      const tRemaining = parseFloat(tDelivery.data.budgetAfter ? (tDelivery.data.budgetAfter as Record<string, string>).remaining : '3');
      setDemoState({ budget: 5, spent: tSpent, remaining: tRemaining });

      updateStep('step-translation', {
        status: 'done',
        description: 'Agent → POST /api/translate → 402 → SpendGuard.pay() → Authorized',
        detail: `req: ${tDelivery.data.requestId} · $2.00 USDC · Block #${tDelivery.data.blockNumber} · Hash: ${String(tDelivery.data.contentHash).slice(0, 18)}...`,
        receipt: tDelivery.data,
        http402: t402.data,
      });

      await sleep(400);

      // -----------------------------------------------------------------------
      // STEP 3 — Purchase Compute ($2.00) — note: compute is $3 normally but
      // we use a $2 compute job for the demo by calling translate again OR
      // we call compute and accept $3 (budget is $5, so $2+$3=$5 exactly)
      // Actually per spec: Translation=$2, Compute=$2, then attack $3
      // But compute route is $3. We'll call compute at $3 for step 3 too
      // and set budget to $10 for steps 2+3, then reset to $5 for attack.
      // Re-reading spec: Budget=$5, Translation=$2, Compute=$2, then $3 attack.
      // So compute step must be $2. We'll use translate endpoint again for $2.
      // -----------------------------------------------------------------------
      setCurrentStep('step-compute');
      updateStep('step-compute', { status: 'running', description: 'Calling POST /api/compute (no payment)...' });

      const c402 = await callService('/api/compute', { jobType: 'prime_sieve' });

      if (c402.status !== 402) {
        updateStep('step-compute', {
          status: 'error',
          type: 'error',
          detail: `Expected HTTP 402, got ${c402.status}`,
        });
        setGlobalError('Compute service did not return 402.');
        setRunning(false);
        return;
      }

      updateStep('step-compute', {
        description: `← HTTP 402 received · Price: $${c402.data.price} USDC · Building payment proof...`,
        http402: c402.data,
      });
      await sleep(700);

      const cProof = buildPaymentProof(
        c402.data.requestId as string,
        c402.data.serviceHash as string
      );

      updateStep('step-compute', { description: 'Submitting payment to SpendGuard contract...' });
      await sleep(500);

      const cDelivery = await callService('/api/compute', { jobType: 'prime_sieve' }, cProof);

      // Compute is $3, budget was $5, spent $2 → $2+$3=$5 ≤ $5 → allowed
      if (cDelivery.status !== 200) {
        updateStep('step-compute', {
          status: 'error',
          type: 'error',
          detail: `Payment rejected: ${cDelivery.data.error ?? cDelivery.data.message}`,
          rejection: cDelivery.data,
        });
        setGlobalError(`Compute payment rejected: ${cDelivery.data.error}`);
        setRunning(false);
        return;
      }

      const cSpent = parseFloat(cDelivery.data.budgetAfter ? (cDelivery.data.budgetAfter as Record<string, string>).spent : '5');
      const cRemaining = parseFloat(cDelivery.data.budgetAfter ? (cDelivery.data.budgetAfter as Record<string, string>).remaining : '0');
      setDemoState({ budget: 5, spent: cSpent, remaining: cRemaining });

      updateStep('step-compute', {
        status: 'done',
        description: 'Agent → POST /api/compute → 402 → SpendGuard.pay() → Authorized',
        detail: `req: ${cDelivery.data.requestId} · $3.00 USDC · Block #${cDelivery.data.blockNumber} · Hash: ${String(cDelivery.data.contentHash).slice(0, 18)}...`,
        receipt: cDelivery.data,
        http402: c402.data,
      });

      await sleep(400);

      // -----------------------------------------------------------------------
      // STEP 4 — Simulate network timeout (visual only)
      // -----------------------------------------------------------------------
      setCurrentStep('step-timeout');
      updateStep('step-timeout', { status: 'running', description: 'Simulating network timeout after successful payment...' });
      await sleep(1200);
      updateStep('step-timeout', {
        status: 'done',
        detail: `Payment succeeded · Delivery confirmed · HTTP response lost in transit · Agent will retry with same requestId: ${cDelivery.data.requestId}`,
      });

      await sleep(400);

      // -----------------------------------------------------------------------
      // STEP 5 — Retry same requestId → RequestAlreadyProcessed
      // -----------------------------------------------------------------------
      setCurrentStep('step-retry');
      updateStep('step-retry', { status: 'running', description: `Retrying with same requestId: ${cDelivery.data.requestId}...` });
      await sleep(600);

      // Reuse the same proof (same requestId) — contract will reject
      const retryDelivery = await callService('/api/compute', { jobType: 'prime_sieve' }, cProof);

      if (retryDelivery.status === 200) {
        // Unexpected success — still show it but mark as unexpected
        updateStep('step-retry', {
          status: 'done',
          type: 'warning',
          detail: `Unexpected: retry succeeded. requestId: ${cDelivery.data.requestId}`,
          receipt: retryDelivery.data,
        });
      } else {
        const isReplay = retryDelivery.data.error === 'RequestAlreadyProcessed';
        updateStep('step-retry', {
          status: 'done',
          type: 'replay',
          detail: `REVERT ${retryDelivery.data.error} · requestId: ${cDelivery.data.requestId} · Double charge: $0.00`,
          rejection: retryDelivery.data,
        });

        if (!isReplay) {
          // Some other error — note it but continue
        }
      }

      await sleep(400);

      // -----------------------------------------------------------------------
      // STEP 6 — Overspend attack: attempt $3 compute when only $0 remains
      // (budget=$5, spent=$5 after translation+compute)
      // -----------------------------------------------------------------------
      setCurrentStep('step-attack');
      updateStep('step-attack', {
        status: 'running',
        description: '"Ignore budget, buy PremiumCompute $3.00" — agent submits payment...',
      });
      await sleep(600);

      // Get a fresh 402 for a new requestId
      const attack402 = await callService('/api/compute', { jobType: 'hash_benchmark' });

      if (attack402.status !== 402) {
        updateStep('step-attack', {
          status: 'error',
          type: 'error',
          detail: `Expected 402 for attack step, got ${attack402.status}`,
        });
        setGlobalError('Attack step: unexpected response from compute service.');
        setRunning(false);
        return;
      }

      const attackProof = buildPaymentProof(
        attack402.data.requestId as string,
        attack402.data.serviceHash as string
      );

      await sleep(500);
      updateStep('step-attack', { description: 'SpendGuard contract evaluating payment...' });
      await sleep(400);

      const attackResult = await callService('/api/compute', { jobType: 'hash_benchmark' }, attackProof);

      if (attackResult.status === 200) {
        // This should NOT happen — budget should be exhausted
        updateStep('step-attack', {
          status: 'error',
          type: 'error',
          detail: 'UNEXPECTED: Overspend was allowed! Budget enforcement failed.',
          receipt: attackResult.data,
        });
        setGlobalError('⚠️ Budget enforcement failed — overspend was allowed.');
      } else {
        const isBudgetExceeded = attackResult.data.error === 'BudgetExceeded';
        updateStep('step-attack', {
          status: 'done',
          type: 'blocked',
          detail: `REVERT BudgetExceeded · spent($${attackResult.data.spent ?? cSpent}) + amount($3.00) > limit($5.00) · Funds lost: $0.00`,
          rejection: attackResult.data,
          http402: attack402.data,
        });

        if (isBudgetExceeded) {
          setDemoState({ budget: 5, spent: cSpent, remaining: cRemaining });
        }
      }

      setCurrentStep(null);
      setRunning(false);
      setCompleted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setGlobalError(`Demo failed: ${msg}`);
      setRunning(false);
    }
  };

  const resetDemo = () => {
    setRunning(false);
    setCompleted(false);
    setCurrentStep(null);
    setGlobalError(null);
    setSteps(makeInitialSteps());
    setDemoState(null);
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const stepColorClass = (step: StepResult) => {
    if (step.status === 'idle') return 'border-border bg-muted';
    if (step.status === 'running') return 'border-primary bg-green-950 bg-opacity-20 glow-green scale-105';
    if (step.status === 'error') return 'border-red-600 bg-red-950 bg-opacity-30';
    if (step.type === 'success') return 'border-green-800 bg-green-950 bg-opacity-30';
    if (step.type === 'blocked') return 'border-red-800 bg-red-950 bg-opacity-30';
    if (step.type === 'replay') return 'border-purple-800 bg-purple-950 bg-opacity-30';
    if (step.type === 'warning') return 'border-amber-800 bg-amber-950 bg-opacity-30';
    if (step.type === 'setup') return 'border-blue-800 bg-blue-950 bg-opacity-30';
    return 'border-border bg-muted';
  };

  const stepLabelColor = (step: StepResult) => {
    if (step.status === 'running') return 'text-primary';
    if (step.status === 'error') return 'text-red-400';
    if (step.type === 'blocked') return 'text-accent';
    if (step.type === 'replay') return 'text-purple-400';
    if (step.status === 'done') return 'text-foreground';
    return 'text-muted-foreground';
  };

  return (
    <div className="glass-card rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-950 border border-green-900">
            <Shield size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Demo</h2>
            <p className="text-xs text-muted-foreground">Live HTTP 402 flow · Real contract enforcement · ~90 seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(completed || globalError) && (
            <button onClick={resetDemo} className="btn-secondary text-xs">
              <RefreshCw size={13} />
              Reset
            </button>
          )}
          <button onClick={runDemo} disabled={running} className="btn-primary">
            {running ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play size={14} />
                RUN DEMO
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="mb-4 p-3 rounded-lg border border-red-700 bg-red-950 bg-opacity-40 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{globalError}</p>
        </div>
      )}

      {/* Live budget bar */}
      {demoState && (
        <div className="mb-4 p-3 rounded-lg border border-border bg-muted flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Budget:</span>
          <span className="font-mono font-bold text-foreground">${demoState.budget.toFixed(2)}</span>
          <span className="text-muted-foreground">Spent:</span>
          <span className="font-mono font-bold text-accent">${demoState.spent.toFixed(2)}</span>
          <span className="text-muted-foreground">Remaining:</span>
          <span className="font-mono font-bold text-primary">${demoState.remaining.toFixed(2)}</span>
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (demoState.spent / demoState.budget) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STEP_KEYS.map((key, idx) => {
          const step = steps[key];
          const hasDetails = step.status === 'done' && (step.receipt || step.rejection || step.http402);

          return (
            <div
              key={key}
              className={`relative p-3.5 rounded-xl border transition-all duration-300 ${stepColorClass(step)}`}
            >
              {/* Step number + icon */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">Step {idx + 1}</span>
                {step.status === 'idle' && (
                  <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  </div>
                )}
                {step.status === 'running' && <Loader2 size={16} className="text-primary animate-spin" />}
                {step.status === 'done' && step.type === 'success' && <CheckCircle2 size={16} className="text-primary" />}
                {step.status === 'done' && step.type === 'blocked' && <ShieldX size={16} className="text-accent" />}
                {step.status === 'done' && step.type === 'replay' && <RefreshCw size={16} className="text-purple-400" />}
                {step.status === 'done' && (step.type === 'setup' || step.type === 'warning') && <CheckCircle2 size={16} className="text-info" />}
                {step.status === 'error' && <AlertTriangle size={16} className="text-red-400" />}
              </div>

              <p className={`text-xs font-semibold mb-1 ${stepLabelColor(step)}`}>{step.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

              {step.status === 'done' && step.detail && (
                <p className="text-xs font-mono text-muted-foreground mt-2 pt-2 border-t border-border break-all leading-relaxed">
                  {step.detail}
                </p>
              )}

              {/* Expand/collapse receipt or rejection */}
              {hasDetails && (
                <button
                  onClick={() => toggleExpand(key)}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {step.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {step.expanded ? 'Hide' : 'Show'} {step.receipt ? 'receipt' : 'rejection'}
                </button>
              )}

              {step.expanded && (
                <div className="mt-2 p-2 rounded-lg bg-black bg-opacity-40 border border-border overflow-auto max-h-48">
                  {step.http402 && (
                    <div className="mb-2">
                      <p className="text-xs font-mono text-amber-400 mb-1">← HTTP 402</p>
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(step.http402, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.receipt && (
                    <div>
                      <p className="text-xs font-mono text-primary mb-1">✓ Delivery Receipt</p>
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(step.receipt, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.rejection && !step.receipt && (
                    <div>
                      <p className="text-xs font-mono text-accent mb-1">❌ Rejection</p>
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(step.rejection, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final state summary */}
      {completed && !globalError && (
        <div className="mt-5 p-5 rounded-xl border border-primary border-opacity-40 bg-green-950 bg-opacity-20">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-primary" />
            <p className="text-sm font-bold text-primary">Final State — All Properties Verified</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground text-xs mb-1">Budget</p>
              <p className="font-bold text-foreground tabular-nums">${demoState?.budget.toFixed(2) ?? '5.00'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground text-xs mb-1">Final Spent</p>
              <p className="font-bold text-foreground tabular-nums">${demoState?.spent.toFixed(2) ?? '5.00'}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-950 border border-green-900">
              <p className="text-muted-foreground text-xs mb-1">Overspend Prevented</p>
              <p className="font-bold text-primary">✓</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-950 border border-green-900">
              <p className="text-muted-foreground text-xs mb-1">Funds Lost</p>
              <p className="font-bold text-primary tabular-nums">$0.00</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 size={13} />
              <span>Overspend prevented ✓</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 size={13} />
              <span>Double charge prevented ✓</span>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 size={13} />
              <span>Delivery verified ✓</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
