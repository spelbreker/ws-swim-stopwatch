"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.getStatus = getStatus;
exports.startTunnel = startTunnel;
exports.stopTunnel = stopTunnel;
exports.updateConfig = updateConfig;
exports.deleteConfig = deleteConfig;
exports.initTunnel = initTunnel;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cloudflared_1 = require("cloudflared");
const CONFIG_DIR = process.env.CONFIG_DIR || './config';
const CONFIG_FILE = path_1.default.join(CONFIG_DIR, 'tunnel.json');
let tunnelProcess = null;
let lastError = null;
/**
 * Load tunnel configuration from file
 */
function loadConfig() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            const data = fs_1.default.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('[Tunnel] Error loading config:', error);
    }
    return null;
}
/**
 * Save tunnel configuration to file
 */
function saveConfig(config) {
    try {
        if (!fs_1.default.existsSync(CONFIG_DIR)) {
            fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    }
    catch (error) {
        console.error('[Tunnel] Error saving config:', error);
        return false;
    }
}
/**
 * Get the current tunnel status
 */
function getStatus() {
    const config = loadConfig();
    return {
        running: tunnelProcess !== null && tunnelProcess.exitCode === null,
        pid: tunnelProcess?.pid ?? null,
        token: config?.token ? '***' + config.token.slice(-8) : null,
        autoStart: config?.autoStart ?? false,
        error: lastError,
    };
}
/**
 * Start the Cloudflare tunnel
 */
function startTunnel(token) {
    if (tunnelProcess !== null && tunnelProcess.exitCode === null) {
        return { success: false, error: 'Tunnel is already running' };
    }
    // Use provided token or load from config
    const config = loadConfig();
    const tunnelToken = token || config?.token;
    if (!tunnelToken) {
        return { success: false, error: 'No tunnel token configured' };
    }
    // Save the token if a new one was provided
    if (token) {
        saveConfig({ token, autoStart: config?.autoStart ?? false });
    }
    lastError = null;
    try {
        // Use the cloudflared binary from the npm package
        tunnelProcess = (0, child_process_1.spawn)(cloudflared_1.bin, [
            'tunnel',
            '--no-autoupdate',
            'run',
            '--token',
            tunnelToken,
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
        });
        tunnelProcess.stdout?.on('data', (data) => {
            console.log(`[Tunnel] ${data.toString().trim()}`);
        });
        tunnelProcess.stderr?.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[Tunnel] ${message}`);
            // Capture connection errors
            if (message.includes('error') || message.includes('failed')) {
                lastError = message;
            }
        });
        tunnelProcess.on('close', (code) => {
            console.log(`[Tunnel] Process exited with code ${code}`);
            if (code !== 0 && code !== null) {
                lastError = `Tunnel exited with code ${code}`;
            }
            tunnelProcess = null;
        });
        tunnelProcess.on('error', (err) => {
            console.error('[Tunnel] Failed to start:', err.message);
            lastError = err.message;
            tunnelProcess = null;
        });
        console.log(`[Tunnel] Started with PID ${tunnelProcess.pid}`);
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = errorMessage;
        return { success: false, error: errorMessage };
    }
}
/**
 * Stop the Cloudflare tunnel
 */
function stopTunnel() {
    if (tunnelProcess === null || tunnelProcess.exitCode !== null) {
        return { success: false, error: 'Tunnel is not running' };
    }
    try {
        tunnelProcess.kill('SIGTERM');
        console.log('[Tunnel] Stop signal sent');
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
/**
 * Update tunnel configuration
 */
function updateConfig(token, autoStart) {
    const saved = saveConfig({ token, autoStart });
    if (!saved) {
        return { success: false, error: 'Failed to save configuration' };
    }
    return { success: true };
}
/**
 * Delete tunnel configuration
 */
function deleteConfig() {
    try {
        if (fs_1.default.existsSync(CONFIG_FILE)) {
            fs_1.default.unlinkSync(CONFIG_FILE);
        }
        return { success: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
    }
}
/**
 * Initialize tunnel on startup if autoStart is enabled
 */
function initTunnel() {
    const config = loadConfig();
    if (config?.autoStart && config?.token) {
        console.log('[Tunnel] Auto-starting tunnel...');
        const result = startTunnel();
        if (!result.success) {
            console.error('[Tunnel] Auto-start failed:', result.error);
        }
    }
}
