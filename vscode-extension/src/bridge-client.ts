/**
 * BridgeClient — HTTP + WebSocket client for the UpCommander by UpGPT bridge server.
 *
 * Uses native `fetch` (available in Node 18+) for REST calls and the native
 * `WebSocket` global (available in VS Code 1.95+ which ships Node 20) for
 * real-time status push.
 */

import * as https from 'node:https';
import * as http from 'node:http';

// ---------------------------------------------------------------------------
// Shared types (mirrored from the bridge server's lib/)
// ---------------------------------------------------------------------------

export interface TmuxWindow {
  name: string;
  pane_pid: number;
  active: boolean;
}

export interface TmuxSession {
  name: string;
  windows: TmuxWindow[];
}

export interface SessionTree {
  sessions: TmuxSession[];
}

export interface AgentStatus {
  agent: string;
  tier: number;
  state:
    | 'idle'
    | 'in_progress'
    | 'complete'
    | 'blocked'
    | 'error'
    | 'waiting_approval';
  task: string;
  started: string;
  updated: string;
  progress: string;
  blocking_reason: string | null;
  waiting_for: string | null;
  subagents: { active: number; complete: number; total: number };
  files_produced: string[];
}

export interface CoordinationTree {
  projects: Record<
    string,
    {
      orchestrator: AgentStatus | null;
      workers: Record<string, AgentStatus>;
    }
  >;
}

export interface ApprovalItem {
  project: string;
  worker: string;
  task: string;
  since: string;
}

export interface ApprovalsResponse {
  approvals: ApprovalItem[];
  count: number;
}

export interface SystemMetrics {
  status: string;
  sessions: number;
  windows: number;
}

export interface BridgeError {
  error: string;
}

export interface DailyUsage {
  date: string;
  prompts: number;
  tokens_in: number;
  tokens_out: number;
  tokens_cached: number;
  cost_usd: number;
  sessions_active: string[];
}

export interface SessionUsageInfo {
  session: string;
  prompts_sent: number;
  prompts_today: number;
  cost_usd: number;
  cost_today_usd: number;
  last_active: string;
}

export interface UsageSummary {
  today: DailyUsage;
  week: {
    prompts: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    days: DailyUsage[];
  };
  month: {
    prompts: number;
    cost_usd: number;
  };
  by_session: SessionUsageInfo[];
  updated: string;
}

// ---------------------------------------------------------------------------
// WebSocket event callbacks
// ---------------------------------------------------------------------------

export type StatusUpdateCallback = (data: SessionTree) => void;
export type ApprovalNeededCallback = (data: {
  project: string;
  worker: string;
  status: AgentStatus;
}) => void;
export type CoordinationUpdateCallback = (data: {
  filepath: string;
  status: AgentStatus;
}) => void;
export type ConnectionStateCallback = (connected: boolean) => void;

export type PaneOutputCallback = (data: {
  session: string;
  window: string;
  output: string;
  timestamp: string;
}) => void;

export interface FileActivity {
  path: string;
  action: 'wrote' | 'edited' | 'created' | 'read';
  timestamp: string;
}

export type FileActivityCallback = (data: {
  session: string;
  window: string;
  files: FileActivity[];
  timestamp: string;
}) => void;

// ---------------------------------------------------------------------------
// BridgeClient
// ---------------------------------------------------------------------------

