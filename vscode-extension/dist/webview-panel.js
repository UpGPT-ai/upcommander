"use strict";
/**
 * SessionDetailPanel — Webview panel for a specific session:window.
 *
 * Shows:
 *  - Current window status / active pane PID
 *  - Prompt input at the bottom
 *  - Dark theme matching the PWA
 *  - Send button dispatches `claude-commander.sendPrompt` back into the extension
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
exports.SessionDetailPanel = void 0;
const vscode = __importStar(require("vscode"));
// ---------------------------------------------------------------------------
// Panel manager (singleton per session:window)
// ---------------------------------------------------------------------------
const panels = new Map();
class SessionDetailPanel {
    context;
    client;
    sessionName;
    windowName;
    panel;
    disposed = false;
    currentWindow;
    constructor(context, client, sessionName, windowName, initialWindow) {
        this.context = context;
        this.client = client;
        this.sessionName = sessionName;
        this.windowName = windowName;
        this.currentWindow = initialWindow;
        const key = `${sessionName}:${windowName}`;
        this.panel = vscode.window.createWebviewPanel('claude-commander.sessionDetail', `Commander: ${key}`, vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
        });
        this.panel.iconPath = new vscode.ThemeIcon('terminal');
        this.panel.webview.html = this._buildHtml();
        // Handle messages sent from the webview JS
        this.panel.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessage(message);
        }, undefined, context.subscriptions);
        this.panel.onDidDispose(() => {
            this.disposed = true;
            panels.delete(key);
            // Unsubscribe from pane streaming when panel closes
            this.client.unsubscribeFromPanes(this.sessionName, [this.windowName]);
        }, undefined, context.subscriptions);
    }
    // -------------------------------------------------------------------------
    // Static factory
    // -------------------------------------------------------------------------
    static open(context, client, sessionName, windowName, window) {
        const key = `${sessionName}:${windowName}`;
        const existing = panels.get(key);
        if (existing && !existing.disposed) {
            existing.panel.reveal(vscode.ViewColumn.Beside);
            return existing;
        }
        const panel = new SessionDetailPanel(context, client, sessionName, windowName, window);
        panels.set(key, panel);
        return panel;
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    update(window) {
        this.currentWindow = window;
        if (!this.disposed) {
            void this.panel.webview.postMessage({
                type: 'statusUpdate',
                data: {
                    sessionName: this.sessionName,
                    windowName: this.windowName,
                    active: window.active,
                    panePid: window.pane_pid,
                },
            });
        }
    }
    reveal() {
        this.panel.reveal(vscode.ViewColumn.Beside);
    }
    updatePaneOutput(output) {
        if (!this.disposed) {
            void this.panel.webview.postMessage({
                type: 'paneOutput',
                output,
            });
        }
    }
    sendFullLog(output) {
        if (!this.disposed) {
            void this.panel.webview.postMessage({
                type: 'fullLog',
                output,
            });
        }
    }
    dispose() {
        this.panel.dispose();
    }
    // -------------------------------------------------------------------------
    // Static helpers for pane output forwarding
    // -------------------------------------------------------------------------
    static forwardPaneOutput(sessionName, windowName, output) {
        const key = `${sessionName}:${windowName}`;
        const panel = panels.get(key);
        if (panel && !panel.disposed) {
            panel.updatePaneOutput(output);
        }
    }
    static sendFullLogToPanel(sessionName, windowName, output) {
        const key = `${sessionName}:${windowName}`;
        const panel = panels.get(key);
        if (panel && !panel.disposed) {
            panel.sendFullLog(output);
        }
    }
    static resubscribeAll(client) {
        for (const [key, panel] of panels.entries()) {
            if (!panel.disposed) {
                const colonIdx = key.indexOf(':');
                const session = key.slice(0, colonIdx);
                const window = key.slice(colonIdx + 1);
                client.subscribeToPanes(session, [window]);
            }
        }
    }
    // -------------------------------------------------------------------------
    // Message handler
    // -------------------------------------------------------------------------
    async _handleMessage(message) {
        switch (message.type) {
            case 'sendPrompt': {
                const prompt = message.payload.prompt?.trim();
                if (!prompt)
                    return;
                try {
                    await this.client.sendPrompt(this.sessionName, this.windowName, prompt);
                    void this.panel.webview.postMessage({ type: 'promptSent', ok: true });
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Failed to send prompt: ${msg}`);
                    void this.panel.webview.postMessage({
                        type: 'promptSent',
                        ok: false,
                        error: msg,
                    });
                }
                break;
            }
            case 'approve': {
                try {
                    await this.client.approve(this.sessionName, this.windowName);
                    void vscode.window.showInformationMessage(`Approved: ${this.sessionName}:${this.windowName}`);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Approve failed: ${msg}`);
                }
                break;
            }
            case 'deny': {
                try {
                    await this.client.deny(this.sessionName, this.windowName);
                    void vscode.window.showInformationMessage(`Denied: ${this.sessionName}:${this.windowName}`);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    void vscode.window.showErrorMessage(`Deny failed: ${msg}`);
                }
                break;
            }
        }
    }
    // -------------------------------------------------------------------------
    // HTML
    // -------------------------------------------------------------------------
    _buildHtml() {
        const w = this.currentWindow;
        const key = `${this.sessionName}:${this.windowName}`;
        const activeStatus = w ? (w.active ? 'Active' : 'Background') : 'Unknown';
        const panePid = w ? w.pane_pid : '—';
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claude Commander — ${key}</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --radius: 6px;
      --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Header */
    .header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      font-family: var(--font-mono);
    }

    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent);
      border: 1px solid rgba(88, 166, 255, 0.3);
    }

    .badge.active {
      background: rgba(63, 185, 80, 0.15);
      color: var(--green);
      border-color: rgba(63, 185, 80, 0.3);
    }

    /* Stats */
    .stats {
      padding: 12px 16px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      flex-shrink: 0;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      font-family: var(--font-mono);
    }

    /* Terminal section */
    .terminal-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      flex-shrink: 0;
    }

    .terminal-output {
      flex: 1;
      background: #010409;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      color: #c9d1d9;
      font-family: var(--font-mono);
      font-size: 11px;
      line-height: 1.5;
      overflow-y: auto;
      overflow-x: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      min-height: 100px;
    }

    /* Actions row */
    .actions-row {
      padding: 4px 16px;
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn-small {
      padding: 4px 10px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-muted);
      font-size: 11px;
      cursor: pointer;
    }
    .btn-small:hover { background: #21262d; }
    .btn-small.approve { color: var(--green); border-color: rgba(63,185,80,0.3); }
    .btn-small.deny { color: var(--red); border-color: rgba(248,81,73,0.3); }

    /* Input section */
    .input-section {
      padding: 8px 16px 12px;
      flex-shrink: 0;
    }

    .prompt-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .prompt-area {
      width: 100%;
      min-height: 60px;
      max-height: 120px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.6;
      resize: none;
      outline: none;
      transition: border-color 0.15s;
      display: block;
    }
    .prompt-area:focus { border-color: var(--accent); }
    .prompt-area::placeholder { color: var(--text-muted); }

    .send-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .send-hint {
      font-size: 11px;
      color: var(--text-muted);
      flex: 1;
    }

    .btn-send {
      padding: 8px 16px;
      border-radius: var(--radius);
      border: 1px solid rgba(88, 166, 255, 0.4);
      background: rgba(88, 166, 255, 0.1);
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-send:hover { background: rgba(88, 166, 255, 0.2); }
    .btn-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Scroll indicator */
    .scroll-indicator {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(88, 166, 255, 0.2);
      border: 1px solid rgba(88, 166, 255, 0.4);
      color: var(--accent);
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 11px;
      font-family: var(--font-mono);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
      animation: bounce 2s ease-in-out infinite;
      pointer-events: none;
    }

    .scroll-indicator.visible {
      opacity: 1;
      pointer-events: auto;
    }

    @keyframes bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-6px); }
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 16px;
      right: 16px;
      padding: 8px 14px;
      border-radius: var(--radius);
      font-size: 12px;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      z-index: 100;
    }
    .toast.show { opacity: 1; }
    .toast.success { background: rgba(63, 185, 80, 0.2); color: var(--green); border: 1px solid rgba(63, 185, 80, 0.4); }
    .toast.error { background: rgba(248, 81, 73, 0.2); color: var(--red); border: 1px solid rgba(248, 81, 73, 0.4); }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">${this._escHtml(key)}</span>
    <span class="badge ${w?.active ? 'active' : ''}" id="activeBadge">${this._escHtml(activeStatus)}</span>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Session</div>
      <div class="stat-value">${this._escHtml(this.sessionName)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Window</div>
      <div class="stat-value">${this._escHtml(this.windowName)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pane PID</div>
      <div class="stat-value" id="panePid">${panePid}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value" id="windowStatus">${this._escHtml(activeStatus)}</div>
    </div>
  </div>

  <!-- Terminal output stream -->
  <div class="terminal-section">
    <div class="section-header">
      <span class="prompt-label">Live Output</span>
    </div>
    <pre class="terminal-output" id="terminalOutput">Loading session log...</pre>
    <div class="scroll-indicator" id="scrollIndicator" onclick="scrollToBottom()">↓ new lines</div>
  </div>

  <!-- Actions row -->
  <div class="actions-row">
    <button class="btn-small approve" onclick="sendAction('approve')">Approve</button>
    <button class="btn-small deny" onclick="sendAction('deny')">Deny</button>
  </div>

  <!-- Message input -->
  <div class="input-section">
    <textarea
      class="prompt-area"
      id="promptInput"
      placeholder="Send a message to this worker..."
      rows="3"
    ></textarea>
    <div class="send-row">
      <span class="send-hint">Cmd+Enter to send</span>
      <button class="btn-send" id="sendBtn" onclick="sendPrompt()">Send</button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const vscode = acquireVsCodeApi();

    let lastOutput = '';
    let logLoaded = false;
    let userScrolledUp = false;
    let newLineCount = 0;

    const terminal = document.getElementById('terminalOutput');
    const scrollIndicator = document.getElementById('scrollIndicator');

    // Smart auto-scroll: detect if user scrolled up
    terminal.addEventListener('scroll', function() {
      const isAtBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 50;
      if (isAtBottom) {
        userScrolledUp = false;
        newLineCount = 0;
        hideScrollIndicator();
      } else {
        userScrolledUp = true;
      }
    });

    function showScrollIndicator(count) {
      scrollIndicator.textContent = '\\u2193 ' + count + ' new line' + (count === 1 ? '' : 's');
      scrollIndicator.classList.add('visible');
    }

    function hideScrollIndicator() {
      scrollIndicator.classList.remove('visible');
    }

    function scrollToBottom() {
      terminal.scrollTo({ top: terminal.scrollHeight, behavior: 'smooth' });
      userScrolledUp = false;
      newLineCount = 0;
      hideScrollIndicator();
    }

    // Handle keyboard shortcut
    document.getElementById('promptInput').addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        sendPrompt();
      }
    });

    function sendPrompt() {
      const input = document.getElementById('promptInput');
      const prompt = input.value.trim();
      if (!prompt) return;

      const btn = document.getElementById('sendBtn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      vscode.postMessage({ type: 'sendPrompt', payload: { prompt } });
    }

    function sendAction(action) {
      vscode.postMessage({ type: action });
    }

    function showToast(message, type) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show ' + type;
      setTimeout(() => { toast.className = 'toast'; }, 2500);
    }

    // Listen for messages from the extension
    window.addEventListener('message', function(event) {
      const msg = event.data;

      if (msg.type === 'fullLog') {
        const wasAtBottom = !userScrolledUp;
        terminal.textContent = msg.output || 'No log history available.';
        logLoaded = true;
        if (wasAtBottom) {
          terminal.scrollTop = terminal.scrollHeight;
        }
      }

      if (msg.type === 'paneOutput') {
        if (msg.output !== lastOutput) {
          const wasAtBottom = !userScrolledUp;

          if (logLoaded) {
            // Diff: find new lines not in the previous live output
            const prevLines = lastOutput ? lastOutput.split('\\n') : [];
            const newLines = msg.output.split('\\n');
            let diffLines = newLines;

            if (prevLines.length > 0) {
              // Find where previous content ends in the new content
              let matchEnd = -1;
              for (let i = newLines.length - 1; i >= 0; i--) {
                if (i + prevLines.length <= newLines.length) {
                  let match = true;
                  for (let j = 0; j < prevLines.length; j++) {
                    if (newLines[i + j] !== prevLines[j]) { match = false; break; }
                  }
                  if (match) { matchEnd = i + prevLines.length; break; }
                }
              }
              if (matchEnd >= 0 && matchEnd < newLines.length) {
                diffLines = newLines.slice(matchEnd);
              } else {
                // No overlap — append all new lines
                diffLines = newLines;
              }
            }

            if (diffLines.length > 0) {
              const ts = new Date().toISOString();
              const stamped = diffLines.map(l => '[' + ts + '] ' + l).join('\\n');
              terminal.textContent += '\\n' + stamped;

              if (wasAtBottom) {
                terminal.scrollTop = terminal.scrollHeight;
              } else {
                newLineCount += diffLines.length;
                showScrollIndicator(newLineCount);
              }
            }
          } else {
            terminal.textContent = msg.output;
            if (wasAtBottom) {
              terminal.scrollTop = terminal.scrollHeight;
            }
          }
          lastOutput = msg.output;
        }
      }

      if (msg.type === 'promptSent') {
        const btn = document.getElementById('sendBtn');
        btn.disabled = false;
        btn.textContent = 'Send';

        if (msg.ok) {
          document.getElementById('promptInput').value = '';
          showToast('Prompt sent', 'success');
        } else {
          showToast('Error: ' + (msg.error || 'Unknown error'), 'error');
        }
      }

      if (msg.type === 'statusUpdate') {
        document.getElementById('panePid').textContent = msg.data.panePid || '—';
        const statusEl = document.getElementById('windowStatus');
        const badgeEl = document.getElementById('activeBadge');
        const isActive = msg.data.active;
        statusEl.textContent = isActive ? 'Active' : 'Background';
        badgeEl.textContent = isActive ? 'Active' : 'Background';
        badgeEl.className = 'badge' + (isActive ? ' active' : '');
      }
    });
  </script>
</body>
</html>`;
    }
    _escHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
exports.SessionDetailPanel = SessionDetailPanel;
//# sourceMappingURL=webview-panel.js.map