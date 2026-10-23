import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  loadBanners,
  saveBanners,
  parseConfigUpdate,
  addBanner,
  deleteBanner,
  MAX_BANNERS,
  MAX_BANNER_BYTES,
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
} from '../modules/banners';
import { broadcast } from '../websockets/websocket';

// In memory: the module checks the bytes and writes the file under a generated name
const bannerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BANNER_BYTES, files: 1 } }).single('banner');

function notifyScreens() {
  broadcast({ type: 'banners-updated' });
}

/**
 * Multer wrapper that turns upload errors (e.g. file too large) into a 400 instead of a 500.
 */
export function receiveBannerFile(req: Request, res: Response, next: NextFunction) {
  bannerUpload(req, res, (err: unknown) => {
    if (err) {
      const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({ error: tooLarge ? `Image must be at most ${MAX_BANNER_BYTES / 1024 / 1024} MB` : 'Invalid upload' });
      return;
    }
    next();
  });
}

export function getBanners(req: Request, res: Response) {
  res.json(loadBanners());
}

export function uploadBanner(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: 'No image uploaded' });
    return;
  }
  const result = addBanner(req.file.buffer);
  if (result === 'invalid-image') {
    res.status(400).json({ error: 'Only PNG, JPG and WebP images are allowed' });
    return;
  }
  if (result === 'limit-reached') {
    res.status(400).json({ error: `At most ${MAX_BANNERS} banners are allowed` });
    return;
  }
  if (result === 'write-failed') {
    res.status(500).json({ error: 'Failed to store banner' });
    return;
  }
  notifyScreens();
  res.json({ success: true, banner: result });
}

export function putBannerConfig(req: Request, res: Response) {
  const config = parseConfigUpdate(req.body);
  if (!config) {
    res.status(400).json({
      error: `Invalid banner config: list every existing banner once; durations must be integers between ${MIN_DURATION_SEC} and ${MAX_DURATION_SEC}`,
    });
    return;
  }
  if (!saveBanners(config)) {
    res.status(500).json({ error: 'Failed to save banners' });
    return;
  }
  notifyScreens();
  res.json({ success: true, config });
}

export function removeBanner(req: Request, res: Response) {
  const result = deleteBanner(String(req.params.id));
  if (result === 'not-found') {
    res.status(404).json({ error: 'Banner not found' });
    return;
  }
  if (result === 'write-failed') {
    res.status(500).json({ error: 'Failed to delete banner' });
    return;
  }
  notifyScreens();
  res.json({ success: true });
}
