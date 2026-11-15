"""Read-only tools for the Arksus district agent (nobetsu.agent).

Every tool reads files the pipeline already produced (web/public/data after `make data`, plus the
NDVI cache) and returns small, rounded JSON. The agent may only state numbers that one of these tools
returned: `Registry` records every number handed out so agent.py can check the final text.
No tool computes anything new about the farm; they summarise what the engine and NASA data say.
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path

from nobetsu import config

ROTATIONS = ("fallow_wheat", "chickpea_wheat", "lentil_wheat")


def _web(rel: str) -> dict:
    with (config.WEB_DATA_DIR / rel).open(encoding="utf-8") as f:
        return json.load(f)


def _q(values: list[float], p: float) -> float:
    s = sorted(values)
    h = (len(s) - 1) * p
    lo, hi = int(h), min(int(h) + 1, len(s) - 1)
    return s[lo] + (h - lo) * (s[hi] - s[lo])


def _r(x, nd=0):
    return None if x is None else (round(float(x), nd) if nd else int(round(float(x))))


_NUM = __import__("re").compile(r"(?<![\w.])[-−]?\d+(?:[.,]\d+)?")


def numbers_in(text: str) -> list[float]:
    """Numbers written in a text (Turkish decimal comma or dot; 'mm/m', '1e-12' style tokens give their parts)."""
    out = []
    for m in _NUM.findall(text or ""):
        try:
            out.append(round(float(m.replace(",", ".").replace("−", "-")), 2))
        except ValueError:
            pass
    return out


class Registry:
    """Numbers handed to the model, for the 'no invented numbers' check."""

    def __init__(self):
        self.numbers: set[float] = set()

    def add(self, obj):
        if isinstance(obj, bool) or obj is None:
            return
        if isinstance(obj, (int, float)):
            self.numbers.add(round(float(obj), 2))
        elif isinstance(obj, str):
            for x in numbers_in(obj):
                self.numbers.add(x)
        elif isinstance(obj, dict):
            for v in obj.values():
                self.add(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                self.add(v)


class Tools:
    def __init__(self, location_id: str, depth_id: str = "medium", registry: Registry | None = None):
        self.loc = location_id
        self.depth = depth_id
        self.reg = registry or Registry()
        self.site = _web("site_index.json")
        self.results = _web(f"results/{location_id}.json")

    def _out(self, obj):
        self.reg.add(obj)
        return obj

    # --- tools --------------------------------------------------------------------------------

    def district(self) -> dict:
        """Name, province, coordinates, elevation of the point; how the point was checked; depth class used."""
        loc = next(l for l in self.site["locations"] if l["id"] == self.loc)
        depth = next(d for d in self.site["depth_classes"] if d["id"] == self.depth)
        return self._out({"name": loc["name"], "province": loc["province"], "lat": loc["lat"], "lon": loc["lon"],
                          "elevation_m": _r(loc.get("elevation_m")), "note_tr": loc["note"]["tr"],
                          "depth_class": depth["label"]["tr"], "depth_m": depth["depth_m"],
                          "climate_years": f"{self.site['start_years'][0]}–{self.site['start_years'][1]} başlangıç yılları (24 iklim yılı)"})

    def rotations(self, scenario_id: str = "baseline") -> dict:
        """Per rotation (median and P10–P90 over 24 climate years, chosen depth): water left in the soil at
        wheat sowing (mm), bare days and wind-exposed bare days over 24 months, wheat water-stress days,
        wheat yield ratio (Ya/Ym, 0–1, share of the water-unlimited yield), first-crop (legume) yield ratio.
        scenario_id: one of the site's climate scenarios (baseline, dry10, dry20, warm1, warm2, dry10_warm1)."""
        res = self.results if scenario_id == "baseline" else _web(f"results/{self.loc}__{scenario_id}.json")
        out = {}
        for rot in self.site["rotations"]:
            rows = [s for s in res["sequences"] if s["rotation_id"] == rot["id"] and s["depth_id"] == self.depth]
            def stat(f, nd=0):
                v = [f(s) for s in rows if f(s) is not None]
                return {"p10": _r(_q(v, .1), nd), "p50": _r(statistics.median(v), nd), "p90": _r(_q(v, .9), nd)} if v else None
            out[rot["id"]] = {
                "label_tr": rot["label"]["tr"], "is_current_practice": rot["is_baseline"],
                "n_fixing": rot["soil_traits"]["n_fixing"],
                "tillage_passes_per_year": rot["soil_traits"]["tillage_passes"]["value"],
                "water_at_wheat_sowing_mm": stat(lambda s: s["water_at_wheat_sowing_mm"]),
                "bare_days_24_months": stat(lambda s: s["bare_days"]),
                "wind_exposed_bare_days": stat(lambda s: s["wind_exposed_bare_days"]),
                "wheat_stress_days": stat(lambda s: s["wheat"]["stress_days"]),
                "wheat_yield_ratio": stat(lambda s: s["wheat"]["yield_ratio"], 2),
                "legume_yield_ratio": stat(lambda s: (s.get("first_crop") or {}).get("yield_ratio"), 2),
            }
        return self._out({"scenario_id": scenario_id, "depth_id": self.depth, "rotations": out,
                          "units": "mm = 1 m³/da; ratios 0–1; days over a 24-month sequence"})

    def scenarios(self) -> dict:
        """How the median wheat yield ratio and water at wheat sowing change in drier / warmer versions of the
        same 24 years (sensitivity steps, not forecasts)."""
        rows = {}
        for sc in self.site.get("scenarios", []):
            r = self.rotations(sc["id"])["rotations"]
            rows[sc["id"]] = {"label_tr": sc["label"]["tr"],
                              **{rid: {"wheat_yield_ratio_p50": v["wheat_yield_ratio"]["p50"],
                                       "water_at_wheat_sowing_mm_p50": v["water_at_wheat_sowing_mm"]["p50"]}
                                 for rid, v in r.items()}}
        return self._out({"scenarios": rows, "note": "Delta-change steps on the same past weather, not projections."})

    def soil(self) -> dict:
        """Regional soil estimate (SoilGrids 2.0, 0–30 cm median and 90 % range), texture class, available water
        capacity used by the engine, and what satellites cannot tell (needs a soil test)."""
        s = self.results["soil"]
        props = {p["id"]: {"label_tr": p["label"]["tr"], "median": _r(p["q50"], 1), "q05": _r(p["q05"], 1),
                           "q95": _r(p["q95"], 1), "unit": p["unit"]} for p in s["properties"]}
        return self._out({"properties_0_30cm": props, "texture_class_0_100cm": s.get("texture_class"),
                          "available_water_capacity_mm_per_m": _r(s["awc_mm_per_m"]["value"], 1),
                          "awc_type": s["awc_mm_per_m"]["type"],
                          "needs_soil_test": s["not_available_remotely"],
                          "warning": "Regional estimate (250 m model), not the farmer's field."})

    def satellites(self) -> dict:
        """What NASA data show at the point: MODIS NDVI monthly pattern (when the land is green / bare), NASA
        MERRA-2 root-zone soil wetness (latest month and its percentile), and rain from POWER vs IMERG vs the
        MGM station (from the evidence checks)."""
        out = {}
        p = config.DATA_DIR / "modis" / f"{self.loc}.json"
        if p.exists():
            comps = json.loads(p.read_text(encoding="utf-8"))["composites"]
            by_m = {m: [c["ndvi"] for c in comps if c["ndvi"] is not None and int(c["date"][5:7]) == m] for m in range(1, 13)}
            clim = {m: round(statistics.mean(v), 2) for m, v in by_m.items() if v}
            peak = max(clim, key=clim.get)
            low3 = sorted(clim, key=clim.get)[:3]
            out["modis_ndvi"] = {"years": f"{comps[0]['date'][:4]}–{comps[-1]['date'][:4]}", "monthly_mean": clim,
                                 "peak_month": peak, "lowest_months": low3,
                                 "meaning": "NDVI ~0.1–0.2 bare or dry soil, higher = green crop cover."}
        sm = _web(f"smap/{self.loc}.json")
        if sm.get("available") and sm.get("latest"):
            out["merra2_soil_wetness"] = {"latest_month": sm["latest"]["date"][:7],
                                          "rootzone_wetness_pct": _r(sm["latest"]["rootzone_wetness"] * 100),
                                          "percentile_for_month": _r(sm["latest"]["percentile_for_month"]),
                                          "note": "NASA reanalysis model, ~55 km cell; 100 % = saturated."}
        return self._out(out)

    def checks(self) -> dict:
        """Evidence-panel checks (consistency, not field validation), with the parts that mention this district."""
        name = next(l["name"] for l in self.site["locations"] if l["id"] == self.loc)
        out = []
        for c in _web("validation.json")["checks"]:
            parts = [x.strip() for x in c["value"].split(";")]
            mine = [x for x in parts if x.startswith(name)] or ([c["value"]] if c["id"] in ("mass_balance", "et0_fao56_ex18") else [])
            if c["id"] == "precip_vs_mgm":   # the per-district text continues over several ';' parts
                i = next((k for k, x in enumerate(parts) if x.startswith(name)), None)
                if i is not None:
                    mine = [parts[i]] + [x for x in parts[i + 1:i + 3] if not any(x.startswith(l["name"]) for l in self.site["locations"])]
            out.append({"id": c["id"], "status": c["status"], "for_this_district": mine, "note_tr": c["note"]["tr"]})
        return self._out({"checks": out})


TOOL_SPECS = [
    {"name": "district", "description": Tools.district.__doc__, "parameters": {"type": "object", "properties": {}}},
    {"name": "rotations", "description": Tools.rotations.__doc__,
     "parameters": {"type": "object", "properties": {"scenario_id": {"type": "string"}}}},
    {"name": "scenarios", "description": Tools.scenarios.__doc__, "parameters": {"type": "object", "properties": {}}},
    {"name": "soil", "description": Tools.soil.__doc__, "parameters": {"type": "object", "properties": {}}},
    {"name": "satellites", "description": Tools.satellites.__doc__, "parameters": {"type": "object", "properties": {}}},
    {"name": "checks", "description": Tools.checks.__doc__, "parameters": {"type": "object", "properties": {}}},
]
