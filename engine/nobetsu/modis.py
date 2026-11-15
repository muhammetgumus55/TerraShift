"""NASA MODIS Terra NDVI (MOD13Q1 v061, 250 m, 16-day) at the Arksus points.

Used to check the engine's crop calendar against what the satellite sees (validate.ndvi_comparison):
when does the land green up, peak and dry down, and when is it bare.

Source: ORNL DAAC MODIS/VIIRS Land Product Subsets REST API (public, no Earthdata login),
https://modis.ornl.gov/data/modis_webservice.html. The service returns at most 10 composites per
request and is slow (~40–60 s per request), so the download is resumable: every finished
request is written to the cache at once.

    python -m nobetsu.modis                    # 2013-01 → 2024-12 for all locations
    python -m nobetsu.modis --start 2001-01-01 --end 2024-12-31 --only karapinar

One 250 m pixel (the one containing the point). NDVI is stored as the scaled value (−0.2 … 1);
fill values (−3000 raw) are stored as null.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config

API = "https://modis.ornl.gov/rst/api/v1"
PRODUCT = "MOD13Q1"
BAND = "250m_16_days_NDVI"
SCALE = 0.0001
FILL_RAW = -3000
MAX_PER_REQUEST = 10
SOURCE = "NASA MODIS Terra MOD13Q1 v061 NDVI, 250 m, 16-day, via ORNL DAAC Land Product Subsets API"
SOURCE_URL = "https://modis.ornl.gov/data/modis_webservice.html"
CACHE_DIR = config.DATA_DIR / "modis"


def scale_ndvi(raw: int) -> float | None:
    """Raw MOD13Q1 NDVI integer → NDVI; fill → None."""
    if raw is None or int(raw) <= FILL_RAW:
        return None
    return round(int(raw) * SCALE, 4)


def batches(modis_dates: list[str], size: int = MAX_PER_REQUEST) -> list[tuple[str, str]]:
    """(first, last) MODIS date pairs covering the list in chunks the API accepts."""
    return [(modis_dates[i], modis_dates[min(i + size, len(modis_dates)) - 1])
            for i in range(0, len(modis_dates), size)]


def _get_json(url: str, retries: int = 5) -> dict | list:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "nobetsu/0.1"})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.loads(r.read())
            if isinstance(data, str):       # the API reports request errors as a JSON string
                raise RuntimeError(data)
            return data
        except Exception:  # noqa: BLE001 — network: retry with backoff, then raise
            if attempt == retries - 1:
                raise
            time.sleep(5 * 2 ** attempt)
    raise RuntimeError("unreachable")


def available_dates(lat: float, lon: float, start: str, end: str) -> list[str]:
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon})
    rows = _get_json(f"{API}/{PRODUCT}/dates?{q}")["dates"]
    return [r["modis_date"] for r in rows if start <= r["calendar_date"] <= end]


def fetch_batch(lat: float, lon: float, first: str, last: str) -> list[dict]:
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "band": BAND, "startDate": first,
                                "endDate": last, "kmAboveBelow": 0, "kmLeftRight": 0})
    d = _get_json(f"{API}/{PRODUCT}/subset?{q}")
    return [{"date": s["calendar_date"], "ndvi": scale_ndvi(s["data"][0])} for s in d["subset"]]


# --- cache ---------------------------------------------------------------------------------

def cache_path(location_id: str) -> Path:
    return CACHE_DIR / f"{location_id}.json"


def _read(location_id: str) -> dict | None:
    p = cache_path(location_id)
    if not p.exists():
        return None
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def _write(location_id: str, data: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    data["composites"] = sorted({c["date"]: c for c in data["composites"]}.values(), key=lambda c: c["date"])
    tmp = cache_path(location_id).with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
    tmp.replace(cache_path(location_id))


def ndvi_series(cache: dict) -> pd.Series:
    """NDVI indexed by composite start date; fills are NaN."""
    rows = cache.get("composites") or []
    return pd.Series([np.nan if r["ndvi"] is None else float(r["ndvi"]) for r in rows],
                     index=pd.to_datetime([r["date"] for r in rows]), name="ndvi", dtype=float)


def load_cached(location_ids) -> dict[str, pd.Series]:
    out = {}
    for loc in location_ids:
        c = _read(loc)
        if c and c.get("composites"):
            out[loc] = ndvi_series(c)
    return out


def fetch_location(loc: dict, start: str, end: str, workers: int = 3) -> int:
    """Download every missing composite for one location; returns the number fetched."""
    lid, lat, lon = loc["id"], float(loc["lat"]), float(loc["lon"])
    cache = _read(lid) or {"location_id": lid, "source": SOURCE, "source_url": SOURCE_URL,
                           "product": PRODUCT, "band": BAND, "point": {"lat": lat, "lon": lon},
                           "pixel_m": 250, "composites": []}
    have = {c["date"] for c in cache["composites"]}
    dates = available_dates(lat, lon, start, end)
    q = urllib.parse.urlencode({"latitude": lat, "longitude": lon})
    by_cal = {r["modis_date"]: r["calendar_date"] for r in _get_json(f"{API}/{PRODUCT}/dates?{q}")["dates"]}
    # Fixed groups of ≤10 consecutive composites; a group is skipped only when fully cached,
    # so a request range never spans more than 10 composites.
    groups = [dates[i:i + MAX_PER_REQUEST] for i in range(0, len(dates), MAX_PER_REQUEST)]
    todo = [(g[0], g[-1]) for g in groups if any(by_cal[d] not in have for d in g)]
    done = 0
    with ThreadPoolExecutor(workers) as pool:
        futs = [pool.submit(fetch_batch, lat, lon, a, b) for a, b in todo]
        for fut in as_completed(futs):
            rows = fut.result()
            cache["composites"].extend(rows)
            cache["fetched_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            _write(lid, cache)
            done += len(rows)
            print(f"{lid}: +{len(rows)} ({len(cache['composites'])} cached)", flush=True)
    return done


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--start", default="2013-01-01")
    ap.add_argument("--end", default="2024-12-31")
    ap.add_argument("--only", nargs="*", help="location ids (default: all)")
    ap.add_argument("--workers", type=int, default=3, help="parallel requests per location")
    a = ap.parse_args()
    locs = [l for l in config.load("locations")["locations"] if not a.only or l["id"] in a.only]
    for loc in locs:
        try:
            n = fetch_location(loc, a.start, a.end, a.workers)
            print(f"{loc['id']}: done (+{n})", flush=True)
        except Exception as e:  # noqa: BLE001 — keep going; the run is resumable
            print(f"{loc['id']}: FAILED ({e}); run again to resume", flush=True)


if __name__ == "__main__":
    main()
