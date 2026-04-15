/**
 * UpCommander by UpGPT VS Code Extension — Main Entry Point
 *
 * Activates on startup, reads configuration, connects to the bridge server,
 * and registers all commands, tree views, and the status bar item.
 */

import * as vscode from 'vscode';

import { BridgeClient, TmuxWindow } from './bridge-client';
import { SessionTreeProvider, SessionTreeItem } from './tree-provider';
import { ApprovalTreeProvider, ApprovalTreeItem } from './approval-provider';
import { SessionDetailPanel } from './webview-panel';

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------

let client: BridgeClient | null = null;
let sessionProvider: SessionTreeProvider | null = null;
let approvalProvider: ApprovalTreeProvider | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Context key for menu visibility
const CONNECTED_CONTEXT = 'upcommander.connected';

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // -------------------------------------------------------------------------
  // Read configuration
  // -------------------------------------------------------------------------
  const config = vscode.workspace.getConfiguration('upcommander');
  const bridgeUrl: string = config.get('bridgeUrl') ?? 'http://127.0.0.1:7700';
  let token: string = config.get('token') ?? '';
  const autoConnect: boolean = config.get('autoConnect') ?? true;

  // Auto-read token from ~/.upcommander/auth-token if not set in config
  if (!token) {
    try {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      const tokenPath = path.join(os.homedir(), '.upcommander', 'auth-token');
      if (fs.existsSync(tokenPath)) {
        token = fs.readFileSync(tokenPath, 'utf-8').trim();
      }
    } catch {
      // Silently ignore — user can set token manually
    }
  }

  // -------------------------------------------------------------------------
  // Create BridgeClient
  // -------------------------------------------------------------------------
  client = new BridgeClient(bridgeUrl, token);

  // -------------------------------------------------------------------------
  // Create TreeDataProviders
  // -------------------------------------------------------------------------
  sessionProvider = new SessionTreeProvider(client);
  approvalProvider = new ApprovalTreeProvider(client);

  const sessionTreeView = vscode.window.createTreeView(
    'upcommander-sessions',
    {
      treeDataProvider: sessionProvider,
      showCollapseAll: true,
    }
  );

  const approvalTreeView = vscode.window.createTreeView(
    'upcommander-approvals',
    {
      treeDataProvider: approvalProvider,
      showCollapseAll: false,
    }
  );

  context.subscriptions.push(sessionTreeView, approvalTreeView);

  // -------------------------------------------------------------------------
  // Status bar item
  // -------------------------------------------------------------------------
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'upcommander.refresh';
  statusBarItem.text = '$(arrow-up) UC: disconnected';
  statusBarItem.tooltip = 'UpCommander by UpGPT — click to refresh';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // -------------------------------------------------------------------------
  // WebSocket event handlers
  // -------------------------------------------------------------------------
  client.onConnectionState((connected) => {
    void vscode.commands.executeCommand(
      'setContext',
      CONNECTED_CONTEXT,
      connected
    );
    sessionProvider?.setConnected(connected);
    approvalProvider?.setConnected(connected);
    _updateStatusBar(connected);
    if (connected) {
      // Resubscribe to pane streams for all open panels after reconnect
      if (client) SessionDetailPanel.resubscribeAll(client);
    }
  });

  client.onStatusUpdate((tree) => {
    sessionProvider?.refresh(tree);
    _updateStatusBarSessions(
      tree.sessions.length,
      tree.sessions.reduce((s, sess) => s + sess.windows.length, 0)
    );
  });

  client.onApprovalNeeded(async () => {
    // Refresh approval queue when a new approval event arrives
    await approvalProvider?.fetchAndRefresh();
    _updateStatusBarApprovals(approvalProvider?.getCount() ?? 0);
    void vscode.window.showWarningMessage(
      'UpCommander by UpGPT: Agent waiting for approval',
      'View Approvals'
    ).then((choice: string | undefined) => {
      if (choice === 'View Approvals') {
        void vscode.commands.executeCommand(
          'upcommander-approvals.focus'
        );
      }
    });
  });

  client.onCoordinationUpdate(() => {
    // Refresh approvals on any coordination change
    void approvalProvider?.fetchAndRefresh().then(() => {
      _updateStatusBarApprovals(approvalProvider?.getCount() ?? 0);
    });
  });

  client.onPaneOutput((data) => {
    // Forward live pane output to the matching open webview panel
    SessionDetailPanel.forwardPaneOutput(data.session, data.window, data.output);
  });

  client.onFileActivity((data) => {
    // Update the tree view with files written by this worker
    sessionProvider?.updateFileActivity(data.session, data.window, data.files);
  });

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  // --- Connect ---
  context.subscriptions.push(
    vscode.commands.registerCommand('upcommander.connect', async () => {
      const cfg = vscode.workspace.getConfiguration('upcommander');
      const url: string = cfg.get('bridgeUrl') ?? 'http://127.0.0.1:7700';
      const tok: string = cfg.get('token') ?? '';

      if (!tok) {
        const entered = await vscode.window.showInputBox({
          title: 'UpCommander by UpGPT: Enter Bearer Token',
          prompt:
            'Paste the bearer token from your bridge server startup log or ~/.upcommander/token',
          ignoreFocusOut: true,
          password: true,
        });
        if (entered === undefined) return; // cancelled
        await cfg.update('token', entered, vscode.ConfigurationTarget.Global);
        client?.updateConfig(url, entered);
      } else {
        client?.updateConfig(url, tok);
      }

      client?.reconnect();
      // Initial data fetch
      await _fetchAll();
    })
  );

  // --- Disconnect ---
  context.subscriptions.push(
    vscode.commands.registerCommand('upcommander.disconnect', () => {
      client?.disconnect();
    })
  );

  // --- Refresh ---
  context.subscriptions.push(
    vscode.commands.registerCommand('upcommander.refresh', async () => {
      await _fetchAll();
    })
  );

  // --- Send Prompt ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.sendPrompt',
      async (item?: SessionTreeItem) => {
        if (!client) return;

        let sessionName: string | undefined;
        let windowName: string | undefined;

        if (item?.itemType === 'window') {
          sessionName = item.sessionName;
          windowName = item.windowName;
        } else {
          // No item provided: let user pick session then window
          const sessions = sessionProvider?.getSessions() ?? [];
          if (sessions.length === 0) {
            void vscode.window.showWarningMessage(
              'No tmux sessions found. Is the bridge server running?'
            );
            return;
          }

          const sessionPick = await vscode.window.showQuickPick(
            sessions.map((s) => ({
              label: s.name,
              description: `${s.windows.length} window(s)`,
              session: s,
            })),
            { title: 'Select Session', placeHolder: 'Choose a tmux session' }
          );
          if (!sessionPick) return;

          const windowPick = await vscode.window.showQuickPick(
            sessionPick.session.windows.map((win: TmuxWindow) => ({
              label: win.name,
              description: win.active ? '● active' : '○ background',
              window: win,
            })),
            { title: 'Select Window', placeHolder: 'Choose a tmux window' }
          );
          if (!windowPick) return;

          sessionName = sessionPick.session.name;
          windowName = windowPick.window.name;
        }

        if (!sessionName || !windowName) return;

        // Open the detail panel for this window
        const sess = sessionProvider
          ?.getSessions()
          .find((s) => s.name === sessionName);
        const win = sess?.windows.find((w) => w.name === windowName);
        SessionDetailPanel.open(context, client, sessionName, windowName, win);
        // Subscribe to live pane output for this window
        if (client.isConnected) {
          client.subscribeToPanes(sessionName, [windowName]);
        }
        // Fetch full log history and send to the panel
        client.getFullLog(sessionName, windowName).then((fullLog) => {
          SessionDetailPanel.sendFullLogToPanel(sessionName, windowName, fullLog);
        }).catch(() => {
          // Silently ignore — panel will show live output only
        });
      }
    )
  );

  // --- Approve ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.approve',
      async (item?: ApprovalTreeItem) => {
        if (!client) return;

        let sessionName: string | undefined;
        let windowName: string | undefined;

        if (item?.approval) {
          // Approval queue item: project maps to session, worker maps to window
          sessionName = item.approval.project;
          windowName = item.approval.worker;
        } else {
          // Prompt user to pick
          const approvals = approvalProvider?.getApprovals() ?? [];
          if (approvals.length === 0) {
            void vscode.window.showInformationMessage(
              'No pending approvals in queue.'
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            approvals.map((a) => ({
              label: `${a.project}:${a.worker}`,
              description: a.task,
              approval: a,
            })),
            { title: 'Select Approval to Grant', placeHolder: 'Choose an agent' }
          );
          if (!pick) return;
          sessionName = pick.approval.project;
          windowName = pick.approval.worker;
        }

        if (!sessionName || !windowName) return;

        try {
          await client.approve(sessionName, windowName);
          void vscode.window.showInformationMessage(
            `Approved: ${sessionName}:${windowName}`
          );
          await approvalProvider?.fetchAndRefresh();
          _updateStatusBarApprovals(approvalProvider?.getCount() ?? 0);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`Approve failed: ${msg}`);
        }
      }
    )
  );

  // --- Deny ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.deny',
      async (item?: ApprovalTreeItem) => {
        if (!client) return;

        let sessionName: string | undefined;
        let windowName: string | undefined;

        if (item?.approval) {
          sessionName = item.approval.project;
          windowName = item.approval.worker;
        } else {
          const approvals = approvalProvider?.getApprovals() ?? [];
          if (approvals.length === 0) {
            void vscode.window.showInformationMessage(
              'No pending approvals in queue.'
            );
            return;
          }
          const pick = await vscode.window.showQuickPick(
            approvals.map((a) => ({
              label: `${a.project}:${a.worker}`,
              description: a.task,
              approval: a,
            })),
            { title: 'Select Approval to Deny', placeHolder: 'Choose an agent' }
          );
          if (!pick) return;
          sessionName = pick.approval.project;
          windowName = pick.approval.worker;
        }

        if (!sessionName || !windowName) return;

        try {
          await client.deny(sessionName, windowName);
          void vscode.window.showInformationMessage(
            `Denied: ${sessionName}:${windowName}`
          );
          await approvalProvider?.fetchAndRefresh();
          _updateStatusBarApprovals(approvalProvider?.getCount() ?? 0);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`Deny failed: ${msg}`);
        }
      }
    )
  );

  // --- Broadcast to Session ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.broadcast',
      async (item?: SessionTreeItem) => {
        if (!client) return;

        let sessionName: string | undefined;

        if (item?.itemType === 'session' && item.sessionName) {
          sessionName = item.sessionName;
        } else {
          const sessions = sessionProvider?.getSessions() ?? [];
          const pick = await vscode.window.showQuickPick(
            sessions.map((s) => ({
              label: s.name,
              description: `${s.windows.length} window(s)`,
            })),
            { title: 'Broadcast to Session', placeHolder: 'Choose a session' }
          );
          if (!pick) return;
          sessionName = pick.label;
        }

        if (!sessionName) return;

        const prompt = await vscode.window.showInputBox({
          title: `Broadcast to all windows in "${sessionName}"`,
          placeHolder: 'Type your prompt…',
          ignoreFocusOut: true,
        });
        if (!prompt?.trim()) return;

        try {
          await client.broadcast(sessionName, prompt.trim());
          void vscode.window.showInformationMessage(
            `Broadcast sent to session "${sessionName}"`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`Broadcast failed: ${msg}`);
        }
      }
    )
  );

  // --- Open File (from tree item click) ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.openFile',
      async (filePath: string) => {
        if (!filePath) return;
        try {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: false,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`Cannot open file: ${msg}`);
        }
      }
    )
  );

  // --- Broadcast to All ---
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'upcommander.broadcastAll',
      async () => {
        if (!client) return;

        const sessions = sessionProvider?.getSessions() ?? [];
        const totalWindows = sessions.reduce(
          (sum, s) => sum + s.windows.length,
          0
        );

        const confirm = await vscode.window.showWarningMessage(
          `This will send to ALL ${sessions.length} session(s) and ${totalWindows} window(s). Continue?`,
          { modal: true },
          'Yes, Broadcast All'
        );
        if (confirm !== 'Yes, Broadcast All') return;

        const prompt = await vscode.window.showInputBox({
          title: 'Broadcast to ALL sessions and windows',
          placeHolder: 'Type your prompt…',
          ignoreFocusOut: true,
        });
        if (!prompt?.trim()) return;

        try {
          await client.broadcastAll(prompt.trim());
          void vscode.window.showInformationMessage(
            `Broadcast sent to all ${totalWindows} window(s)`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`Broadcast failed: ${msg}`);
        }
      }
    )
  );

  // -------------------------------------------------------------------------
  // Configuration change listener
  // -------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration('upcommander')) {
        const newCfg = vscode.workspace.getConfiguration('upcommander');
        const newUrl: string =
          newCfg.get('bridgeUrl') ?? 'http://127.0.0.1:7700';
        const newToken: string = newCfg.get('token') ?? '';
        client?.updateConfig(newUrl, newToken);

        const newAuto: boolean = newCfg.get('autoConnect') ?? true;
        if (newAuto && !client?.isConnected) {
          client?.reconnect();
        }
      }
    })
  );

  // -------------------------------------------------------------------------
  // Poll timer — refresh data every 15 s in case WS misses an update
  // -------------------------------------------------------------------------
  pollTimer = setInterval(() => {
    if (client?.isConnected) {
      void _fetchAll();
    }
  }, 15000);

  context.subscriptions.push({
    dispose: () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  });

  // -------------------------------------------------------------------------
  // Auto-connect
  // -------------------------------------------------------------------------
  if (autoConnect) {
    client.connect();
    void _fetchAll();
  } else {
    sessionProvider.setConnected(false);
    approvalProvider.setConnected(false);
  }
}

