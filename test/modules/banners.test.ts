import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadBanners,
  addBanner,
  deleteBanner,
  parseConfigUpdate,
  detectImageExtension,
  resetBannersCache,
  bannersDir,
  DEFAULT_BANNER_CONFIG,
  MAX_BANNERS,
  Banner,
} from '../../src/modules/banners';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

describe('banners module', () => {
  let tmpDir: string;
  const originalConfigDir = process.env.CONFIG_DIR;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banners-test-'));
    process.env.CONFIG_DIR = path.join(tmpDir, 'config');
    process.env.DATA_DIR = path.join(tmpDir, 'data');
    resetBannersCache();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalConfigDir === undefined) delete process.env.CONFIG_DIR;
    else process.env.CONFIG_DIR = originalConfigDir;
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    resetBannersCache();
  });

  it('returns defaults when no file exists', () => {
    expect(loadBanners()).toEqual(DEFAULT_BANNER_CONFIG);
  });

  it('detects png, jpg and webp by content and rejects other files', () => {
    expect(detectImageExtension(PNG)).toBe('png');
    expect(detectImageExtension(JPG)).toBe('jpg');
    expect(detectImageExtension(WEBP)).toBe('webp');
    expect(detectImageExtension(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull();
  });

  it('stores an uploaded image under a generated name and persists it', () => {
    const banner = addBanner(PNG) as Banner;
    expect(banner.filename).toMatch(/^[0-9a-f-]+\.png$/);
    expect(banner).toMatchObject({ durationSec: 10, enabled: true });
    expect(fs.readFileSync(path.join(bannersDir(), banner.filename))).toEqual(PNG);

    resetBannersCache();
    expect(loadBanners().banners).toEqual([banner]);
  });

  it('rejects non-images and stops at the banner limit', () => {
    expect(addBanner(Buffer.from('not an image'))).toBe('invalid-image');
    for (let i = 0; i < MAX_BANNERS; i++) addBanner(JPG);
    expect(addBanner(JPG)).toBe('limit-reached');
    expect(fs.readdirSync(bannersDir())).toHaveLength(MAX_BANNERS);
  });

  it('deletes the banner and its file', () => {
    const banner = addBanner(PNG) as Banner;
    expect(deleteBanner(banner.id)).toBe('deleted');
    expect(loadBanners().banners).toEqual([]);
    expect(fs.existsSync(path.join(bannersDir(), banner.filename))).toBe(false);
    expect(deleteBanner(banner.id)).toBe('not-found');
  });

  it('applies a reorder with new durations and keeps stored filenames', () => {
    const a = addBanner(PNG) as Banner;
    const b = addBanner(JPG) as Banner;
    const next = parseConfigUpdate({
      showDisclaimer: false,
      disclaimerSec: 5,
      banners: [
        { id: b.id, durationSec: 20, enabled: false, filename: '../../etc/passwd' },
        { id: a.id, durationSec: 15, enabled: true },
      ],
    });
    expect(next).toEqual({
      showDisclaimer: false,
      disclaimerSec: 5,
      banners: [
        { ...b, durationSec: 20, enabled: false },
        { ...a, durationSec: 15, enabled: true },
      ],
    });
  });

  it.each<[string, (id: string) => unknown]>([
    ['not an object', () => null],
    ['missing banner', () => ({ showDisclaimer: true, disclaimerSec: 10, banners: [] })],
    ['duplicate banner', (id) => ({
      showDisclaimer: true,
      disclaimerSec: 10,
      banners: [{ id, durationSec: 10, enabled: true }, { id, durationSec: 10, enabled: true }],
    })],
    ['unknown id', () => ({ showDisclaimer: true, disclaimerSec: 10, banners: [{ id: 'nope', durationSec: 10, enabled: true }] })],
    ['duration too long', (id) => ({ showDisclaimer: true, disclaimerSec: 301, banners: [{ id, durationSec: 10, enabled: true }] })],
    ['non-integer duration', (id) => ({ showDisclaimer: true, disclaimerSec: 10, banners: [{ id, durationSec: 1.5, enabled: true }] })],
    ['showDisclaimer not boolean', (id) => ({ showDisclaimer: 'yes', disclaimerSec: 10, banners: [{ id, durationSec: 10, enabled: true }] })],
  ])('rejects an invalid update: %s', (_label, makeBody) => {
    const a = addBanner(PNG) as Banner;
    expect(parseConfigUpdate(makeBody(a.id))).toBeNull();
  });
});