export class BridgeClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private token: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000;
  private destroyed = false;

  private statusUpdateCallbacks: StatusUpdateCallback[] = [];
  private approvalNeededCallbacks: ApprovalNeededCallback[] = [];
  private coordinationUpdateCallbacks: CoordinationUpdateCallback[] = [];
  private connectionStateCallbacks: ConnectionStateCallback[] = [];
  private paneOutputCallbacks: PaneOutputCallback[] = [];
  private fileActivityCallbacks: FileActivityCallback[] = [];

  constructor(baseUrl: string, token: string) {
    // Normalise: strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  updateConfig(baseUrl: string, token: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  // -------------------------------------------------------------------------
  // REST helpers
  // -------------------------------------------------------------------------

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Make an HTTP request using Node's built-in http/https modules
   * (avoids relying on global fetch in all Node versions).
   */
  private request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const postData = body !== undefined ? JSON.stringify(body) : undefined;
      const headers: Record<string, string> = this.authHeaders();
      if (postData !== undefined) {
        headers['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port ? parseInt(url.port, 10) : isHttps ? 443 : 80,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data) as T;
              const statusCode = res.statusCode ?? 0;
              if (statusCode >= 200 && statusCode < 300) {
                resolve(parsed);
              } else {
                const err = parsed as BridgeError;
                reject(new Error(err.error ?? `HTTP ${statusCode}`));
              }
            } catch {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          });
        }
      );

      req.on('error', (err: Error) => reject(err));
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (postData !== undefined) {
        req.write(postData);
      }
      req.end();
    });
  }

  /**
   * Make an HTTP request that returns plain text (not JSON).
   */
  private requestText(
    method: string,
    path: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port ? parseInt(url.port, 10) : isHttps ? 443 : 80,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            const statusCode = res.statusCode ?? 0;
            if (statusCode >= 200 && statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', (err: Error) => reject(err));
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.end();
    });
  }

  // -------------------------------------------------------------------------
  // REST endpoints
  // -------------------------------------------------------------------------

  async getHealth(): Promise<SystemMetrics> {
    return this.request<SystemMetrics>('GET', '/health');
  }

  async getSessions(): Promise<SessionTree> {
    return this.request<SessionTree>('GET', '/sessions');
  }

  async getUsage(): Promise<UsageSummary> {
    return this.request<UsageSummary>('GET', '/usage');
  }

  async sendPrompt(
    session: string,
    window: string,
    prompt: string
  ): Promise<void> {
    await this.request<{ ok: boolean }>('POST', `/send/${session}/${window}`, {
      prompt,
    });
  }

  async approve(session: string, window: string): Promise<void> {
    await this.request<{ ok: boolean }>(
      'POST',
      `/approve/${session}/${window}`
    );
  }

  async deny(session: string, window: string): Promise<void> {
    await this.request<{ ok: boolean }>('POST', `/deny/${session}/${window}`);
  }

  async broadcast(session: string, prompt: string): Promise<void> {
    await this.request<{ ok: boolean; sentTo: string[] }>(
      'POST',
      `/broadcast/${session}`,
      { prompt }
    );
  }

  async broadcastAll(prompt: string): Promise<void> {
    await this.request<{ ok: boolean; sentTo: string[] }>(
      'POST',
      '/broadcast/all',
      { prompt }
    );
  }

  async getApprovals(): Promise<ApprovalItem[]> {
    const resp = await this.request<ApprovalsResponse>('GET', '/approvals');
    return resp.approvals;
  }

  async getCoordinationTree(): Promise<CoordinationTree> {
    return this.request<CoordinationTree>('GET', '/status/tree');
  }

  async getMetrics(): Promise<SystemMetrics> {
    return this.getHealth();
  }

  async getPaneOutput(session: string, window: string): Promise<{ output: string; timestamp: string }> {
    return this.request<{ output: string; timestamp: string }>('GET', `/pane/${session}/${window}`);
  }

  async getFullLog(session: string, window: string): Promise<string> {
    return this.requestText('GET', `/logs/${session}/${window}`);
  }

  async getLogTail(session: string, window: string, lines?: number): Promise<string> {
    const query = lines ? `?lines=${lines}` : '';
    return this.requestText('GET', `/logs/${session}/${window}/tail${query}`);
  }

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.destroyed) return;
    this._openWebSocket();
  }

  disconnect(): void {
    this.destroyed = true;
    this._clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this._notifyConnectionState(false);
  }

  /** Reset destroyed flag and reconnect (used when reconfiguring). */
  reconnect(): void {
    this.destroyed = false;
    this._clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Reconnecting');
      this.ws = null;
    }
    this.connect();
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // -------------------------------------------------------------------------
  // Event subscriptions
  // -------------------------------------------------------------------------

  onStatusUpdate(callback: StatusUpdateCallback): void {
    this.statusUpdateCallbacks.push(callback);
  }

  onApprovalNeeded(callback: ApprovalNeededCallback): void {
    this.approvalNeededCallbacks.push(callback);
  }

  onCoordinationUpdate(callback: CoordinationUpdateCallback): void {
    this.coordinationUpdateCallbacks.push(callback);
  }

  onConnectionState(callback: ConnectionStateCallback): void {
    this.connectionStateCallbacks.push(callback);
  }

  onPaneOutput(callback: PaneOutputCallback): void {
    this.paneOutputCallbacks.push(callback);
  }

  onFileActivity(callback: FileActivityCallback): void {
    this.fileActivityCallbacks.push(callback);
  }

  async getWorkerFiles(session: string, window: string): Promise<FileActivity[]> {
    const resp = await this.request<{ files: FileActivity[] }>('GET', `/files/${session}/${window}`);
    return resp.files;
  }

  subscribeToPanes(session: string, windows: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const window of windows) {
      this.ws.send(JSON.stringify({ type: 'subscribe_pane', session, window }));
    }
  }

  unsubscribeFromPanes(session: string, windows: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const window of windows) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe_pane', session, window }));
    }
  }

  // -------------------------------------------------------------------------
  // Internal WebSocket management
  // -------------------------------------------------------------------------

  private _openWebSocket(): void {
    if (this.destroyed) return;

    try {
      const wsUrl = this._buildWsUrl();
      // VS Code 1.95+ (Node 20) has global WebSocket
      const socket = new WebSocket(wsUrl);

      socket.addEventListener('open', () => {
        this._notifyConnectionState(true);
        // Reset reconnect delay on successful connection
        this.reconnectDelay = 5000;
      });

      socket.addEventListener('message', (event: MessageEvent) => {
        this._handleMessage(event.data as string);
      });

      socket.addEventListener('close', (event: Event) => {
        this.ws = null;
        this._notifyConnectionState(false);
        // Don't reconnect on deliberate client close (code 1000)
        const closeEvent = event as Event & { code?: number };
        if (!this.destroyed && closeEvent.code !== 1000) {
          this._scheduleReconnect();
        }
      });

      socket.addEventListener('error', () => {
        // Error will be followed by close; just schedule reconnect there
        this.ws = null;
        this._notifyConnectionState(false);
        if (!this.destroyed) {
          this._scheduleReconnect();
        }
      });

      this.ws = socket;
    } catch {
      this._notifyConnectionState(false);
      if (!this.destroyed) {
        this._scheduleReconnect();
      }
    }
  }

  private _buildWsUrl(): string {
    const url = new URL(this.baseUrl);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenParam = this.token
      ? `?token=${encodeURIComponent(this.token)}`
      : '';
    return `${wsProto}//${url.host}/ws${tokenParam}`;
  }

  private _handleMessage(data: string): void {
    let parsed: { type: string; data: unknown };
    try {
      parsed = JSON.parse(data) as { type: string; data: unknown };
    } catch {
      return;
    }

    switch (parsed.type) {
      case 'status':
        for (const cb of this.statusUpdateCallbacks) {
          cb(parsed.data as SessionTree);
        }
        break;

      case 'approval_needed':
        for (const cb of this.approvalNeededCallbacks) {
          cb(
            parsed.data as {
              project: string;
              worker: string;
              status: AgentStatus;
            }
          );
        }
        break;

      case 'coordination_update':
        for (const cb of this.coordinationUpdateCallbacks) {
          cb(
            parsed.data as {
              filepath: string;
              status: AgentStatus;
            }
          );
        }
        break;

      case 'pane_output':
        for (const cb of this.paneOutputCallbacks) {
          cb(parsed.data as { session: string; window: string; output: string; timestamp: string });
        }
        break;

      case 'file_activity':
        for (const cb of this.fileActivityCallbacks) {
          cb(parsed.data as { session: string; window: string; files: FileActivity[]; timestamp: string });
        }
        break;
    }
  }

  private _scheduleReconnect(): void {
    this._clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
      this._openWebSocket();
    }, this.reconnectDelay);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _notifyConnectionState(connected: boolean): void {
    for (const cb of this.connectionStateCallbacks) {
      cb(connected);
    }
  }
}