// ---------------------------------------------------------------------------
// Deactivation
// ---------------------------------------------------------------------------

export function deactivate(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  client?.disconnect();
  client = null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _fetchAll(): Promise<void> {
  if (!client || !sessionProvider || !approvalProvider) return;

  try {
    const [tree, approvals, usage] = await Promise.allSettled([
      client.getSessions(),
      client.getApprovals(),
      client.getUsage(),
    ]);

    if (tree.status === 'fulfilled') {
      sessionProvider.refresh(tree.value);
      _updateStatusBarSessions(
        tree.value.sessions.length,
        tree.value.sessions.reduce((s, sess) => s + sess.windows.length, 0)
      );

      // Fetch file activity for every window in every session
      for (const sess of tree.value.sessions) {
        for (const win of sess.windows) {
          client.getWorkerFiles(sess.name, win.name).then((files) => {
            if (files.length > 0) {
              sessionProvider?.updateFileActivity(sess.name, win.name, files);
            }
          }).catch(() => {
            // Silently ignore — files endpoint may not be available
          });
        }
      }
    }

    if (approvals.status === 'fulfilled') {
      approvalProvider.refresh(approvals.value);
      _updateStatusBarApprovals(approvals.value.length);
    }

    if (usage.status === 'fulfilled') {
      _updateStatusBarUsage(usage.value);
    }
  } catch {
    // Silently ignore — WS will push updates when available
  }
}

function _updateStatusBar(connected: boolean): void {
  if (!statusBarItem) return;
  if (!connected) {
    statusBarItem.text = '$(arrow-up) UC: disconnected';
    statusBarItem.tooltip = 'UpCommander by UpGPT — not connected. Click to refresh.';
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.warningBackground'
    );
  } else {
    statusBarItem.text = '$(arrow-up) UC: connected';
    statusBarItem.backgroundColor = undefined;
  }
}

