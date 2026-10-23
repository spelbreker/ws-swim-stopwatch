import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface Banner {
  id: string;
  filename: string;
  durationSec: number;
  enabled: boolean;
}

export interface BannerConfig {
  showDisclaimer: boolean;
  disclaimerSec: number;
  // Array order is the rotation order on the screen
  banners: Banner[];
}

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  showDisclaimer: true,
  disclaimerSec: 10,
  banners: [],
};

export const MIN_DURATION_SEC = 1;
export const MAX_DURATION_SEC = 300;
export const DEFAULT_DURATION_SEC = 10;
export const MAX_BANNERS = 20;
export const MAX_BANNER_BYTES = 2 * 1024 * 1024;

let cached: BannerConfig | null = null;

function configFile(): string {
  return path.join(process.env.CONFIG_DIR || './config', 'banners.json');
}

/**
 * Directory holding the uploaded banner images (DATA_DIR/banners, default ./data/banners).
 */
export function bannersDir(): string {
  return path.resolve(process.cwd(), process.env.DATA_DIR || './data', 'banners');
}

export function isValidDurationSec(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_DURATION_SEC
    && value <= MAX_DURATION_SEC;
}

/**
 * Detect the image type from its first bytes; the client-supplied mime type is not trusted.
 */
export function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function isBanner(value: unknown): value is Banner {
  const b = value as Banner;
  return typeof value === 'object' && value !== null
    && typeof b.id === 'string'
    && typeof b.filename === 'string'
    && /^[0-9a-f-]+\.(png|jpg|webp)$/.test(b.filename)
    && isValidDurationSec(b.durationSec)
    && typeof b.enabled === 'boolean';
}

function normalize(input: unknown): BannerConfig {
  const obj = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return {
    showDisclaimer: typeof obj.showDisclaimer === 'boolean' ? obj.showDisclaimer : DEFAULT_BANNER_CONFIG.showDisclaimer,
    disclaimerSec: isValidDurationSec(obj.disclaimerSec) ? obj.disclaimerSec : DEFAULT_BANNER_CONFIG.disclaimerSec,
    banners: Array.isArray(obj.banners) ? obj.banners.filter(isBanner) : [],
  };
}

/**
 * Load the banner configuration from config/banners.json (cached in memory).
 */
export function loadBanners(): BannerConfig {
  if (cached) return cached;
  let parsed: unknown = null;
  try {
    const file = configFile();
    if (fs.existsSync(file)) {
      parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (error) {
    console.error('[Banners] Error loading banners:', error);
  }
  cached = normalize(parsed);
  return cached;
}

/**
 * Persist the banner configuration and refresh the cache.
 */
export function saveBanners(config: BannerConfig): boolean {
  try {
    const file = configFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
    cached = config;
    return true;
  } catch (error) {
    console.error('[Banners] Error saving banners:', error);
    return false;
  }
}

/**
 * Validate a config update from the settings page. The banner list must contain
 * exactly the existing banner ids (in the new order); filenames are taken from
 * the stored config, never from the request. Returns null when invalid.
 */
export function parseConfigUpdate(input: unknown, current: BannerConfig = loadBanners()): BannerConfig | null {
  if (typeof input !== 'object' || input === null) return null;
  const { showDisclaimer, disclaimerSec, banners } = input as Record<string, unknown>;
  if (typeof showDisclaimer !== 'boolean' || !isValidDurationSec(disclaimerSec)) return null;
  if (!Array.isArray(banners) || banners.length !== current.banners.length) return null;
  const byId = new Map(current.banners.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const next: Banner[] = [];
  for (const item of banners) {
    const { id, durationSec, enabled } = (item ?? {}) as Record<string, unknown>;
    const existing = typeof id === 'string' ? byId.get(id) : undefined;
    if (!existing || seen.has(existing.id) || !isValidDurationSec(durationSec) || typeof enabled !== 'boolean') return null;
    seen.add(existing.id);
    next.push({ ...existing, durationSec, enabled });
  }
  return { showDisclaimer, disclaimerSec, banners: next };
}

export type AddBannerResult = Banner | 'invalid-image' | 'limit-reached' | 'write-failed';

/**
 * Store an uploaded image under a generated name and append it to the rotation.
 */
export function addBanner(buffer: Buffer): AddBannerResult {
  const ext = detectImageExtension(buffer);
  if (!ext) return 'invalid-image';
  const config = loadBanners();
  if (config.banners.length >= MAX_BANNERS) return 'limit-reached';
  const id = randomUUID();
  const banner: Banner = { id, filename: `${id}.${ext}`, durationSec: DEFAULT_DURATION_SEC, enabled: true };
  const file = path.join(bannersDir(), banner.filename);
  try {
    fs.mkdirSync(bannersDir(), { recursive: true });
    fs.writeFileSync(file, buffer);
  } catch (error) {
    console.error('[Banners] Error writing banner image:', error);
    return 'write-failed';
  }
  if (!saveBanners({ ...config, banners: [...config.banners, banner] })) {
    fs.rmSync(file, { force: true });
    return 'write-failed';
  }
  return banner;
}

/**
 * Remove a banner from the rotation and delete its image file.
 * Returns 'not-found' for an unknown id.
 */
export function deleteBanner(id: string): 'deleted' | 'not-found' | 'write-failed' {
  const config = loadBanners();
  const banner = config.banners.find((b) => b.id === id);
  if (!banner) return 'not-found';
  if (!saveBanners({ ...config, banners: config.banners.filter((b) => b.id !== id) })) return 'write-failed';
  try {
    fs.rmSync(path.join(bannersDir(), banner.filename), { force: true });
  } catch (error) {
    // The banner is already out of the rotation; an orphaned file is harmless
    console.error('[Banners] Error deleting banner image:', error);
  }
  return 'deleted';
}

export function resetBannersCache() {
  cached = null;
}
