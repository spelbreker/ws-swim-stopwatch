"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BANNER_BYTES = exports.MAX_BANNERS = exports.DEFAULT_DURATION_SEC = exports.MAX_DURATION_SEC = exports.MIN_DURATION_SEC = exports.DEFAULT_BANNER_CONFIG = void 0;
exports.bannersDir = bannersDir;
exports.isValidDurationSec = isValidDurationSec;
exports.detectImageExtension = detectImageExtension;
exports.loadBanners = loadBanners;
exports.saveBanners = saveBanners;
exports.parseConfigUpdate = parseConfigUpdate;
exports.addBanner = addBanner;
exports.deleteBanner = deleteBanner;
exports.resetBannersCache = resetBannersCache;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
exports.DEFAULT_BANNER_CONFIG = {
    showDisclaimer: true,
    disclaimerSec: 10,
    banners: [],
};
exports.MIN_DURATION_SEC = 1;
exports.MAX_DURATION_SEC = 300;
exports.DEFAULT_DURATION_SEC = 10;
exports.MAX_BANNERS = 20;
exports.MAX_BANNER_BYTES = 2 * 1024 * 1024;
let cached = null;
function configFile() {
    return path_1.default.join(process.env.CONFIG_DIR || './config', 'banners.json');
}
/**
 * Directory holding the uploaded banner images (DATA_DIR/banners, default ./data/banners).
 */
function bannersDir() {
    return path_1.default.resolve(process.cwd(), process.env.DATA_DIR || './data', 'banners');
}
function isValidDurationSec(value) {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value >= exports.MIN_DURATION_SEC
        && value <= exports.MAX_DURATION_SEC;
}
/**
 * Detect the image type from its first bytes; the client-supplied mime type is not trusted.
 */
function detectImageExtension(buffer) {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return 'png';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
        return 'jpg';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
        return 'webp';
    return null;
}
function isBanner(value) {
    const b = value;
    return typeof value === 'object' && value !== null
        && typeof b.id === 'string'
        && typeof b.filename === 'string'
        && /^[0-9a-f-]+\.(png|jpg|webp)$/.test(b.filename)
        && isValidDurationSec(b.durationSec)
        && typeof b.enabled === 'boolean';
}
function normalize(input) {
    const obj = typeof input === 'object' && input !== null ? input : {};
    return {
        showDisclaimer: typeof obj.showDisclaimer === 'boolean' ? obj.showDisclaimer : exports.DEFAULT_BANNER_CONFIG.showDisclaimer,
        disclaimerSec: isValidDurationSec(obj.disclaimerSec) ? obj.disclaimerSec : exports.DEFAULT_BANNER_CONFIG.disclaimerSec,
        banners: Array.isArray(obj.banners) ? obj.banners.filter(isBanner) : [],
    };
}
/**
 * Load the banner configuration from config/banners.json (cached in memory).
 */
function loadBanners() {
    if (cached)
        return cached;
    let parsed = null;
    try {
        const file = configFile();
        if (fs_1.default.existsSync(file)) {
            parsed = JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
        }
    }
    catch (error) {
        console.error('[Banners] Error loading banners:', error);
    }
    cached = normalize(parsed);
    return cached;
}
/**
 * Persist the banner configuration and refresh the cache.
 */
function saveBanners(config) {
    try {
        const file = configFile();
        fs_1.default.mkdirSync(path_1.default.dirname(file), { recursive: true });
        fs_1.default.writeFileSync(file, JSON.stringify(config, null, 2));
        cached = config;
        return true;
    }
    catch (error) {
        console.error('[Banners] Error saving banners:', error);
        return false;
    }
}
/**
 * Validate a config update from the settings page. The banner list must contain
 * exactly the existing banner ids (in the new order); filenames are taken from
 * the stored config, never from the request. Returns null when invalid.
 */
function parseConfigUpdate(input, current = loadBanners()) {
    if (typeof input !== 'object' || input === null)
        return null;
    const { showDisclaimer, disclaimerSec, banners } = input;
    if (typeof showDisclaimer !== 'boolean' || !isValidDurationSec(disclaimerSec))
        return null;
    if (!Array.isArray(banners) || banners.length !== current.banners.length)
        return null;
    const byId = new Map(current.banners.map((b) => [b.id, b]));
    const seen = new Set();
    const next = [];
    for (const item of banners) {
        const { id, durationSec, enabled } = (item ?? {});
        const existing = typeof id === 'string' ? byId.get(id) : undefined;
        if (!existing || seen.has(existing.id) || !isValidDurationSec(durationSec) || typeof enabled !== 'boolean')
            return null;
        seen.add(existing.id);
        next.push({ ...existing, durationSec, enabled });
    }
    return { showDisclaimer, disclaimerSec, banners: next };
}
/**
 * Store an uploaded image under a generated name and append it to the rotation.
 */
function addBanner(buffer) {
    const ext = detectImageExtension(buffer);
    if (!ext)
        return 'invalid-image';
    const config = loadBanners();
    if (config.banners.length >= exports.MAX_BANNERS)
        return 'limit-reached';
    const id = (0, crypto_1.randomUUID)();
    const banner = { id, filename: `${id}.${ext}`, durationSec: exports.DEFAULT_DURATION_SEC, enabled: true };
    const file = path_1.default.join(bannersDir(), banner.filename);
    try {
        fs_1.default.mkdirSync(bannersDir(), { recursive: true });
        fs_1.default.writeFileSync(file, buffer);
    }
    catch (error) {
        console.error('[Banners] Error writing banner image:', error);
        return 'write-failed';
    }
    if (!saveBanners({ ...config, banners: [...config.banners, banner] })) {
        fs_1.default.rmSync(file, { force: true });
        return 'write-failed';
    }
    return banner;
}
/**
 * Remove a banner from the rotation and delete its image file.
 * Returns 'not-found' for an unknown id.
 */
function deleteBanner(id) {
    const config = loadBanners();
    const banner = config.banners.find((b) => b.id === id);
    if (!banner)
        return 'not-found';
    if (!saveBanners({ ...config, banners: config.banners.filter((b) => b.id !== id) }))
        return 'write-failed';
    try {
        fs_1.default.rmSync(path_1.default.join(bannersDir(), banner.filename), { force: true });
    }
    catch (error) {
        // The banner is already out of the rotation; an orphaned file is harmless
        console.error('[Banners] Error deleting banner image:', error);
    }
    return 'deleted';
}
function resetBannersCache() {
    cached = null;
}
