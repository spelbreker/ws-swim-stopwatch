import fs from 'fs';
import path from 'path';

export type PoolLength = 25 | 50;

export interface AppSettings {
  poolLength: PoolLength;
  splitCooldownSec: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  poolLength: 25,
  splitCooldownSec: 12,
};

export const MIN_COOLDOWN_SEC = 1;
export const MAX_COOLDOWN_SEC = 60;

let cached: AppSettings | null = null;

function settingsFile(): string {
  return path.join(process.env.CONFIG_DIR || './config', 'app.json');
}

export function isValidPoolLength(value: unknown): value is PoolLength {
  return value === 25 || value === 50;
}

export function isValidCooldownSec(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_COOLDOWN_SEC
    && value <= MAX_COOLDOWN_SEC;
}

/**
 * Normalize unknown input into AppSettings, falling back to defaults per field.
 */
function normalize(input: unknown): AppSettings {
  const obj = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  return {
    poolLength: isValidPoolLength(obj.poolLength) ? obj.poolLength : DEFAULT_SETTINGS.poolLength,
    splitCooldownSec: isValidCooldownSec(obj.splitCooldownSec) ? obj.splitCooldownSec : DEFAULT_SETTINGS.splitCooldownSec,
  };
}

/**
 * Load application settings from config/app.json (cached in memory).
 * Missing or invalid file/fields fall back to defaults.
 */
export function loadSettings(): AppSettings {
  if (cached) return cached;
  let parsed: unknown = null;
  try {
    const file = settingsFile();
    if (fs.existsSync(file)) {
      parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
  }
  cached = normalize(parsed);
  return cached;
}

/**
 * Persist application settings to config/app.json and refresh the cache.
 */
export function saveSettings(settings: AppSettings): boolean {
  try {
    const file = settingsFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2));
    cached = { ...settings };
    return true;
  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
    return false;
  }
}

export function resetSettingsCache() {
  cached = null;
}
