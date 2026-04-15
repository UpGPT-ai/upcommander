"use strict";
/**
 * ApprovalTreeProvider — VS Code TreeDataProvider for the Approval Queue sidebar.
 *
 * Shows agents in `waiting_approval` state, each with inline Approve / Deny buttons.
 *
 * Hierarchy (flat list — no nesting needed):
 *   ◉ project:worker — "task description"
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
exports.ApprovalTreeProvider = exports.ApprovalTreeItem = void 0;
const vscode = __importStar(require("vscode"));
// ---------------------------------------------------------------------------
// Tree item
// ---------------------------------------------------------------------------
class ApprovalTreeItem extends vscode.TreeItem {
    approval;
    constructor(approval) {
        super(`${approval.project}:${approval.worker}`, vscode.TreeItemCollapsibleState.None);
        this.approval = approval;
        this.contextValue = 'approval';
        const taskSnippet = approval.task.length > 60
            ? approval.task.slice(0, 57) + '…'
            : approval.task;
        this.description = taskSnippet || '(no task description)';
        this.tooltip = new vscode.MarkdownString([
            `**${approval.project}:${approval.worker}**`,
            '',
            `Task: ${approval.task || '(none)'}`,
            '',
            `Waiting since: ${new Date(approval.since).toLocaleString()}`,
        ].join('\n'));
        this.iconPath = new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('charts.yellow'));
    }
}
exports.ApprovalTreeItem = ApprovalTreeItem;
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
class ApprovalTreeProvider {
    client;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    approvals = [];
    connected = false;
    constructor(client) {
        this.client = client;
    }
    // -------------------------------------------------------------------------
    // Data update
    // -------------------------------------------------------------------------
    refresh(approvals) {
        if (approvals !== undefined) {
            this.approvals = approvals;
        }
        this._onDidChangeTreeData.fire();
    }
    setConnected(connected) {
        this.connected = connected;
        if (!connected) {
            this.approvals = [];
        }
        this._onDidChangeTreeData.fire();
    }
    async fetchAndRefresh() {
        try {
            this.approvals = await this.client.getApprovals();
        }
        catch {
            this.approvals = [];
        }
        this._onDidChangeTreeData.fire();
    }
    getCount() {
        return this.approvals.length;
    }
    getApprovals() {
        return this.approvals;
    }
    // -------------------------------------------------------------------------
    // TreeDataProvider implementation
    // -------------------------------------------------------------------------
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element)
            return []; // No nested children
        if (!this.connected) {
            const placeholder = new vscode.TreeItem('Not connected', vscode.TreeItemCollapsibleState.None);
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
exports.ApprovalTreeProvider = ApprovalTreeProvider;
//# sourceMappingURL=approval-provider.js.map