"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiveBannerFile = receiveBannerFile;
exports.getBanners = getBanners;
exports.uploadBanner = uploadBanner;
exports.putBannerConfig = putBannerConfig;
exports.removeBanner = removeBanner;
const multer_1 = __importDefault(require("multer"));
const banners_1 = require("../modules/banners");
const websocket_1 = require("../websockets/websocket");
// In memory: the module checks the bytes and writes the file under a generated name
const bannerUpload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: banners_1.MAX_BANNER_BYTES, files: 1 } }).single('banner');
function notifyScreens() {
    (0, websocket_1.broadcast)({ type: 'banners-updated' });
}
/**
 * Multer wrapper that turns upload errors (e.g. file too large) into a 400 instead of a 500.
 */
function receiveBannerFile(req, res, next) {
    bannerUpload(req, res, (err) => {
        if (err) {
            const tooLarge = err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE';
            res.status(400).json({ error: tooLarge ? `Image must be at most ${banners_1.MAX_BANNER_BYTES / 1024 / 1024} MB` : 'Invalid upload' });
            return;
        }
        next();
    });
}
function getBanners(req, res) {
    res.json((0, banners_1.loadBanners)());
}
function uploadBanner(req, res) {
    if (!req.file) {
        res.status(400).json({ error: 'No image uploaded' });
        return;
    }
    const result = (0, banners_1.addBanner)(req.file.buffer);
    if (result === 'invalid-image') {
        res.status(400).json({ error: 'Only PNG, JPG and WebP images are allowed' });
        return;
    }
    if (result === 'limit-reached') {
        res.status(400).json({ error: `At most ${banners_1.MAX_BANNERS} banners are allowed` });
        return;
    }
    if (result === 'write-failed') {
        res.status(500).json({ error: 'Failed to store banner' });
        return;
    }
    notifyScreens();
    res.json({ success: true, banner: result });
}
function putBannerConfig(req, res) {
    const config = (0, banners_1.parseConfigUpdate)(req.body);
    if (!config) {
        res.status(400).json({
            error: `Invalid banner config: list every existing banner once; durations must be integers between ${banners_1.MIN_DURATION_SEC} and ${banners_1.MAX_DURATION_SEC}`,
        });
        return;
    }
    if (!(0, banners_1.saveBanners)(config)) {
        res.status(500).json({ error: 'Failed to save banners' });
        return;
    }
    notifyScreens();
    res.json({ success: true, config });
}
function removeBanner(req, res) {
    const result = (0, banners_1.deleteBanner)(String(req.params.id));
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
