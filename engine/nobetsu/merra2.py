"""NASA MERRA-2 root-zone and surface soil wetness at the Arksus points, via NASA POWER.

Replaces NASA SMAP L4 (15 Nov team decision: the AppEEARS SMAP request was never delivered, SMAP is
dropped, no mock data). It fills the soil-wetness slot of the contract (data/smap/{id}.json →
web/public/data/smap/{id}.json; the file name is kept so the contract does not break). Parameters GWETROOT ("Root Zone Soil Wetness",
upper ~1 m, 0 = completely dry … 1 = saturated) and GWETTOP (surface), monthly, from the POWER
monthly point API (community AG, source MERRA-2 per the response header). No login needed.

NOT independent of the engine: POWER's meteorology, which drives the engine, also comes from
MERRA-2. Agreement partly reflects shared weather; it compares two water-balance models.

    python -m nobetsu.merra2            # all locations → data/merra2/{id}.json + data/smap/{id}.json
    python -m nobetsu.merra2 --refresh

The cache has the same monthly_series shape as data/smap/{id}.json (contract §4.3b), so
validate.smap_comparison reads either.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

from . import config

API = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PARAMS = ("GWETROOT", "GWETTOP")
PRODUCT = "NASA MERRA-2 soil wetness (GWETROOT, GWETTOP) via NASA POWER monthly"
SOURCE_URL = "https://power.larc.nasa.gov/docs/"
CELL = "MERRA-2 grid, 0.5° × 0.625°"
CELL_KM = 55.0       # 0.5° of latitude ≈ 55.6 km; 0.625° of longitude at 38° N ≈ 54.7 km
SMAP_SLOT_DIR = config.DATA_DIR / "smap"
FILL = -999.0
CACHE_DIR = config.DATA_DIR / "merra2"


def parse(raw: dict, location_id: str) -> dict:
    """POWER monthly JSON → cache dict with contract-shaped monthly_series (annual '13' rows dropped)."""
    p = raw["properties"]["parameter"]
    root, top = p["GWETROOT"], p.get("GWETTOP", {})
    rows = []
    for key in sorted(root):
        if key[4:] == "13":                      # POWER's annual value
            continue
        rw = root[key]
        sw = top.get(key)
        rows.append({
            "month_start": f"{key[:4]}-{key[4:]}-01",
            "rootzone_wetness": None if rw is None or rw <= FILL else float(rw),
            "surface_wetness": None if sw is None or sw <= FILL else float(sw),
        })
    sources = (raw.get("header") or {}).get("sources") or []
    return {
        "location_id": location_id, "available": any(r["rootzone_wetness"] is not None for r in rows),
        "product": PRODUCT, "source_url": SOURCE_URL, "cell": CELL, "header_sources": sources,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "monthly_series": rows,
    }


def fetch(location_id: str, lat: float, lon: float, start: int = 2000, end: int | None = None, retries: int = 4) -> dict:
    end = end or date.today().year
    q = urllib.parse.urlencode({"parameters": ",".join(PARAMS), "community": "AG", "latitude": lat,
                                "longitude": lon, "start": start, "end": end, "format": "JSON"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(f"{API}?{q}", timeout=180) as r:
                return parse(json.loads(r.read()), location_id)
        except Exception:  # noqa: BLE001 — network: retry, then raise
            if attempt == retries - 1:
                raise
            time.sleep(3 * 2 ** attempt)
    raise RuntimeError("unreachable")


def cache_path(location_id: str) -> Path:
    return CACHE_DIR / f"{location_id}.json"


def load_cached(location_ids) -> dict[str, dict]:
    """{location_id: cache dict} for the locations with a cache file."""
    out = {}
    for loc in location_ids:
        p = cache_path(loc)
        if p.exists():
            with p.open(encoding="utf-8") as f:
                out[loc] = json.load(f)
    return out


def to_contract(cache: dict) -> dict:
    """Soil-wetness slot of the contract (smap.schema.json) from a MERRA-2 cache: monthly series,
    P10/P50/P90 per calendar month, latest month with its percentile among the same calendar months.
    rootzone_m3m3 is null: MERRA-2 GWETROOT is a degree of saturation, not a volumetric content."""
    import numpy as np
    rows = [r for r in cache.get("monthly_series", [])
            if r.get("rootzone_wetness") is not None and r.get("surface_wetness") is not None]
    if not rows:
        return {"available": False, "product": PRODUCT, "cell_km": CELL_KM, "latest": None,
                "monthly_climatology": [], "monthly_series": []}
    series = [{"month_start": r["month_start"], "rootzone_wetness": round(float(r["rootzone_wetness"]), 3),
               "surface_wetness": round(float(r["surface_wetness"]), 3)} for r in rows]
    clim = []
    for m in range(1, 13):
        vals = np.array([r["rootzone_wetness"] for r in series if int(r["month_start"][5:7]) == m], dtype=float)
        if len(vals):
            clim.append({"month": m, "p10": round(float(np.percentile(vals, 10)), 3),
                         "p50": round(float(np.percentile(vals, 50)), 3), "p90": round(float(np.percentile(vals, 90)), 3)})
    last = series[-1]
    same = np.array([r["rootzone_wetness"] for r in series if r["month_start"][5:7] == last["month_start"][5:7]], dtype=float)
    pct = 100.0 * float((same <= last["rootzone_wetness"]).mean())
    return {"available": True, "product": PRODUCT, "cell_km": CELL_KM,
            "latest": {"date": last["month_start"], "rootzone_wetness": last["rootzone_wetness"],
                       "rootzone_m3m3": None, "percentile_for_month": round(pct, 1)},
            "monthly_climatology": clim, "monthly_series": series}


def write_slot(location_id: str, cache: dict) -> Path:
    SMAP_SLOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SMAP_SLOT_DIR / f"{location_id}.json"
    with path.open("w", encoding="utf-8") as f:
        json.dump(to_contract(cache), f, ensure_ascii=False, indent=0)
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for loc in config.load("locations")["locations"]:
        if cache_path(loc["id"]).exists() and not a.refresh:
            with cache_path(loc["id"]).open(encoding="utf-8") as f:
                write_slot(loc["id"], json.load(f))
            continue
        data = fetch(loc["id"], float(loc["lat"]), float(loc["lon"]))
        with cache_path(loc["id"]).open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=0)
        write_slot(loc["id"], data)
        ok = [r for r in data["monthly_series"] if r["rootzone_wetness"] is not None]
        print(f"{loc['id']}: {len(ok)} months, {ok[0]['month_start'][:7]} → {ok[-1]['month_start'][:7]}, sources {data['header_sources']}")


if __name__ == "__main__":
    main()
