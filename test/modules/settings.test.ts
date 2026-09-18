import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSettings,
  saveSettings,
  resetSettingsCache,
  DEFAULT_SETTINGS,
} from '../../src/modules/settings';

describe('settings module', () => {
  let tmpDir: string;
  const originalConfigDir = process.env.CONFIG_DIR;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
    process.env.CONFIG_DIR = tmpDir;
    resetSettingsCache();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalConfigDir === undefined) delete process.env.CONFIG_DIR;
    else process.env.CONFIG_DIR = originalConfigDir;
    resetSettingsCache();
  });

  it('returns defaults when no file exists', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings()).toEqual({ poolLength: 25, splitCooldownSec: 12 });
  });

  it('saves and reloads settings from app.json', () => {
    expect(saveSettings({ poolLength: 50, splitCooldownSec: 20 })).toBe(true);
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'app.json'), 'utf-8'));
    expect(written).toEqual({ poolLength: 50, splitCooldownSec: 20 });

    resetSettingsCache();
    expect(loadSettings()).toEqual({ poolLength: 50, splitCooldownSec: 20 });
  });

  it('refreshes the cache on save', () => {
    expect(loadSettings().poolLength).toBe(25);
    saveSettings({ poolLength: 50, splitCooldownSec: 12 });
    expect(loadSettings().poolLength).toBe(50);
  });

  it('caches the loaded settings in memory', () => {
    loadSettings();
    fs.writeFileSync(path.join(tmpDir, 'app.json'), JSON.stringify({ poolLength: 50, splitCooldownSec: 5 }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    resetSettingsCache();
    expect(loadSettings()).toEqual({ poolLength: 50, splitCooldownSec: 5 });
  });

  it('falls back to defaults for invalid fields', () => {
    fs.writeFileSync(path.join(tmpDir, 'app.json'), JSON.stringify({ poolLength: 33, splitCooldownSec: 999 }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults for a corrupt file', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    fs.writeFileSync(path.join(tmpDir, 'app.json'), '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    errorSpy.mockRestore();
  });

  it('uses a separate file from tunnel.json', () => {
    saveSettings({ poolLength: 25, splitCooldownSec: 12 });
    expect(fs.existsSync(path.join(tmpDir, 'app.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tunnel.json'))).toBe(false);
  });
});
