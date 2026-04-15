/**
 * Audit logging — every command sent through the bridge is logged
 * with timestamp, source, target session, and full prompt text.
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.claude-commander');
const LOG_FILE = join(CONFIG_DIR, 'audit.log');

export interface AuditEntry {
  timestamp: string;
  action: string;
  source: string;
  target: string;
  prompt?: string;
  result?: string;
  error?: string;
}

/**
 * Log an audit entry to the audit log file.
 */
export function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(full) + '\n';

  try {
    appendFileSync(LOG_FILE, line, { mode: 0o600 });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/**
 * Log a prompt send action.
 */
export function logSend(
  source: string,
  session: string,
  window: string,
  prompt: string
): void {
  logAudit({
    action: 'send',
    source,
    target: `${session}:${window}`,
    prompt,
  });
}

/**
 * Log a broadcast action.
 */
export function logBroadcast(
  source: string,
  target: string,
  prompt: string,
  sentTo: string[]
): void {
  logAudit({
    action: 'broadcast',
    source,
    target,
    prompt,
    result: `Sent to: ${sentTo.join(', ')}`,
  });
}

/**
 * Log an auth event.
 */
export function logAuth(source: string, success: boolean): void {
  logAudit({
    action: 'auth',
    source,
    target: 'bridge',
    result: success ? 'authenticated' : 'rejected',
  });
}

/**
 * Log server lifecycle events.
 */
export function logLifecycle(action: string, details?: string): void {
  logAudit({
    action,
    source: 'system',
    target: 'bridge',
    result: details,
  });
}
