/**
 * Authentication layer — bearer token generation, validation, rate limiting.
 * Token is generated on bridge startup and written to ~/.claude-commander/auth-token.
 */
import type { Request, Response, NextFunction } from 'express';
/**
 * Generate a new 32-byte bearer token and write it to disk.
 * Returns the generated token.
 */
export declare function generateToken(): string;
/**
 * Load existing token from disk, or generate a new one.
 */
export declare function loadOrGenerateToken(): string;
/**
 * Get the current token (must call loadOrGenerateToken first).
 */
export declare function getToken(): string;
/**
 * Express middleware for bearer token authentication with rate limiting.
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Validate a WebSocket upgrade request's token.
 */
export declare function validateWsToken(url: string): boolean;
//# sourceMappingURL=auth.d.ts.map