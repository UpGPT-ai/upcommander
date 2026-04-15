/**
 * Authentication layer — bearer token generation, validation, rate limiting.
 * Token is generated on bridge startup and written to ~/.claude-commander/auth-token.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONFIG_DIR = join(homedir(), '.claude-commander');
const TOKEN_FILE = join(CONFIG_DIR, 'auth-token');
// Rate limiting state
const failedAttempts = new Map();
const MAX_FAILURES = 10;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
let currentToken = null;
/**
 * Generate a new 32-byte bearer token and write it to disk.
 * Returns the generated token.
 */
export function generateToken() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    const token = randomBytes(32).toString('hex');
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    currentToken = token;
    return token;
}
/**
 * Load existing token from disk, or generate a new one.
 */
export function loadOrGenerateToken() {
    if (currentToken)
        return currentToken;
    try {
        if (existsSync(TOKEN_FILE)) {
            const token = readFileSync(TOKEN_FILE, 'utf8').trim();
            if (token.length >= 32) {
                currentToken = token;
                return token;
            }
        }
    }
    catch {
        // Fall through to generate
    }
    return generateToken();
}
/**
 * Get the current token (must call loadOrGenerateToken first).
 */
export function getToken() {
    if (!currentToken)
        return loadOrGenerateToken();
    return currentToken;
}
/**
 * Express middleware for bearer token authentication with rate limiting.
 */
export function authMiddleware(req, res, next) {
    // Health endpoint is public
    if (req.path === '/health') {
        next();
        return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Check rate limiting
    const attempts = failedAttempts.get(ip);
    if (attempts && attempts.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        res.status(429).json({
            error: 'Too many failed attempts',
            retry_after_seconds: remaining,
        });
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        recordFailure(ip);
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.slice(7);
    if (token !== getToken()) {
        recordFailure(ip);
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    // Success — clear any failure tracking
    failedAttempts.delete(ip);
    next();
}
/**
 * Validate a WebSocket upgrade request's token.
 */
export function validateWsToken(url) {
    try {
        const parsed = new URL(url, 'http://localhost');
        const token = parsed.searchParams.get('token');
        return token === getToken();
    }
    catch {
        return false;
    }
}
function recordFailure(ip) {
    const current = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= MAX_FAILURES) {
        current.lockedUntil = Date.now() + LOCKOUT_MS;
        current.count = 0; // Reset count after lockout
    }
    failedAttempts.set(ip, current);
}
//# sourceMappingURL=auth.js.map