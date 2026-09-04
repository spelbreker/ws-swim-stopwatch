"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_COOLDOWN_SEC = exports.MIN_COOLDOWN_SEC = exports.DEFAULT_SETTINGS = void 0;
exports.isValidPoolLength = isValidPoolLength;
exports.isValidCooldownSec = isValidCooldownSec;
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.resetSettingsCache = resetSettingsCache;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.DEFAULT_SETTINGS = {
    poolLength: 25,
    splitCooldownSec: 12,
};
exports.MIN_COOLDOWN_SEC = 1;
exports.MAX_COOLDOWN_SEC = 60;
let cached = null;
function settingsFile() {
    return path_1.default.join(process.env.CONFIG_DIR || './config', 'app.json');
}
function isValidPoolLength(value) {
    return value === 25 || value === 50;
}
function isValidCooldownSec(value) {
    return typeof value === 'number'
        && Number.isInteger(value)
        && value >= exports.MIN_COOLDOWN_SEC
        && value <= exports.MAX_COOLDOWN_SEC;
}
/**
 * Normalize unknown input into AppSettings, falling back to defaults per field.
 */
function normalize(input) {
    const obj = typeof input === 'object' && input !== null ? input : {};
    return {
        poolLength: isValidPoolLength(obj.poolLength) ? obj.poolLength : exports.DEFAULT_SETTINGS.poolLength,
        splitCooldownSec: isValidCooldownSec(obj.splitCooldownSec) ? obj.splitCooldownSec : exports.DEFAULT_SETTINGS.splitCooldownSec,
    };
}
/**
 * Load application settings from config/app.json (cached in memory).
 * Missing or invalid file/fields fall back to defaults.
 */
function loadSettings() {
    if (cached)
        return cached;
    let parsed = null;
    try {
        const file = settingsFile();
        if (fs_1.default.existsSync(file)) {
            parsed = JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
        }
    }
    catch (error) {
        console.error('[Settings] Error loading settings:', error);
    }
    cached = normalize(parsed);
    return cached;
}
/**
 * Persist application settings to config/app.json and refresh the cache.
 */
function saveSettings(settings) {
    try {
        const file = settingsFile();
        fs_1.default.mkdirSync(path_1.default.dirname(file), { recursive: true });
        fs_1.default.writeFileSync(file, JSON.stringify(settings, null, 2));
        cached = { ...settings };
        return true;
    }
    catch (error) {
        console.error('[Settings] Error saving settings:', error);
        return false;
    }
}
function resetSettingsCache() {
    cached = null;
}
