import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { bin } from 'cloudflared';

const CONFIG_DIR = process.env.CONFIG_DIR || './config';
const CONFIG_FILE = path.join(CONFIG_DIR, 'tunnel.json');

interface TunnelConfig {
  token: string;
  autoStart: boolean;
}

interface TunnelStatus {
  running: boolean;
  pid: number | null;
  token: string | null;
  autoStart: boolean;
  error: string | null;
}

let tunnelProcess: ChildProcess | null = null;
let lastError: string | null = null;

/**
 * Load tunnel configuration from file
 */
export function loadConfig(): TunnelConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Tunnel] Error loading config:', error);
  }
  return null;
}

/**
 * Save tunnel configuration to file
 */
export function saveConfig(config: TunnelConfig): boolean {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('[Tunnel] Error saving config:', error);
    return false;
  }
}

/**
 * Get the current tunnel status
 */
export function getStatus(): TunnelStatus {
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
export function startTunnel(token?: string): { success: boolean; error?: string } {
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
    tunnelProcess = spawn(bin, [
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    lastError = errorMessage;
    return { success: false, error: errorMessage };
  }
}

/**
 * Stop the Cloudflare tunnel
 */
export function stopTunnel(): { success: boolean; error?: string } {
  if (tunnelProcess === null || tunnelProcess.exitCode !== null) {
    return { success: false, error: 'Tunnel is not running' };
  }

  try {
    tunnelProcess.kill('SIGTERM');
    console.log('[Tunnel] Stop signal sent');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update tunnel configuration
 */
export function updateConfig(token: string, autoStart: boolean): { success: boolean; error?: string } {
  const saved = saveConfig({ token, autoStart });
  if (!saved) {
    return { success: false, error: 'Failed to save configuration' };
  }
  return { success: true };
}

/**
 * Delete tunnel configuration
 */
export function deleteConfig(): { success: boolean; error?: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Initialize tunnel on startup if autoStart is enabled
 */
export function initTunnel(): void {
  const config = loadConfig();
  if (config?.autoStart && config?.token) {
    console.log('[Tunnel] Auto-starting tunnel...');
    const result = startTunnel();
    if (!result.success) {
      console.error('[Tunnel] Auto-start failed:', result.error);
    }
  }
}
