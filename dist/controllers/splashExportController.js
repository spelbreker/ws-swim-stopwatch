"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplashExports = getSplashExports;
exports.downloadSplashExport = downloadSplashExport;
exports.deleteSplashExports = deleteSplashExports;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const splashExport_1 = require("../modules/splashExport");
function getSplashExports(_req, res) {
    try {
        res.json((0, splashExport_1.listHeatFiles)());
    }
    catch (err) {
        console.error('[SplashExport] Failed to list heat files:', err);
        res.status(500).json({ error: 'Failed to list heat files' });
    }
}
function downloadSplashExport(req, res) {
    const name = String(req.params.file);
    const filePath = (0, splashExport_1.heatFilePath)(name);
    if (!filePath) {
        res.status(400).json({ error: 'Invalid heat file name' });
        return;
    }
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ error: 'Heat file not found' });
        return;
    }
    // With root, only the file name is checked for dotfiles, so EXPORT_DIR may live under a dot-directory
    res.download(path_1.default.basename(filePath), name, { root: path_1.default.dirname(filePath) });
}
function deleteSplashExports(_req, res) {
    try {
        res.json({ deleted: (0, splashExport_1.clearHeatFiles)() });
    }
    catch (err) {
        console.error('[SplashExport] Failed to delete heat files:', err);
        res.status(500).json({ error: 'Failed to delete heat files' });
    }
}
