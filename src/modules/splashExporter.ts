import fs from 'fs';
import path from 'path';
import Competition from './competition';

const EXPORT_DIR = path.join(process.cwd(), 'exports', 'splashme');

/** Duration in ms to ignore splits after race start (prevents accidental presses) */
export const SPLIT_IGNORE_WINDOW_MS = 3000;

/**
 * Ensures the export directory exists, creating it recursively if needed.
 */
export function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Formats elapsed milliseconds into Splash Meet Manager time format.
 * Format: seconds.centiseconds for times < 1 minute (e.g. "35.22")
 * Format: minutes:seconds.centiseconds for times >= 1 minute (e.g. "1:11.22")
 * @param elapsedMs - Elapsed time in milliseconds
 * @returns Formatted time string
 */
export function formatSplashTime(elapsedMs: number): string {
  if (elapsedMs < 0) return '0.00';
  const totalCentiseconds = Math.floor(elapsedMs / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const cs = String(centiseconds).padStart(2, '0');
  if (minutes > 0) {
    const sec = String(seconds).padStart(2, '0');
    return `${minutes}:${sec}.${cs}`;
  }
  return `${seconds}.${cs}`;
}

/**
 * Generates the Splash Meet Manager filename for a heat.
 * Format: Session{A}-Event{B}-Heat{C}.txt or Event{B}-Heat{C}.txt
 */
export function generateFilename(
  session: number | string | null,
  event: number | string,
  heat: number | string,
): string {
  if (session !== null && session !== undefined) {
    return `Session${session}-Event${event}-Heat${heat}.txt`;
  }
  return `Event${event}-Heat${heat}.txt`;
}

/**
 * If a file already exists, rename it with a timestamp suffix as backup.
 * E.g. Event1-Heat1.txt → Event1-Heat1_20260228-153045.txt
 */
export function backupExistingFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const now = new Date();
  const timestamp = [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const backupName = `${base}_${timestamp}${ext}`;
  const backupPath = path.join(dir, backupName);
  fs.renameSync(filePath, backupPath);
  console.log(`[SplashExporter] Backed up existing file to: ${backupName}`);
}

/**
 * Determines TIME column headers based on swim distance and number of splits.
 * E.g. distance=200, 4 splits → TIME50, TIME100, TIME150, TIME200
 * E.g. distance=100, 1 split → TIME100
 */
export function generateTimeColumns(distance: number, maxSplits: number): string[] {
  if (maxSplits <= 0) return [];
  if (maxSplits === 1) return [`TIME${distance}`];

  const interval = Math.floor(distance / maxSplits);
  // Round interval down to nearest multiple of 50 if possible
  const roundedInterval = interval >= 50 ? Math.floor(interval / 50) * 50 : interval;
  const columns: string[] = [];
  for (let i = 1; i <= maxSplits; i++) {
    columns.push(`TIME${roundedInterval * i}`);
  }
  return columns;
}

/**
 * Tries to look up the swim distance for the given event from competition data.
 * Returns distance in meters, or null if not available.
 */
function getSwimDistance(
  sessionNumber: number | string | null,
  eventNumber: number | string,
): number | null {
  try {
    const eventNum = typeof eventNumber === 'string' ? parseInt(eventNumber, 10) : eventNumber;
    const sessionNum = sessionNumber !== null
      ? (typeof sessionNumber === 'string' ? parseInt(sessionNumber, 10) : sessionNumber)
      : undefined;
    const event = Competition.getEvent(0, sessionNum, eventNum);
    if (event?.swimstyle?.distance) {
      const { distance, relaycount } = event.swimstyle;
      // For relays, each leg is distance meters, total = relaycount * distance
      return relaycount > 1 ? relaycount * distance : distance;
    }
  } catch {
    // Competition data may not be available — continue without distance info
  }
  return null;
}

export interface RaceState {
  currentSession: number | string | null;
  currentEvent: number | string | null;
  currentHeat: number | string | null;
  raceStartTimestamp: number | null;
  splitsByLane: Map<number, number[]>;
}

/**
 * Exports heat results to a Splash Meet Manager compatible TXT file.
 * CSV format with semicolon separators: LANE;TIME50;TIME100;...
 *
 * @param state - Current race state with splits data
 */
export function exportHeatToSplashFile(state: RaceState): void {
  const { currentSession, currentEvent, currentHeat, raceStartTimestamp, splitsByLane } = state;

  if (!currentEvent || !currentHeat || !raceStartTimestamp) {
    console.log('[SplashExporter] Skipping export: missing event, heat, or start timestamp');
    return;
  }

  if (splitsByLane.size === 0) {
    console.log('[SplashExporter] Skipping export: no splits recorded');
    return;
  }

  ensureExportDir();

  // Determine max splits across all lanes
  let maxSplits = 0;
  for (const splits of splitsByLane.values()) {
    if (splits.length > maxSplits) maxSplits = splits.length;
  }

  // Get swim distance for column naming
  const swimDistance = getSwimDistance(currentSession, currentEvent);
  const distance = swimDistance ?? maxSplits * 50; // fallback: assume 50m intervals

  const timeColumns = generateTimeColumns(distance, maxSplits);
  const header = ['LANE', ...timeColumns].join(';');

  // Build rows sorted by lane number
  const lanes = Array.from(splitsByLane.keys()).sort((a, b) => a - b);
  const rows: string[] = [];

  for (const lane of lanes) {
    const splits = splitsByLane.get(lane) ?? [];
    const times = splits.map((ts) => formatSplashTime(ts - raceStartTimestamp));
    // Pad with empty values if this lane has fewer splits than max
    while (times.length < maxSplits) {
      times.push('');
    }
    rows.push([String(lane), ...times].join(';'));
  }

  const csvContent = [header, ...rows].join('\n');

  // Generate filename and handle backup
  const filename = generateFilename(currentSession, currentEvent, currentHeat);
  const filePath = path.join(EXPORT_DIR, filename);

  backupExistingFile(filePath);
  fs.writeFileSync(filePath, csvContent, 'utf-8');
  console.log(`[SplashExporter] Exported heat results to: ${filename}`);
}
