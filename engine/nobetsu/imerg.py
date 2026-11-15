"""NASA GPM IMERG Final monthly precipitation (V07) at the Arksus points.

Used only as a second satellite precipitation source next to NASA POWER in the
`precip_vs_mgm` check (validate.py). The engine's daily weather still comes from POWER.

Source: GPM_3IMERGM V07 (NASA GES DISC), read from the public NSF NCAR GDEX mirror
(dataset d736000, CC BY 4.0), which needs no Earthdata login. The mirror publishes a
kerchunk index; each monthly field is stored in zlib-compressed chunks of 145 longitudes
× 1800 latitudes, so one HTTP range request per month returns a strip that covers every
Central Anatolian point at once (~0.2 MB).

    python -m nobetsu.imerg            # fetch all locations → data/imerg/{id}.json
    python -m nobetsu.imerg --refresh  # re-download

Grid: 0.1° cell centres from −179.95 to 179.95 (lon) and −89.95 to 89.95 (lat), array
order (time, lon, lat). Values are mean precipitation rate in mm/hr for the month; the
cache stores monthly totals in mm (rate × hours in the month).
"""

from __future__ import annotations

import argparse
import calendar
import json
import re
import time
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from . import config

REFS_URL = "https://data.gdex.ucar.edu/d736000/kerchunk/GPM_3IMERGM_v07-remote-https.json"
DATASET_URL = "https://gdex.ucar.edu/datasets/d736000/"
GLADE_PREFIX = "/glade/campaign/collections/rda/data/"
HTTPS_PREFIX = "https://data.gdex.ucar.edu/"
SOURCE = "NASA GPM IMERG Final monthly V07 (GPM_3IMERGM), 0.1°, via NSF NCAR GDEX d736000 (CC BY 4.0)"

N_LON, N_LAT = 3600, 1800
CHUNK_LON = 145
FILL = -9999.9
CACHE_DIR = config.DATA_DIR / "imerg"


# --- grid and units ------------------------------------------------------------------------

def grid_index(lat: float, lon: float) -> tuple[int, int]:
    """(lon index, lat index) of the 0.1° IMERG cell that contains the point."""
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise ValueError(f"point out of range: {lat}, {lon}")
    i = min(int(np.floor((lon + 180.0) / 0.1)), N_LON - 1)
    j = min(int(np.floor((lat + 90.0) / 0.1)), N_LAT - 1)
    return i, j


def cell_centre(i: int, j: int) -> tuple[float, float]:
    """(lat, lon) of the centre of cell (i, j)."""
    return round(-89.95 + 0.1 * j, 2), round(-179.95 + 0.1 * i, 2)


def month_total_mm(rate_mm_per_hr: float, year: int, month: int) -> float:
    """Monthly total from the IMERG monthly mean rate."""
    return float(rate_mm_per_hr) * 24.0 * calendar.monthrange(year, month)[1]


def decode_chunk(raw: bytes) -> np.ndarray:
    """zlib-compressed little-endian float32 strip → array (145, 1800), fill → NaN."""
    a = np.frombuffer(zlib.decompress(raw), dtype="<f4").reshape(CHUNK_LON, N_LAT).astype(float)
    a[a <= FILL + 0.01] = np.nan
    return a


_DATE = re.compile(r"3IMERG\.(\d{4})(\d{2})01-")


def month_of(path: str) -> str:
    """'YYYY-MM' from an IMERG monthly file name."""
    m = _DATE.search(path)
    if not m:
        raise ValueError(f"no month in file name: {path}")
    return f"{m.group(1)}-{m.group(2)}"


# --- download ------------------------------------------------------------------------------

def _get(url: str, headers: dict | None = None, retries: int = 4) -> bytes:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "nobetsu/0.1", **(headers or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception:  # noqa: BLE001 — network: retry, then raise
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def chunk_refs(refs: dict) -> dict[tuple[int, int], tuple[str, int, int]]:
    """{(time index, lon chunk): (https url, offset, length)} from a kerchunk index."""
    r = refs.get("refs", refs)
    out = {}
    for key, val in r.items():
        if not key.startswith("precipitation/") or key.startswith("precipitation/."):
            continue
        t, c, _ = (int(x) for x in key.split("/", 1)[1].split("."))
        path, off, length = val
        out[(t, c)] = (path.replace(GLADE_PREFIX, HTTPS_PREFIX), int(off), int(length))
    return out


def fetch_points(points: dict[str, tuple[float, float]], workers: int = 8) -> dict[str, dict]:
    """Monthly totals for every point: {location_id: cache dict}."""
    refs = json.loads(_get(REFS_URL))
    chunks = chunk_refs(refs)
    cells = {loc: grid_index(lat, lon) for loc, (lat, lon) in points.items()}
    needed = sorted({(t, i // CHUNK_LON) for (t, c) in chunks for (i, _) in cells.values() if c == i // CHUNK_LON})

    def one(key):
        url, off, length = chunks[key]
        return key, url, decode_chunk(_get(url, {"Range": f"bytes={off}-{off + length - 1}"}))

    series: dict[str, list] = {loc: [] for loc in points}
    with ThreadPoolExecutor(workers) as pool:
        for (t, c), url, strip in pool.map(one, needed):
            ym = month_of(url)
            y, m = int(ym[:4]), int(ym[5:])
            for loc, (i, j) in cells.items():
                if i // CHUNK_LON != c:
                    continue
                rate = strip[i % CHUNK_LON, j]
                series[loc].append({"month": ym, "precip_mm": None if np.isnan(rate) else round(month_total_mm(rate, y, m), 2)})

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = {}
    for loc, (lat, lon) in points.items():
        i, j = cells[loc]
        clat, clon = cell_centre(i, j)
        months = sorted(series[loc], key=lambda d: d["month"])
        out[loc] = {"location_id": loc, "source": SOURCE, "source_url": DATASET_URL, "refs_url": REFS_URL,
                    "point": {"lat": lat, "lon": lon}, "cell_centre": {"lat": clat, "lon": clon},
                    "unit": "mm/month", "fetched_at": now, "months": months}
    return out


# --- cache ---------------------------------------------------------------------------------

def cache_path(location_id: str) -> Path:
    return CACHE_DIR / f"{location_id}.json"


def monthly_series(cache: dict) -> pd.Series:
    """Monthly totals (mm) indexed by month start; missing months are NaN."""
    rows = cache.get("months") or []
    idx = pd.to_datetime([r["month"] + "-01" for r in rows])
    vals = [np.nan if r["precip_mm"] is None else float(r["precip_mm"]) for r in rows]
    return pd.Series(vals, index=idx, name="precip_mm", dtype=float)


def load_cached(location_ids) -> dict[str, pd.Series]:
    """Monthly series for the locations that have a cache file; others are left out."""
    out = {}
    for loc in location_ids:
        p = cache_path(loc)
        if p.exists():
            with p.open(encoding="utf-8") as f:
                out[loc] = monthly_series(json.load(f))
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-download even if the cache exists")
    a = ap.parse_args()
    locs = config.load("locations")["locations"]
    todo = {l["id"]: (float(l["lat"]), float(l["lon"])) for l in locs
            if a.refresh or not cache_path(l["id"]).exists()}
    if not todo:
        print("all IMERG caches exist (use --refresh to re-download)")
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for loc, data in fetch_points(todo).items():
        with cache_path(loc).open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        n = sum(r["precip_mm"] is not None for r in data["months"])
        print(f"{loc}: {n} months, {data['months'][0]['month']} → {data['months'][-1]['month']}")


if __name__ == "__main__":
    main()