// Track last known values for status bar composition
let _sessions = 0;
let _windows = 0;
let _approvals = 0;
let _todayPrompts = 0;
let _todayCost = 0;
let _weekPrompts = 0;
let _weekCost = 0;

function _updateStatusBarSessions(sessions: number, windows: number): void {
  _sessions = sessions;
  _windows = windows;
  _recomputeStatusBar();
}

function _updateStatusBarApprovals(approvals: number): void {
  _approvals = approvals;
  _recomputeStatusBar();
}

function _updateStatusBarUsage(usage: import('./bridge-client').UsageSummary): void {
  _todayPrompts = usage.today.prompts;
  _todayCost = usage.today.cost_usd;
  _weekPrompts = usage.week.prompts;
  _weekCost = usage.week.cost_usd;
  _recomputeStatusBar();
}

function _recomputeStatusBar(): void {
  if (!statusBarItem) return;
  const approvalSuffix =
    _approvals > 0 ? ` · $(bell) ${_approvals}` : '';
  const usageSuffix =
    _todayPrompts > 0 ? ` · ${_todayPrompts} prompts` : '';
  const costSuffix =
    _todayCost > 0 ? ` · $${_todayCost.toFixed(2)}` : '';
  statusBarItem.text = `$(arrow-up) UC: ${_sessions}s/${_windows}w${approvalSuffix}${usageSuffix}${costSuffix}`;
  statusBarItem.tooltip = [
    'Commander',
    `Sessions: ${_sessions}  |  Windows: ${_windows}`,
    _approvals > 0 ? `Pending approvals: ${_approvals}` : '',
    '',
    '--- Today ---',
    `Prompts: ${_todayPrompts}`,
    _todayCost > 0 ? `Cost: $${_todayCost.toFixed(2)}` : 'Cost: $0.00',
    '',
    '--- This Week ---',
    `Prompts: ${_weekPrompts}`,
    _weekCost > 0 ? `Cost: $${_weekCost.toFixed(2)}` : 'Cost: $0.00',
    '',
    'Click to refresh',
  ]
    .filter(Boolean)
    .join('\n');
  statusBarItem.backgroundColor =
    _approvals > 0
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
}
