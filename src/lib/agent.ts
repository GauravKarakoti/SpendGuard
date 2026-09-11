import { EventEmitter } from 'events';

// Prevent TypeScript from complaining about the custom global variable
declare global {
  var _agentEventEmitter: EventEmitter | undefined;
}

// Ensure a single instance of EventEmitter across the entire Next.js application,
// preventing memory leaks and broken streams during development reloads.
export const agentEventEmitter = globalThis._agentEventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalThis._agentEventEmitter = agentEventEmitter;
}

// ---------------------------------------------------------------------------
// Helper Types & Functions
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'system' | 'contract' | 'http';

interface AgentLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

/**
 * Call this function from anywhere in your backend (like API routes or agent scripts)
 * to instantly broadcast a log to the frontend Agent Console.
 */
export function emitAgentLog(level: LogLevel, message: string, detail?: string) {
  const logData: AgentLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString().split('T')[1].slice(0, 12), // HH:MM:SS.mmm format
    level,
    message,
    detail,
  };

  agentEventEmitter.emit('agentLog', logData);
}