/**
 * tmux session registry — parses tmux state into structured data
 * and provides send-keys abstraction for routing prompts.
 */

import { execSync } from 'node:child_process';

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

/**
 * Parse tmux ls into structured session tree.
 * Returns empty tree if tmux server is not running.
 */
export function getSessionTree(): SessionTree {
  try {
    const raw = execSync('tmux ls -F "#{session_name}"', {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();

    if (!raw) return { sessions: [] };

    const sessionNames = raw.split('\n').filter(Boolean);
    const sessions: TmuxSession[] = sessionNames.map((session) => {
      const windowsRaw = execSync(
        `tmux list-windows -t "${session}" -F "#{window_name}:#{pane_pid}:#{window_active}"`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();

      const windows: TmuxWindow[] = windowsRaw
        .split('\n')
        .filter(Boolean)
        .map((w) => {
          const [name, pid, active] = w.split(':');
          return {
            name,
            pane_pid: parseInt(pid, 10),
            active: active === '1',
          };
        });

      return { name: session, windows };
    });

    return { sessions };
  } catch {
    // tmux server not running or not installed
    return { sessions: [] };
  }
}

/**
 * Send a prompt to a specific tmux session:window.
 * Sanitizes input to prevent shell injection via send-keys.
 */
export function sendKeys(session: string, window: string, prompt: string): void {
  validateTarget(session, window);
  const sanitized = sanitizePrompt(prompt);
  execSync(
    `tmux send-keys -t "${session}:${window}" ${shellQuote(sanitized)} Enter`,
    { encoding: 'utf8', timeout: 10000 }
  );
}

/**
 * Send a prompt to ALL windows in a session.
 */
export function broadcastToSession(session: string, prompt: string): string[] {
  const tree = getSessionTree();
  const sess = tree.sessions.find((s) => s.name === session);
  if (!sess) throw new Error(`Session "${session}" not found`);

  const sent: string[] = [];
  for (const win of sess.windows) {
    sendKeys(session, win.name, prompt);
    sent.push(`${session}:${win.name}`);
  }
  return sent;
}

/**
 * Send a prompt to ALL windows in ALL sessions.
 */
export function broadcastToAll(prompt: string): string[] {
  const tree = getSessionTree();
  const sent: string[] = [];
  for (const sess of tree.sessions) {
    for (const win of sess.windows) {
      sendKeys(sess.name, win.name, prompt);
      sent.push(`${sess.name}:${win.name}`);
    }
  }
  return sent;
}

/**
 * Create a new tmux session with named windows.
 * Each window launches claude in terminal mode.
 */
export function createSession(
  sessionName: string,
  projectPath: string,
  workers: string[]
): void {
  if (workers.length === 0) {
    throw new Error('At least one worker name is required');
  }

  // Create session with first worker as initial window
  execSync(
    `tmux new-session -d -s "${sessionName}" -n "${workers[0]}" -c "${projectPath}"`,
    { encoding: 'utf8', timeout: 10000 }
  );

  // Launch claude in the first window
  execSync(
    `tmux send-keys -t "${sessionName}:${workers[0]}" "claude" Enter`,
    { encoding: 'utf8', timeout: 5000 }
  );

  // Create remaining windows
  for (let i = 1; i < workers.length; i++) {
    execSync(
      `tmux new-window -t "${sessionName}" -n "${workers[i]}" -c "${projectPath}"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    execSync(
      `tmux send-keys -t "${sessionName}:${workers[i]}" "claude" Enter`,
      { encoding: 'utf8', timeout: 5000 }
    );
  }
}

/**
 * Check if a tmux session exists.
 */
export function sessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

// --- Internal helpers ---

/**
 * Sanitize prompt text to prevent shell injection via tmux send-keys.
 * Strips dangerous shell metacharacters.
 */
function sanitizePrompt(prompt: string): string {
  // Remove backticks, $(), and other command substitution patterns
  return prompt
    .replace(/`/g, "'")
    .replace(/\$\(/g, '(')
    .replace(/\$\{/g, '{');
}

/**
 * Shell-quote a string for safe use in tmux send-keys.
 */
function shellQuote(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate session and window names contain only safe characters.
 */
function validateTarget(session: string, window: string): void {
  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(session)) {
    throw new Error(`Invalid session name: "${session}"`);
  }
  if (!safePattern.test(window)) {
    throw new Error(`Invalid window name: "${window}"`);
  }
}
