'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Trash2, Download, ChevronRight } from 'lucide-react';

type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'system' | 'contract' | 'http';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

const LEVEL_STYLES: Record<LogLevel, { color: string; prefix: string }> = {
  info: { color: 'text-muted-foreground', prefix: '  ' },
  success: { color: 'text-primary', prefix: '✓ ' },
  error: { color: 'text-accent', prefix: '✗ ' },
  warning: { color: 'text-warning', prefix: '⚠ ' },
  system: { color: 'text-info', prefix: '● ' },
  contract: { color: 'text-purple-400', prefix: '⬡ ' },
  http: { color: 'text-cyan-400', prefix: '↔' },
};

export default function AgentLogStream({ agentName }: { agentName: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/logs/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data);
        setLogs((prev) => [...prev, newLog]);
      } catch (err) {
        console.error("Failed to parse log entry", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  const clearLogs = () => setLogs([]);

  const downloadLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "agent_logs.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="glass-card rounded-xl flex flex-col" style={{ minHeight: '520px' }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Agent Log Stream</h2>
          <span className="text-xs text-muted-foreground">· {logs.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'success', 'error', 'contract', 'http', 'warning'] as const).map((lvl) => (
              <button
                key={`lvl-${lvl}`}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-150 ${
                  filter === lvl ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
          <button onClick={() => setAutoScroll((a) => !a)} className={`p-1.5 rounded-md text-xs transition-all ${autoScroll ? 'text-primary bg-green-950' : 'text-muted-foreground hover:bg-secondary'}`} title="Toggle auto-scroll">
            <ChevronRight size={13} />
          </button>
          <button onClick={clearLogs} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Clear logs">
            <Trash2 size={13} />
          </button>
          <button onClick={downloadLogs} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Download log">
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ maxHeight: '460px' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Terminal size={24} className="mb-2 opacity-40" />
            <p>Listening for agent activity...</p>
          </div>
        ) : (
          filtered.map((entry) => {
            const style = LEVEL_STYLES[entry.level];
            return (
              <div key={entry.id} className="mb-1.5 animate-fade-in">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground flex-shrink-0 select-none opacity-50">
                    {entry.timestamp}
                  </span>
                  <span className={`${style.color} flex-1`}>
                    {entry.message}
                  </span>
                </div>
                {entry.detail && (
                  <div className="ml-20 text-muted-foreground text-xs opacity-70 mt-0.5 break-all">
                    {entry.detail}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-muted-foreground opacity-50 text-xs">{new Date().toISOString().split('T')[1].slice(0, 12)}</span>
          <span className="text-primary text-xs">{'> '}<span className="animate-blink">█</span></span>
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="px-5 py-2.5 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-green inline-block" />
            Live
          </span>
          <span>{filtered.filter(l => l.level === 'success').length} success</span>
          <span className="text-accent">{filtered.filter(l => l.level === 'error').length} errors</span>
          <span className="text-warning">{filtered.filter(l => l.level === 'warning').length} warnings</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{agentName} · Sepolia</span>
      </div>
    </div>
  );
}