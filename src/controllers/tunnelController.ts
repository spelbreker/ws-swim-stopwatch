import { Request, Response } from 'express';
import {
  getStatus,
  startTunnel,
  stopTunnel,
  updateConfig,
  updatePartialConfig,
  deleteConfig,
} from '../modules/tunnel';

/**
 * Get tunnel status
 */
export function getTunnelStatus(_req: Request, res: Response): void {
  try {
    const status = getStatus();
    res.json(status);
  } catch (error) {
    console.error('[getTunnelStatus] Error:', error);
    res.status(500).json({ error: 'Failed to get tunnel status' });
  }
}

/**
 * Start the tunnel
 */
export function postTunnelStart(req: Request, res: Response): void {
  try {
    const { token } = req.body || {};
    const result = startTunnel(token);
    if (result.success) {
      res.json({ success: true, message: 'Tunnel started' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[postTunnelStart] Error:', error);
    res.status(500).json({ error: 'Failed to start tunnel' });
  }
}

/**
 * Stop the tunnel
 */
export function postTunnelStop(_req: Request, res: Response): void {
  try {
    const result = stopTunnel();
    if (result.success) {
      res.json({ success: true, message: 'Tunnel stopped' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[postTunnelStop] Error:', error);
    res.status(500).json({ error: 'Failed to stop tunnel' });
  }
}

/**
 * Update tunnel configuration
 */
export function postTunnelConfig(req: Request, res: Response): void {
  try {
    const { token, autoStart, allowAllRoutes } = req.body || {};
    
    // If no token provided, try partial update (only for existing config)
    if (!token) {
      // Build partial update object from provided fields
      const updates: Partial<{ autoStart: boolean; allowAllRoutes: boolean }> = {};
      if (typeof autoStart === 'boolean') {
        updates.autoStart = autoStart;
      }
      if (typeof allowAllRoutes === 'boolean') {
        updates.allowAllRoutes = allowAllRoutes;
      }
      
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid configuration fields provided' });
        return;
      }
      
      const result = updatePartialConfig(updates);
      if (result.success) {
        res.json({ success: true, message: 'Configuration updated' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
      return;
    }

    // Full config update with token
    if (typeof token !== 'string') {
      res.status(400).json({ error: 'Token must be a string' });
      return;
    }

    const result = updateConfig(token, autoStart === true, allowAllRoutes === true);
    if (result.success) {
      res.json({ success: true, message: 'Configuration saved' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[postTunnelConfig] Error:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
}

/**
 * Delete tunnel configuration
 */
export function deleteTunnelConfig(_req: Request, res: Response): void {
  try {
    const result = deleteConfig();
    if (result.success) {
      res.json({ success: true, message: 'Configuration deleted' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[deleteTunnelConfig] Error:', error);
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
}
