import { Request, Response } from 'express';
import {
  loadSettings,
  saveSettings,
  isValidPoolLength,
  isValidCooldownSec,
  MIN_COOLDOWN_SEC,
  MAX_COOLDOWN_SEC,
} from '../modules/settings';

export function getSettings(req: Request, res: Response) {
  res.json(loadSettings());
}

export function postSettings(req: Request, res: Response) {
  const { poolLength, splitCooldownSec } = req.body ?? {};
  if (!isValidPoolLength(poolLength)) {
    res.status(400).json({ error: 'poolLength must be 25 or 50' });
    return;
  }
  if (!isValidCooldownSec(splitCooldownSec)) {
    res.status(400).json({ error: `splitCooldownSec must be an integer between ${MIN_COOLDOWN_SEC} and ${MAX_COOLDOWN_SEC}` });
    return;
  }
  if (!saveSettings({ poolLength, splitCooldownSec })) {
    res.status(500).json({ error: 'Failed to save settings' });
    return;
  }
  res.json({ success: true, settings: { poolLength, splitCooldownSec } });
}
