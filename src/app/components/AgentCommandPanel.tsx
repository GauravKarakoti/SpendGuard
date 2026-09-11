'use client';

import React, { useState } from 'react';
import { Terminal, Send, Loader2, Bot } from 'lucide-react';
import { toast } from 'sonner';

interface AgentCommandPanelProps {
  ownerAddress: string;
}

export default function AgentCommandPanel({ ownerAddress }: AgentCommandPanelProps) {
    console.log('AgentCommandPanel ownerAddress:', ownerAddress);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [executionData, setExecutionData] = useState<{ logs: string[], result: any } | null>(null);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setExecutionData(null);
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            ownerAddress: ownerAddress, // Must match the backend expectation
            prompt 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent execution failed');

      setExecutionData({ logs: data.logs, result: data.result });
      toast.success('Agent task completed successfully!');
      setPrompt('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Task failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl flex flex-col h-full border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
        <Bot size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Agent Command Interface</h3>
      </div>

      <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2 min-h-[160px] bg-black/20">
        {executionData ? (
          <>
            {executionData.logs.map((log, i) => (
              <div key={i} className="text-muted-foreground animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                <span className="text-primary mr-2">{'>'}</span>{log}
              </div>
            ))}
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-md text-primary animate-fade-in" style={{ animationDelay: `${executionData.logs.length * 150}ms` }}>
              <span className="block font-semibold mb-1">FINAL OUTPUT:</span>
              {typeof executionData.result === 'string' ? executionData.result : JSON.stringify(executionData.result, null, 2)}
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Terminal size={24} className="mb-2" />
            <p>Awaiting task instructions...</p>
            <p className="mt-1 text-[10px]">Try: "Translate Hello to Spanish" or "Run compute job"</p>
          </div>
        )}
        <form onSubmit={handleCommand} className="p-3 border-t border-border bg-muted/30 flex gap-2">
            <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors disabled:opacity-50"
            placeholder="Issue a command to your agent..."
            />
            <button 
            type="submit" 
            disabled={loading || !prompt.trim()} 
            className="bg-primary text-primary-foreground px-3 rounded-lg flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
            >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
        </form>
      </div>
    </div>
  );
}