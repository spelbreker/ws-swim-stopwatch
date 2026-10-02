# Splash Meet Manager Export

Accepted splits are written to heat files that Splash Meet Manager can import
with its timing system **"Generic Txt heat files"** (Meet Manager FAQ §6.2,
[swimrankings wiki](https://wiki.swimrankings.net/index.php/Meet_Manager:Timing_System_Generic_Txt_Heat_Files)).

## File format

One file per heat, named `Event{B}-Heat{C}.txt` (for example `Event7-Heat3.txt`).
Event numbers are unique within a Splash meet, so the optional `Session{A}-`
prefix is not used.

The file is semicolon separated, one row per lane that recorded at least one
split, with Windows line endings (CRLF):

```
LANE;TIME50;TIME100
3;35.22;1:11.22
4;34.99;
```

- `LANE` is mandatory; lanes are sorted ascending. Lane numbers are written as
  received from the remote/hardware (0-9), which matches Meet Manager's lane
  numbering for a 10-lane pool. Do not shift them to 1-10.
- One `TIME{distance}` column per split distance recorded in the heat, using the
  distance labels from the [SplitTracker](split-aware-timing.md) (every two
  pool lengths, capped at the event distance). A lane that has not reached a
  distance has an empty cell.
- Times are elapsed from the `start` timestamp, truncated to hundredths:
  `35.22` below one minute, `1:11.22` from one minute.
- Reaction times (`RT1`, ...) and backup times (`BACKUP1`, ...) are not written.

## When files are written

| Message | Effect |
|---------|--------|
| `start` | Begins a new run for the current event/heat. Nothing is written yet. |
| accepted `split` | Records the split and rewrites the heat file. |
| ignored `split` | Nothing (cooldown, start-cooldown, after-finish). |
| `reset` | Ends the run; the file stays. |
| `event-heat` | Ends the run (the tracker restarts its split count); the file stays. |

The file is rewritten on every accepted split, so it is always current, also
when the next heat is started without a reset. Each write goes to a temp file
(`.Event{B}-Heat{C}.txt.tmp`) that is then renamed, so a reader never sees a
half-written file.

When a heat is swum again, the first accepted split of the new run renames the
existing file to `Event{B}-Heat{C}_YYYYMMDD-HHMMSS.txt` (with `-1`, `-2`, ...
if that name exists) before writing. A start without splits (false start) does
not create a backup. Meet Manager ignores backups because their names do not
match the expected pattern.

No file is written when the start has no valid event/heat (positive integers)
or no valid timestamp.

## Getting the files into Meet Manager

1. In Meet Manager, select the timing system "Generic Txt heat files" and
   choose a data directory.
2. Open `http://<server>/competition/export.html` (dashboard → Splash Export).
3. Download the heat file and save it in the data directory.
4. Click "read results" in Meet Manager. Heats can be read in any order and
   more than once.

Use "Delete all" on the export page before a new meet so Meet Manager cannot
pick up a file from an earlier meet with the same event/heat number.

The files live in `<EXPORT_DIR>/splashme/` (default `./exports/splashme`,
mounted as the `exports` volume in Docker), so the directory can later be
shared directly with the Meet Manager PC (for example with Samba) without
code changes.

## HTTP API

See [http-api.md](http-api.md#splash-export). All routes are blocked via the
Cloudflare tunnel.

| Route | Description |
|-------|-------------|
| `GET /exports/splashme` | List heat files and backups |
| `GET /exports/splashme/:file` | Download one heat file |
| `DELETE /exports/splashme` | Delete all heat files and backups |
