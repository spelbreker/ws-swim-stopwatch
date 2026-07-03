---
name: swim-results-etw
description: >
  Combines a KNZB swimming competition start program (PDF) with KNZB web results
  and ETW (Electronic Timing Watch) log files to produce a unified CSV with lane-by-lane
  results, ETW times, and the difference between manual (ETW) and official (KNZB) timing.
  Use this skill whenever the user has a swim meet program PDF, KNZB result URL, and/or
  an ETW log file and wants to combine them into a results CSV. Also use when the user
  mentions "ETW", "tijdwaarneming", "niveauwedstrijd", "startlijst", "uitslagenlijst",
  "baanindeling", or wants to compare handmatige tijden with official KNZB results.
---
 
# Swim Results + ETW Combiner
 
This skill produces a lane-by-lane results CSV by combining:
1. **Start program PDF** — provides the heat/lane/swimmer mapping (who is in which lane)
2. **KNZB web results** — official finish times per swimmer
3. **ETW log** — raw timing log from electronic stopwatch hardware
The output CSV has columns:
`programma | serie | baan | naam/team | eindtijd | etw_tijd | verschil`
 
---
 
## Step 1: Extract start program (PDF → lane map)
 
Read the uploaded PDF with the start program. For each event (programmanr.), extract every heat (serie) and each lane (baan) with swimmer/team name and seeded time.
 
Build a data structure:
```
(programma, serie, baan) → {naam, seeded_time}
```
 
**Notes:**
- Relay entries list swimmer names after the team name — use the team name as the identifier
- "NT" = no time (unseeded)
- Lanes without an entry are empty
---
 
## Step 2: Fetch KNZB official results
 
Use `web_fetch` on the provided KNZB webkalender URL (e.g. `https://webkalender.knzb.nl/wedstrijd/zwemmen/<id>`).
 
The page lists results per event, grouped by age category, sorted by finish time. Each swimmer entry includes their club and result time.
 
**Match strategy:** Match by swimmer name + club against the start program entries. The KNZB page does NOT show heat/lane info — that comes only from the start program.
 
Build: `(programma, naam) → official_time`
 
---
 
## Step 3: Parse ETW log
 
The ETW log is a plain-text file with lines like:
```
[timestamp] START - Event: N, Heat: N, Timestamp: ...
[timestamp] SPLIT - Lane: N, Time: MM:SS.mmm, Timestamp: ..., Elapsed: ...ms
[timestamp] RESET - Timestamp: ...
```
 
### Debouncing rule
Button contacts bounce and produce multiple rapid triggers. **For each lane within a heat, take the FIRST reading of any cluster of readings within 1000ms of each other.** This is the true touch time.
 
Algorithm:
1. Sort all splits for a lane by time ascending
2. Walk through; whenever the gap to the previous kept reading is < 1000ms, discard — otherwise keep
3. The LAST kept reading per lane = final time for that lane
### False start / self-trigger rule
If a lane registers a split within the first ~5 seconds of a heat starting, that is a false trigger (button pressed by itself or accidentally). Flag these entries.
 
### Special overrides
Apply any user-specified ignore rules before output:
- `NEGEER` — result ignored per instruction
- `BAAN5-ZELF` (or similar) — lane triggered by itself, result unreliable
Build: `(event, heat, lane) → etw_time_ms`
 
---
 
## Step 4: Build the combined CSV
 
For each row in the start program:
 
```python
key = (programma, serie, baan)
knzb_time = look up by swimmer name match from KNZB results
etw_time   = etw_data.get((programma, serie, baan), "")
 
# Apply ignore/flag overrides
if key in ignore_list:
    etw_time = "NEGEER"
elif key in suspect_lanes:
    etw_time = flag_label  # e.g. "BAAN5-ZELF"
 
# Compute difference (ETW - KNZB), in seconds
if etw_time is valid and knzb_time is valid:
    verschil = etw_ms - knzb_ms   # positive = ETW slower than KNZB
```
 
Output as **comma-separated CSV** with all time fields quoted to avoid Excel splitting `3:14.002` across columns:
 
```
programma,serie,baan,naam/team,eindtijd,etw_tijd,verschil
1,1,4,"Barracuda 1 (Niemo Barracuda)","4:08.67","03:34.725","-33.945s"
```
 
---
 
## Step 5: Quality checks
 
After building the CSV, report:
 
1. **Large outliers** — rows where `|verschil| > 1.0s`. These almost always indicate a wrong lane mapping (ETW measured a different lane than the start program says). List them for the user.
2. **Average difference** — excluding outliers > 1s:
   - Mean (ETW − KNZB): typically +0.15s to +0.25s for good manual timing
   - Mean absolute difference
3. **Coverage** — how many lanes had ETW data vs. total lanes with official times
---
 
## User-specified overrides
 
Always ask (or look for in the conversation) whether the user has:
- Lanes to **ignore completely** (e.g. "negeer event 10 heat 1 baan 1")
- Lanes that **self-triggered** (e.g. "baan 5 ging zelf af op heat 4 event 6")
- Any other annotation notes
Apply these before writing the CSV.
 
---
 
## Output file
 
Save the CSV to `/mnt/user-data/outputs/uitslagen_met_etw.csv` and present it with `present_files`.
 
Use **comma** as delimiter. Quote any field containing a colon (time fields) or comma (team names with commas).
 
---
 
## Helper script
 
See `scripts/parse_etw.py` for the debouncing + parsing logic that can be run directly:
 
```bash
python3 scripts/parse_etw.py --log etw.log --out etw_times.json
```
 