import { Request, Response } from 'express';
import {
  listHeatFiles,
  parseHeatFilename,
  splashExportDir,
  clearHeatFiles,
} from '../modules/splashExport';

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
  if (!parseHeatFilename(name)) {
    res.status(400).json({ error: 'Invalid heat file name' });
    return;
  }
  // root keeps the download inside the export directory, also when EXPORT_DIR is under a dot-directory
  res.download(name, name, { root: splashExportDir() }, (err) => {
    if (!err || res.headersSent) return;
    // send reports a missing file as status 404 (code ENOENT)
    if ((err as { status?: number }).status === 404) {
      res.status(404).json({ error: 'Heat file not found' });
    } else {
      console.error('[SplashExport] Failed to send heat file:', err);
      res.status(500).json({ error: 'Failed to send heat file' });
    }
  });
}

export function deleteSplashExports(_req: Request, res: Response) {
  try {
    res.json({ deleted: clearHeatFiles() });
  } catch (err) {
    console.error('[SplashExport] Failed to delete heat files:', err);
    res.status(500).json({ error: 'Failed to delete heat files' });
  }
}
