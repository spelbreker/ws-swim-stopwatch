import { Request, Response } from 'express';
import { getDevices } from '../websockets/websocket';

// GET /devices - Get list of all devices (connected and disconnected)
export function getDevicesList(_req: Request, res: Response) {
  try {
    const devices = getDevices();
    res.json({ devices });
  } catch (error) {
    console.error('[getDevicesList] Error:', error);
    res.status(500).json({ error: 'Failed to get devices list' });
  }
}
