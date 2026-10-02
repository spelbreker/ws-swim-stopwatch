import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { listHeatFiles, heatFilePath, clearHeatFiles } from '../modules/splashExport';

export function getSplashExports(_req: Request, res: Response) {
  try {
    res.json(listHeatFiles());
  } catch (err) {
    console.error('[SplashExport] Failed to list heat files:', err);
    res.status(500).json({ error: 'Failed to list heat files' });
  }
}

export function downloadSplashExport(req: Request, res: Response) {
  const name = String(req.params.file);
  const filePath = heatFilePath(name);
  if (!filePath) {
    res.status(400).json({ error: 'Invalid heat file name' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Heat file not found' });
    return;
  }
  // With root, only the file name is checked for dotfiles, so EXPORT_DIR may live under a dot-directory
  res.download(path.basename(filePath), name, { root: path.dirname(filePath) });
}

export function deleteSplashExports(_req: Request, res: Response) {
  try {
    res.json({ deleted: clearHeatFiles() });
  } catch (err) {
    console.error('[SplashExport] Failed to delete heat files:', err);
    res.status(500).json({ error: 'Failed to delete heat files' });
  }
}
