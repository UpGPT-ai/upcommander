"use strict";
/**
 * BridgeClient — HTTP + WebSocket client for the Claude Commander bridge server.
 *
 * Uses native `fetch` (available in Node 18+) for REST calls and the native
 * `WebSocket` global (available in VS Code 1.95+ which ships Node 20) for
 * real-time status push.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeClient = void 0;
const https = __importStar(require("node:https"));
const http = __importStar(require("node:http"));
// ---------------------------------------------------------------------------
// BridgeClient
// ---------------------------------------------------------------------------
class BridgeClient {
    ws = null;
    baseUrl;
    token;
    reconnectTimer = null;
    reconnectDelay = 5000;
    destroyed = false;
    statusUpdateCallbacks = [];
    approvalNeededCallbacks = [];
    coordinationUpdateCallbacks = [];
    connectionStateCallbacks = [];
    paneOutputCallbacks = [];
    fileActivityCallbacks = [];
    constructor(baseUrl, token) {
        // Normalise: strip trailing slash
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }
    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------
    updateConfig(baseUrl, token) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }
    // -------------------------------------------------------------------------
    // REST helpers
    // -------------------------------------------------------------------------
    authHeaders() {
        const headers = {
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
    request(method, path, body) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + path);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const postData = body !== undefined ? JSON.stringify(body) : undefined;
            const headers = this.authHeaders();
            if (postData !== undefined) {
                headers['Content-Length'] = Buffer.byteLength(postData).toString();
            }
            const req = lib.request({
                hostname: url.hostname,
                port: url.port ? parseInt(url.port, 10) : isHttps ? 443 : 80,
                path: url.pathname + url.search,
                method,
                headers,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const statusCode = res.statusCode ?? 0;
                        if (statusCode >= 200 && statusCode < 300) {
                            resolve(parsed);
                        }
                        else {
                            const err = parsed;
                            reject(new Error(err.error ?? `HTTP ${statusCode}`));
                        }
                    }
                    catch {
                        reject(new Error(`Failed to parse response: ${data}`));
                    }
                });
            });
            req.on('error', (err) => reject(err));
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
    requestText(method, path) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl + path);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            const headers = {};
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            const req = lib.request({
                hostname: url.hostname,
                port: url.port ? parseInt(url.port, 10) : isHttps ? 443 : 80,
                path: url.pathname + url.search,
                method,
                headers,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk.toString();
                });
                res.on('end', () => {
                    const statusCode = res.statusCode ?? 0;
                    if (statusCode >= 200 && statusCode < 300) {
                        resolve(data);
                    }
                    else {
                        reject(new Error(`HTTP ${statusCode}: ${data}`));
                    }
                });
            });
            req.on('error', (err) => reject(err));
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
    async getHealth() {
        return this.request('GET', '/health');
    }
    async getSessions() {
        return this.request('GET', '/sessions');
    }
    async getUsage() {
        return this.request('GET', '/usage');
    }
    async sendPrompt(session, window, prompt) {
        await this.request('POST', `/send/${session}/${window}`, {
            prompt,
        });
    }
    async approve(session, window) {
        await this.request('POST', `/approve/${session}/${window}`);
    }
    async deny(session, window) {
        await this.request('POST', `/deny/${session}/${window}`);
    }
    async broadcast(session, prompt) {
        await this.request('POST', `/broadcast/${session}`, { prompt });
    }
    async broadcastAll(prompt) {
        await this.request('POST', '/broadcast/all', { prompt });
    }
    async getApprovals() {
        const resp = await this.request('GET', '/approvals');
        return resp.approvals;
    }
    async getCoordinationTree() {
        return this.request('GET', '/status/tree');
    }
    async getMetrics() {
        return this.getHealth();
    }
    async getPaneOutput(session, window) {
        return this.request('GET', `/pane/${session}/${window}`);
    }
    async getFullLog(session, window) {
        return this.requestText('GET', `/logs/${session}/${window}`);
    }
    async getLogTail(session, window, lines) {
        const query = lines ? `?lines=${lines}` : '';
        return this.requestText('GET', `/logs/${session}/${window}/tail${query}`);
    }
    // -------------------------------------------------------------------------
    // WebSocket
    // -------------------------------------------------------------------------
    connect() {
        if (this.destroyed)
            return;
        this._openWebSocket();
    }
    disconnect() {
        this.destroyed = true;
        this._clearReconnect();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this._notifyConnectionState(false);
    }
    /** Reset destroyed flag and reconnect (used when reconfiguring). */
    reconnect() {
        this.destroyed = false;
        this._clearReconnect();
        if (this.ws) {
            this.ws.close(1000, 'Reconnecting');
            this.ws = null;
        }
        this.connect();
    }
    get isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    // -------------------------------------------------------------------------
    // Event subscriptions
    // -------------------------------------------------------------------------
    onStatusUpdate(callback) {
        this.statusUpdateCallbacks.push(callback);
    }
    onApprovalNeeded(callback) {
        this.approvalNeededCallbacks.push(callback);
    }
    onCoordinationUpdate(callback) {
        this.coordinationUpdateCallbacks.push(callback);
    }
    onConnectionState(callback) {
        this.connectionStateCallbacks.push(callback);
    }
    onPaneOutput(callback) {
        this.paneOutputCallbacks.push(callback);
    }
    onFileActivity(callback) {
        this.fileActivityCallbacks.push(callback);
    }
    async getWorkerFiles(session, window) {
        const resp = await this.request('GET', `/files/${session}/${window}`);
        return resp.files;
    }
    subscribeToPanes(session, windows) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        for (const window of windows) {
            this.ws.send(JSON.stringify({ type: 'subscribe_pane', session, window }));
        }
    }
    unsubscribeFromPanes(session, windows) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        for (const window of windows) {
            this.ws.send(JSON.stringify({ type: 'unsubscribe_pane', session, window }));
        }
    }
    // -------------------------------------------------------------------------
    // Internal WebSocket management
    // -------------------------------------------------------------------------
    _openWebSocket() {
        if (this.destroyed)
            return;
        try {
            const wsUrl = this._buildWsUrl();
            // VS Code 1.95+ (Node 20) has global WebSocket
            const socket = new WebSocket(wsUrl);
            socket.addEventListener('open', () => {
                this._notifyConnectionState(true);
                // Reset reconnect delay on successful connection
                this.reconnectDelay = 5000;
            });
            socket.addEventListener('message', (event) => {
                this._handleMessage(event.data);
            });
            socket.addEventListener('close', (event) => {
                this.ws = null;
                this._notifyConnectionState(false);
                // Don't reconnect on deliberate client close (code 1000)
                const closeEvent = event;
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
        }
        catch {
            this._notifyConnectionState(false);
            if (!this.destroyed) {
                this._scheduleReconnect();
            }
        }
    }
    _buildWsUrl() {
        const url = new URL(this.baseUrl);
        const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const tokenParam = this.token
            ? `?token=${encodeURIComponent(this.token)}`
            : '';
        return `${wsProto}//${url.host}/ws${tokenParam}`;
    }
    _handleMessage(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        }
        catch {
            return;
        }
        switch (parsed.type) {
            case 'status':
                for (const cb of this.statusUpdateCallbacks) {
                    cb(parsed.data);
                }
                break;
            case 'approval_needed':
                for (const cb of this.approvalNeededCallbacks) {
                    cb(parsed.data);
                }
                break;
            case 'coordination_update':
                for (const cb of this.coordinationUpdateCallbacks) {
                    cb(parsed.data);
                }
                break;
            case 'pane_output':
                for (const cb of this.paneOutputCallbacks) {
                    cb(parsed.data);
                }
                break;
            case 'file_activity':
                for (const cb of this.fileActivityCallbacks) {
                    cb(parsed.data);
                }
                break;
        }
    }
    _scheduleReconnect() {
        this._clearReconnect();
        this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
            this._openWebSocket();
        }, this.reconnectDelay);
    }
    _clearReconnect() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    _notifyConnectionState(connected) {
        for (const cb of this.connectionStateCallbacks) {
            cb(connected);
        }
    }
}
exports.BridgeClient = BridgeClient;
//# sourceMappingURL=bridge-client.js.map