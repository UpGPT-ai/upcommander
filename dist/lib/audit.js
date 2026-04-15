/**
 * Audit logging — every command sent through the bridge is logged
 * with timestamp, source, target session, and full prompt text.
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONFIG_DIR = join(homedir(), '.claude-commander');
const LOG_FILE = join(CONFIG_DIR, 'audit.log');
/**
 * Log an audit entry to the audit log file.
 */
export function logAudit(entry) {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    const full = {
        timestamp: new Date().toISOString(),
        ...entry,
    };
    const line = JSON.stringify(full) + '\n';
    try {
        appendFileSync(LOG_FILE, line, { mode: 0o600 });
    }
    catch (err) {
        console.error('[audit] Failed to write audit log:', err);
    }
}
/**
 * Log a prompt send action.
 */
export function logSend(source, session, window, prompt) {
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
export function logBroadcast(source, target, prompt, sentTo) {
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
export function logAuth(source, success) {
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
export function logLifecycle(action, details) {
    logAudit({
        action,
        source: 'system',
        target: 'bridge',
        result: details,
    });
}
//# sourceMappingURL=audit.js.map