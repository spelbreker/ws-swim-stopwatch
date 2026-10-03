"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSplashExports = getSplashExports;
exports.downloadSplashExport = downloadSplashExport;
exports.deleteSplashExports = deleteSplashExports;
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
    if (!(0, splashExport_1.parseHeatFilename)(name)) {
        res.status(400).json({ error: 'Invalid heat file name' });
        return;
    }
    // root keeps the download inside the export directory, also when EXPORT_DIR is under a dot-directory
    res.download(name, name, { root: (0, splashExport_1.splashExportDir)() }, (err) => {
        if (!err || res.headersSent)
            return;
        // send reports a missing file as status 404 (code ENOENT)
        if (err.status === 404) {
            res.status(404).json({ error: 'Heat file not found' });
        }
        else {
            console.error('[SplashExport] Failed to send heat file:', err);
            res.status(500).json({ error: 'Failed to send heat file' });
        }
    });
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
