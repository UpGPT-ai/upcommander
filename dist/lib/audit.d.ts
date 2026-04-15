/**
 * Audit logging — every command sent through the bridge is logged
 * with timestamp, source, target session, and full prompt text.
 */
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
export declare function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void;
/**
 * Log a prompt send action.
 */
export declare function logSend(source: string, session: string, window: string, prompt: string): void;
/**
 * Log a broadcast action.
 */
export declare function logBroadcast(source: string, target: string, prompt: string, sentTo: string[]): void;
/**
 * Log an auth event.
 */
export declare function logAuth(source: string, success: boolean): void;
/**
 * Log server lifecycle events.
 */
export declare function logLifecycle(action: string, details?: string): void;
//# sourceMappingURL=audit.d.ts.map