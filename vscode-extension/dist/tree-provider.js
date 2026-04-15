"use strict";
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
exports.SessionTreeProvider = exports.SessionTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const path_1 = require("path");
class SessionTreeItem extends vscode.TreeItem {
    label;
    itemType;
    collapsibleState;
    sessionName;
    windowName;
    windowActive;
    fileActivity;
    constructor(label, itemType, collapsibleState, sessionName, windowName, windowActive, fileActivity) {
        super(label, collapsibleState);
        this.label = label;
        this.itemType = itemType;
        this.collapsibleState = collapsibleState;
        this.sessionName = sessionName;
        this.windowName = windowName;
        this.windowActive = windowActive;
        this.fileActivity = fileActivity;
        this.contextValue = itemType;
        if (itemType === 'session') {
            this.iconPath = new vscode.ThemeIcon('terminal-tmux');
            this.tooltip = `tmux session: ${label}`;
        }
        else if (itemType === 'window') {
            this.iconPath = windowActive
                ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
                : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.foreground'));
            this.tooltip = `${sessionName}:${windowName}${windowActive ? ' (active)' : ''}`;
        }
        else if (itemType === 'file' && fileActivity) {
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
            }
            catch {
                // Invalid path — ignore
            }
        }
        else {
            // empty placeholder
            this.iconPath = new vscode.ThemeIcon('info');
        }
    }
}
exports.SessionTreeItem = SessionTreeItem;
// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
class SessionTreeProvider {
    client;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    sessions = [];
    connected = false;
    // Track files per window: "session:window" → FileActivity[]
    windowFiles = new Map();
    constructor(client) {
        this.client = client;
    }
    // -------------------------------------------------------------------------
    // Data update
    // -------------------------------------------------------------------------
    refresh(tree) {
        if (tree) {
            this.sessions = tree.sessions;
        }
        this._onDidChangeTreeData.fire();
    }
    setConnected(connected) {
        this.connected = connected;
        if (!connected) {
            this.sessions = [];
            this.windowFiles.clear();
        }
        this._onDidChangeTreeData.fire();
    }
    async fetchAndRefresh() {
        try {
            const tree = await this.client.getSessions();
            this.sessions = tree.sessions;
        }
        catch {
            this.sessions = [];
        }
        this._onDidChangeTreeData.fire();
    }
    /**
     * Update file activity for a specific worker window.
     * Called when file_activity WebSocket events arrive.
     */
    updateFileActivity(session, window, files) {
        const key = `${session}:${window}`;
        this.windowFiles.set(key, files);
        this._onDidChangeTreeData.fire();
    }
    // -------------------------------------------------------------------------
    // TreeDataProvider implementation
    // -------------------------------------------------------------------------
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.connected) {
            return [
                new SessionTreeItem('Not connected — click Connect to Bridge', 'empty', vscode.TreeItemCollapsibleState.None),
            ];
        }
        if (!element) {
            // Root: list sessions
            if (this.sessions.length === 0) {
                return [
                    new SessionTreeItem('No tmux sessions found', 'empty', vscode.TreeItemCollapsibleState.None),
                ];
            }
            return this.sessions.map((s) => new SessionTreeItem(`${s.name}  (${s.windows.length} window${s.windows.length !== 1 ? 's' : ''})`, 'session', vscode.TreeItemCollapsibleState.Expanded, s.name));
        }
        if (element.itemType === 'session' && element.sessionName) {
            // Children: windows for this session
            const session = this.sessions.find((s) => s.name === element.sessionName);
            if (!session)
                return [];
            return session.windows.map((w) => {
                const key = `${session.name}:${w.name}`;
                const files = this.windowFiles.get(key) ?? [];
                const hasFiles = files.length > 0;
                return new SessionTreeItem(this._windowLabel(w, files.length), 'window', hasFiles ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, session.name, w.name, w.active);
            });
        }
        if (element.itemType === 'window' && element.sessionName && element.windowName) {
            // Children: files produced by this worker
            const key = `${element.sessionName}:${element.windowName}`;
            const files = this.windowFiles.get(key) ?? [];
            if (files.length === 0)
                return [];
            // Show most recent files first, deduplicate by path (keep latest action)
            const byPath = new Map();
            for (const f of files) {
                byPath.set(f.path, f);
            }
            return Array.from(byPath.values())
                .reverse()
                .map((f) => new SessionTreeItem((0, path_1.basename)(f.path), 'file', vscode.TreeItemCollapsibleState.None, element.sessionName, element.windowName, undefined, f));
        }
        return [];
    }
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    _windowLabel(w, fileCount) {
        const activeMarker = w.active ? ' ●' : ' ○';
        const fileMarker = fileCount > 0 ? ` [${fileCount} files]` : '';
        return `${w.name}${activeMarker}${fileMarker}`;
    }
    // -------------------------------------------------------------------------
    // Public accessors for command handlers
    // -------------------------------------------------------------------------
    getSessions() {
        return this.sessions;
    }
}
exports.SessionTreeProvider = SessionTreeProvider;
//# sourceMappingURL=tree-provider.js.map