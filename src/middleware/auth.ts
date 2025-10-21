import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

/**
 * API Key authentication middleware
 * Validates X-API-Key header against configured API key
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    res.status(401).json({
      error: 'Missing X-API-Key header',
    });
    return;
  }

  if (apiKey !== config.adminApi.apiKey) {
    res.status(401).json({
      error: 'Invalid API key',
    });
    return;
  }

  next();
}
