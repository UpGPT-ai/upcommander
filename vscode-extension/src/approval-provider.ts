/**
 * ApprovalTreeProvider — VS Code TreeDataProvider for the Approval Queue sidebar.
 *
 * Shows agents in `waiting_approval` state, each with inline Approve / Deny buttons.
 *
 * Hierarchy (flat list — no nesting needed):
 *   ◉ project:worker — "task description"
 */

import * as vscode from 'vscode';
import type { BridgeClient, ApprovalItem } from './bridge-client';

// ---------------------------------------------------------------------------
// Tree item
// ---------------------------------------------------------------------------

export class ApprovalTreeItem extends vscode.TreeItem {
  constructor(public readonly approval: ApprovalItem) {
    super(
      `${approval.project}:${approval.worker}`,
      vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = 'approval';

    const taskSnippet =
      approval.task.length > 60
        ? approval.task.slice(0, 57) + '…'
        : approval.task;

    this.description = taskSnippet || '(no task description)';
    this.tooltip = new vscode.MarkdownString(
      [
        `**${approval.project}:${approval.worker}**`,
        '',
        `Task: ${approval.task || '(none)'}`,
        '',
        `Waiting since: ${new Date(approval.since).toLocaleString()}`,
      ].join('\n')
    );

    this.iconPath = new vscode.ThemeIcon(
      'bell-dot',
      new vscode.ThemeColor('charts.yellow')
    );
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class ApprovalTreeProvider
  implements vscode.TreeDataProvider<ApprovalTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ApprovalTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private approvals: ApprovalItem[] = [];
  private connected = false;

  constructor(private readonly client: BridgeClient) {}

  // -------------------------------------------------------------------------
  // Data update
  // -------------------------------------------------------------------------

  refresh(approvals?: ApprovalItem[]): void {
    if (approvals !== undefined) {
      this.approvals = approvals;
    }
    this._onDidChangeTreeData.fire();
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) {
      this.approvals = [];
    }
    this._onDidChangeTreeData.fire();
  }

  async fetchAndRefresh(): Promise<void> {
    try {
      this.approvals = await this.client.getApprovals();
    } catch {
      this.approvals = [];
    }
    this._onDidChangeTreeData.fire();
  }

  getCount(): number {
    return this.approvals.length;
  }

  getApprovals(): ApprovalItem[] {
    return this.approvals;
  }

  // -------------------------------------------------------------------------
  // TreeDataProvider implementation
  // -------------------------------------------------------------------------

  getTreeItem(element: ApprovalTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: ApprovalTreeItem
  ): vscode.ProviderResult<ApprovalTreeItem[]> {
    if (element) return []; // No nested children

    if (!this.connected) {
      const placeholder = new vscode.TreeItem(
        'Not connected',
        vscode.TreeItemCollapsibleState.None
      );
      placeholder.iconPath = new vscode.ThemeIcon('info');
      // Return as-is — TreeDataProvider accepts TreeItem subclasses
      return [];
    }

    if (this.approvals.length === 0) {
      // Return empty — VS Code will show the "No items" message
      return [];
    }

    return this.approvals.map((a) => new ApprovalTreeItem(a));
  }
}
