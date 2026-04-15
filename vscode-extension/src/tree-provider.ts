/**
 * SessionTreeProvider — VS Code TreeDataProvider for the Sessions sidebar.
 *
 * Hierarchy:
 *   Session (tmux session)
 *     └── Window (tmux window) — shows status icon + state
 *           └── File (written/edited by this worker) — click to open
 *
 * Status icons:
 *   ● running / in_progress  (green)
 *   ○ idle                   (gray)
 *   ◉ needs approval         (yellow)
 *   ✗ error                  (red)
 *   ✓ complete               (blue)
 *   ⬤ blocked                (orange)
 */

import * as vscode from 'vscode';
import type { BridgeClient, SessionTree, TmuxSession, TmuxWindow, FileActivity } from './bridge-client';
import { basename } from 'path';

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export type SessionItemType = 'session' | 'window' | 'file' | 'empty';

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly itemType: SessionItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly sessionName?: string,
    public readonly windowName?: string,
    public readonly windowActive?: boolean,
    public readonly fileActivity?: FileActivity
  ) {
    super(label, collapsibleState);

    this.contextValue = itemType;

    if (itemType === 'session') {
      this.iconPath = new vscode.ThemeIcon('terminal-tmux');
      this.tooltip = `tmux session: ${label}`;
    } else if (itemType === 'window') {
      this.iconPath = windowActive
        ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
      this.tooltip = `${sessionName}:${windowName}${windowActive ? ' (active)' : ''}`;
    } else if (itemType === 'file' && fileActivity) {
      // File item — clickable to open
      const actionIcon = fileActivity.action === 'wrote' || fileActivity.action === 'created'
        ? 'new-file'
        : 'edit';
      this.iconPath = new vscode.ThemeIcon(actionIcon, new vscode.ThemeColor('charts.blue'));
      this.tooltip = `${fileActivity.action}: ${fileActivity.path}\n${fileActivity.timestamp}`;
      this.description = fileActivity.action;

      // Make file clickable — opens it in the editor
      this.command = {
        command: 'claude-commander.openFile',
        title: 'Open File',
        arguments: [fileActivity.path],
      };

      // Resource URI for file-type decoration
      try {
        this.resourceUri = vscode.Uri.file(fileActivity.path);
      } catch {
        // Invalid path — ignore
      }
    } else {
      // empty placeholder
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sessions: TmuxSession[] = [];
  private connected = false;

  // Track files per window: "session:window" → FileActivity[]
  private windowFiles = new Map<string, FileActivity[]>();

  constructor(private readonly client: BridgeClient) {}

  // -------------------------------------------------------------------------
  // Data update
  // -------------------------------------------------------------------------

  refresh(tree?: SessionTree): void {
    if (tree) {
      this.sessions = tree.sessions;
    }
    this._onDidChangeTreeData.fire();
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) {
      this.sessions = [];
      this.windowFiles.clear();
    }
    this._onDidChangeTreeData.fire();
  }

  async fetchAndRefresh(): Promise<void> {
    try {
      const tree = await this.client.getSessions();
      this.sessions = tree.sessions;
    } catch {
      this.sessions = [];
    }
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update file activity for a specific worker window.
   * Called when file_activity WebSocket events arrive.
   */
  updateFileActivity(session: string, window: string, files: FileActivity[]): void {
    const key = `${session}:${window}`;
    this.windowFiles.set(key, files);
    this._onDidChangeTreeData.fire();
  }

  // -------------------------------------------------------------------------
  // TreeDataProvider implementation
  // -------------------------------------------------------------------------

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SessionTreeItem): vscode.ProviderResult<SessionTreeItem[]> {
    if (!this.connected) {
      return [
        new SessionTreeItem(
          'Not connected — click Connect to Bridge',
          'empty',
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

    if (!element) {
      // Root: list sessions
      if (this.sessions.length === 0) {
        return [
          new SessionTreeItem(
            'No tmux sessions found',
            'empty',
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
      return this.sessions.map(
        (s) =>
          new SessionTreeItem(
            `${s.name}  (${s.windows.length} window${s.windows.length !== 1 ? 's' : ''})`,
            'session',
            vscode.TreeItemCollapsibleState.Expanded,
            s.name
          )
      );
    }

    if (element.itemType === 'session' && element.sessionName) {
      // Children: windows for this session
      const session = this.sessions.find((s) => s.name === element.sessionName);
      if (!session) return [];
      return session.windows.map((w) => {
        const key = `${session.name}:${w.name}`;
        const files = this.windowFiles.get(key) ?? [];
        const hasFiles = files.length > 0;
        return new SessionTreeItem(
          this._windowLabel(w, files.length),
          'window',
          hasFiles ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          session.name,
          w.name,
          w.active
        );
      });
    }

    if (element.itemType === 'window' && element.sessionName && element.windowName) {
      // Children: files produced by this worker
      const key = `${element.sessionName}:${element.windowName}`;
      const files = this.windowFiles.get(key) ?? [];
      if (files.length === 0) return [];

      // Show most recent files first, deduplicate by path (keep latest action)
      const byPath = new Map<string, FileActivity>();
      for (const f of files) {
        byPath.set(f.path, f);
      }

      return Array.from(byPath.values())
        .reverse()
        .map(
          (f) =>
            new SessionTreeItem(
              basename(f.path),
              'file',
              vscode.TreeItemCollapsibleState.None,
              element.sessionName,
              element.windowName,
              undefined,
              f
            )
        );
    }

    return [];
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private _windowLabel(w: TmuxWindow, fileCount: number): string {
    const activeMarker = w.active ? ' ●' : ' ○';
    const fileMarker = fileCount > 0 ? ` [${fileCount} files]` : '';
    return `${w.name}${activeMarker}${fileMarker}`;
  }

  // -------------------------------------------------------------------------
  // Public accessors for command handlers
  // -------------------------------------------------------------------------

  getSessions(): TmuxSession[] {
    return this.sessions;
  }
}
