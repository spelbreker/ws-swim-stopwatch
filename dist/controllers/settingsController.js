"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.postSettings = postSettings;
const settings_1 = require("../modules/settings");
function getSettings(req, res) {
    res.json((0, settings_1.loadSettings)());
}
function postSettings(req, res) {
    const { poolLength, splitCooldownSec } = req.body ?? {};
    if (!(0, settings_1.isValidPoolLength)(poolLength)) {
        res.status(400).json({ error: 'poolLength must be 25 or 50' });
        return;
    }
    if (!(0, settings_1.isValidCooldownSec)(splitCooldownSec)) {
        res.status(400).json({ error: `splitCooldownSec must be an integer between ${settings_1.MIN_COOLDOWN_SEC} and ${settings_1.MAX_COOLDOWN_SEC}` });
        return;
    }
    if (!(0, settings_1.saveSettings)({ poolLength, splitCooldownSec })) {
        res.status(500).json({ error: 'Failed to save settings' });
        return;
    }
    res.json({ success: true, settings: { poolLength, splitCooldownSec } });
}
