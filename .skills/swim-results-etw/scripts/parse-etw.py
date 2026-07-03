#!/usr/bin/env python3
"""
parse_etw.py — Parse an ETW (Electronic Timing Watch) log file.

Applies debouncing: for each lane within a heat, clusters of readings
within 1000ms are collapsed to the FIRST reading. The last remaining
reading per lane is the final time.

Usage:
    python3 parse_etw.py --log etw.log [--out etw_times.json]

Output JSON format:
    {
      "event:heat:lane": {"time_str": "01:23.456", "time_ms": 83456},
      ...
    }
"""

import re
import json
import argparse
from collections import defaultdict


def time_to_ms(t: str) -> int | None:
    """Convert 'MM:SS.mmm' to milliseconds. Returns None on failure."""
    t = t.strip()
    # handle both MM:SS.mmm and MM:SS.mm
    m = re.match(r'^(\d+):(\d+\.\d+)$', t)
    if m:
        minutes = int(m.group(1))
        secs = float(m.group(2))
        return int((minutes * 60 + secs) * 1000)
    return None


def ms_to_time_str(ms: int) -> str:
    """Convert milliseconds to 'MM:SS.mmm'."""
    total_sec = ms / 1000.0
    minutes = int(total_sec // 60)
    secs = total_sec - minutes * 60
    return f"{minutes:02d}:{secs:06.3f}"


def debounce(splits: list[tuple[int, str]], window_ms: int = 1000) -> list[tuple[int, str]]:
    """
    Given a list of (time_ms, time_str) sorted by time_ms,
    collapse clusters within window_ms to keep only the FIRST of each cluster.
    Returns the debounced list.
    """
    if not splits:
        return []
    splits = sorted(splits, key=lambda x: x[0])
    kept = [splits[0]]
    for ms, ts in splits[1:]:
        if ms - kept[-1][0] >= window_ms:
            kept.append((ms, ts))
    return kept


def parse_etw_log(log_text: str) -> dict:
    """
    Parse ETW log text and return a dict keyed by "event:heat:lane"
    with value {"time_str": ..., "time_ms": ...}.

    Also returns metadata about false triggers and ignore suggestions.
    """
    results = {}
    warnings = []

    current_event = None
    current_heat = None
    lane_splits: dict[int, list[tuple[int, str]]] = defaultdict(list)

    for line in log_text.splitlines():
        line = line.strip()
        if not line:
            continue

        # START
        start_m = re.search(r'START\s*-\s*Event:\s*(\d+),\s*Heat:\s*(\d+)', line)
        if start_m:
            current_event = int(start_m.group(1))
            current_heat = int(start_m.group(2))
            lane_splits = defaultdict(list)
            continue

        # RESET — end of heat, process splits
        if re.search(r'RESET', line) and current_event is not None:
            for lane, splits in lane_splits.items():
                if not splits:
                    continue
                debounced = debounce(splits)
                # Check for false start: first debounced reading < 5s
                if debounced[0][0] < 5000:
                    warnings.append(
                        f"Event {current_event} Heat {current_heat} Lane {lane}: "
                        f"possible false trigger at {debounced[0][1]}"
                    )
                # Final time = last debounced reading
                final_ms, final_str = debounced[-1]
                key = f"{current_event}:{current_heat}:{lane}"
                results[key] = {"time_str": final_str, "time_ms": final_ms}

            current_event = None
            current_heat = None
            lane_splits = defaultdict(list)
            continue

        # SPLIT
        split_m = re.search(r'SPLIT\s*-\s*Lane:\s*(\d+),\s*Time:\s*([\d:\.]+)', line)
        if split_m and current_event is not None:
            lane = int(split_m.group(1))
            time_str = split_m.group(2)
            ms = time_to_ms(time_str)
            if ms is not None:
                lane_splits[lane].append((ms, time_str))

    return {"results": results, "warnings": warnings}


def main():
    parser = argparse.ArgumentParser(description="Parse ETW log with debouncing")
    parser.add_argument("--log", required=True, help="Path to ETW log file")
    parser.add_argument("--out", default=None, help="Output JSON file (default: stdout)")
    args = parser.parse_args()

    with open(args.log) as f:
        log_text = f.read()

    parsed = parse_etw_log(log_text)

    if parsed["warnings"]:
        print("WARNINGS:")
        for w in parsed["warnings"]:
            print(f"  {w}")
        print()

    output = json.dumps(parsed["results"], indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
        print(f"Written {len(parsed['results'])} results to {args.out}")
    else:
        print(output)


if __name__ == "__main__":
    main()
