'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Loader2, Bot, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentCommandPanel({ ownerAddress }: { ownerAddress: string }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, result]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setLogs(prev => [...prev, `> User Command: ${prompt}`]);
    setResult(null);

    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAddress, prompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');

      setLogs(prev => [...prev, ...data.logs]);
      setResult(data.result);
      toast.success('Agent task completed!');
      setPrompt('');
    } catch (err: any) {
      setLogs(prev => [...prev, `[ERROR] ${err.message}`]);
      toast.error('Task failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl flex flex-col h-[700px] border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Agent Command Terminal</h3>
        </div>
        <button onClick={() => { setLogs([]); setResult(null); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Clear Terminal">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2 bg-black/40">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Bot size={32} className="mb-3 opacity-50" />
            <p>Agent standing by.</p>
            <p className="mt-1">Try: "Translate Hello" or "Run compute job"</p>
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <div key={i} className={`animate-fade-in ${log.includes('[ERROR]') ? 'text-accent' : log.startsWith('>') ? 'text-cyan-400 font-bold mt-2' : 'text-muted-foreground'}`}>
                {log}
              </div>
            ))}
            
            {/* SUCCESS RESULT BLOCK */}
            {result && (
              <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-md text-primary animate-fade-in">
                <span className="block font-semibold mb-1">FINAL DELIVERED RESOURCE:</span>
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </div>
            )}
            
            {/* INLINE LOADING INDICATOR */}
            {loading && (
              <div className="flex items-center gap-2 mt-2 text-cyan-400/80 animate-pulse font-bold">
                <Loader2 size={14} className="animate-spin" />
                <span>Negotiating x402 paywall & awaiting on-chain confirmation...</span>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command Input Area */}
      <form onSubmit={handleCommand} className="p-3 border-t border-border bg-muted/30 flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors disabled:opacity-50 font-mono"
          placeholder="Issue a command to your agent..."
        />
        <button 
          type="submit" 
          disabled={loading || !prompt.trim()} 
          className="bg-primary text-primary-foreground px-4 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}