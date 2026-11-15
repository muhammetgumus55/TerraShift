# Arksus

**Fallow saves water but leaves the soil bare. Arksus weighs water, soil, yield and what the farmer can earn across 24 years of NASA climate, and shows which rotation suits the land best.**

NASA Space Apps Challenge 2026 · *Field Shift: Adapting Farms with NASA Data*

Arksus helps rainfed farmers in Central Anatolia (Turkey) compare three two-year rotations before wheat:

| Rotation | Role |
|---|---|
| Fallow → Wheat | current practice (baseline) |
| Chickpea → Wheat | alternative |
| Lentil → Wheat | alternative |

For **13 districts** (one per Central Anatolian province), **3 soil depth classes** and **24 historical sequences** (start years 2001–2024), a daily FAO-56 soil water balance driven by **NASA POWER** weather shows, for each rotation compared with fallow:

- **Water:** plant-available water left in the soil at wheat sowing, and the months when wheat is under water or heat stress.
- **Soil:** bare days per month and windy, dry, bare days (wind-exposure count); nitrogen-fixing crops; a regional soil card from SoilGrids.
- **Yield:** the range of wheat and legume yields that water allows (P10 / P50 / P90).
- **Recommendation:** the rotation most suitable for this land under the farmer's priorities (earnings, wheat yield, soil, water). Prices and supports are used **internally** to judge what earns more; the site shows **no money**. Rotations that cut the next wheat below 85 % of after-fallow wheat, or whose year-1 crop fails in the median year, are **blocked** whatever they would earn.
- **Fertiliser, sowing and soil health (beyond "what to plant"):** a fertiliser plan from the official TAGEM Central Anatolia soil-test tables (when, which product, kg per dekar; phosphorus and potassium need the farmer's lab values), how to sow (window, seeds per m² and kg/da from the farmer's own seed label, depth, row spacing) and soil-protection practices with regional evidence and the field's own model numbers. Details: `docs/GUBRE.md`.

It is **not** a yield forecast for one field or a price forecast, and its fertiliser plan does not replace a soil test. Every recommendation shows its main reason, the blocked options and whether the result is a close call; the final decision stays with the farmer and local experts.

---

## Status (15 Nov 2026)

| Part | State |
|---|---|
| Engine (FAO-56 ET₀, two-layer dual-Kc water balance, yield ratio, soil indicators) | done, 13 districts |
| Real data in `web/public/data/` (`mock: false`) | done, tag `v0.1` (2 districts), extended to 13 |
| Validation checks (6) | 2 pass, 4 info (soil-wetness check now uses NASA MERRA-2) |
| Decision module (`web/src/lib/economics.ts`: score, guardrails, recommendation) | done, unit-tested |
| Reference yields, prices, supports (internal parameters), validation references | sourced (`docs/SOURCES.md`) |
| Production costs | not used (team decision 14 Nov: no money shown; costs not sourced) |
| NASA soil wetness | **NASA MERRA-2** root-zone wetness (via POWER) in the soil-wetness panel and check; SMAP L4 was never delivered by AppEEARS and was dropped (15 Nov) |
| NASA MODIS NDVI | done: crop-calendar check, and it found **9 of 13 points on irrigated fields**; they were moved to rainfed cropland (WorldCover + NDVI) |
| POWER precipitation | **station-corrected** (linear scaling to the WMO 1991–2020 normal); raw POWER stays in the precipitation check |
| AI district commentary | engine side done (local free model via Ollama, every number checked against the data); reports pending the model download |
| CI | GitHub Actions: engine tests, web tests, web and map builds |
| Climate sensitivity scenarios (drier / warmer, E2) | done: 5 scenarios × 13 districts in `results/{loc}__{scenario}.json` |
| NASA GPM IMERG precipitation (second satellite estimate) | done, shown in the precipitation check |
| Fertiliser plan, how to sow, soil health (`web/src/lib/{fertilizer,sowing,soilhealth}.ts`, `docs/GUBRE.md`) | done, unit-tested; sourced from TAGEM, TİGEM, GKGM and regional trials (research: `reports/`) |
| Web site (React) | working (`web/`): guided flow around the 3D map (`map/`), result with options, scenarios, field calendar, terrain and runoff, fertiliser, sowing and soil-health cards; deployment pending |

---

## How it works

```
NASA POWER (daily weather, 2000→, station-corrected rain) ─┐
NASA GPM IMERG · NASA MERRA-2 · NASA MODIS NDVI (checks) ───┤
SoilGrids 2.0 (soil, 250 m) · ESA WorldCover (points) ──────┼─► engine/ (Python, offline) ─► web/public/data/*.json ─► web/ + map/
engine/config/*.yaml (crops, soil, locations, prices, refs) ┘     FAO-56 water balance,          contract: docs/contract/   decision in the browser
                                                                  yield ratio Ya/Ym, checks      (+ agent/*.json AI notes)   (priority sliders)
```

- The Python engine computes **physical results only** (water, ET, yield ratio 0–1). It runs once and writes JSON.
- The browser scores each rotation (earnings estimate from yield ratio × reference yield × price + support, wheat yield, soil, water), applies the guardrails and names the most suitable rotation. No TL is displayed. No server and no database: the decision uses only the precomputed JSON. For context the browser also fetches live, without keys: map tiles and imagery (Esri, OpenFreeMap, EOX, NASA GIBS, AWS terrain tiles), place search (OpenStreetMap Nominatim), parcel lookup (TKGM), Sentinel-2 scenes (Element 84 Earth Search) and the last 30 days of NASA POWER rain at the field. None of these change the recommendation.
- Every number carries a source and a type badge: `measured`, `model`, `official`, `statistic`, `literature`, `assumption`, `user`. Values not yet sourced are `null` and shown as pending, never as a number.

### Engine in short

- **ET₀:** FAO-56 Penman–Monteith (daily), tested against FAO-56 Example 18 (3.88 vs 3.9 mm/day).
- **Water balance:** daily, two-layer, dual crop coefficient (FAO-56 Ch. 7); roots grow into stored water. Mass balance closes to ~1e-12 mm over all 2,808 sequences.
- **Sequence:** spin-up wheat, then the rotation's year 1 (bare fallow, or bare → legume → bare), then winter wheat.
- **Yield:** `Ya/Ym = 1 − Ky (1 − ΣETa/ΣETc)` (FAO-33). No extra "previous crop" factor, because the water effect is already in the model.
- **Available water capacity (AWC):** soil texture class from SoilGrids → FAO-56 Table 19 midpoint × (1 − coarse fragments). SoilGrids' own AWC (wv0033 − wv1500) ranged from 58 to 144 mm/m and was implausibly low at several points (58 at Karapınar, 67 at Develi, 70 at Karaman) because its field-capacity estimate is low for these clay soils. It is kept in the data for comparison, together with a Saxton & Rawls (2006) estimate (106–154 mm/m).

---

## Quick start

Requirements: Python 3.11+, Git. Node.js 20+ only for the web part.

```bash
git clone https://github.com/muhammetgumus55/TerraShift.git
cd TerraShift
pip install -e "./engine[dev]"
```

| Command | What it does |
|---|---|
| `make test` | pytest (engine) + vitest (web) + map build |
| `make data` | builds the real JSON from the cached data, one process per district (~1.5 min) |
| `make merra2` / `make ndvi` | refresh NASA MERRA-2 soil wetness / MODIS NDVI caches (no login; NDVI is slow) |
| `make agent` | AI district commentary with a local free model (`ollama pull qwen2.5:14b` once) |
| `make mock` | builds fake JSON in the same format (for UI work; do not commit) |
| `make web` / `make map` | builds the web site / the 3D map |

Without `make` (e.g. Windows without `winget install ezwinports.make`):

```bash
cd engine
python -m pytest -q                                  # tests
python -m nobetsu.build --out ../web/public/data      # make data
python -m nobetsu.build --mock --out ../web/public/data   # make mock
python -m nobetsu.power                               # fetch NASA POWER for locations without a cache
python -m nobetsu.imerg                               # fetch NASA GPM IMERG monthly precipitation (no login needed)
python -m nobetsu.soilgrids                           # pull SoilGrids for all locations
python -m nobetsu.merra2                              # NASA MERRA-2 soil wetness → data/merra2 + data/smap (soil-wetness slot)
python -m nobetsu.modis                               # NASA MODIS NDVI (ORNL API, slow, resumable)
python -m nobetsu.agent                               # AI district commentary (Ollama, local)
```

Raw downloads are cached in `data/` and committed, so `make data` needs no network.

### Add a district

1. Add a point to `engine/config/locations.yaml` (id, name, district, province, lat, lon, note).
2. `python -m nobetsu.power`, `python -m nobetsu.soilgrids`, `python -m nobetsu.imerg`, `python -m nobetsu.merra2`, `python -m nobetsu.modis`; check with NDVI that the point is not irrigated (summer-green).
3. Add its WMO 1991–2020 precipitation normal to `engine/config/references.yaml` and a block to `engine/config/defaults.yaml`.
4. `make data && make test`.

---

## Repository layout

```
engine/
  config/        locations, crops, soil, rotations (texts), defaults (decision parameters), references (validation)
  nobetsu/       power, soilgrids, imerg, merra2, modis, et0, waterbalance, rotations, yieldmodel, indicators, runner, validate,
                 export, build, mock, agent, agent_tools
  tests/         pytest
web/
  public/data/   generated JSON (the contract)
  src/lib/       types.ts (contract types), economics.ts (+ tests)
data/            cached NASA POWER, SoilGrids, IMERG, MERRA-2, MODIS NDVI (data/smap/ = soil-wetness slot, MERRA-2)
map/             3D map of the districts (separate Vite app)
docs/            PLAN_MVP.md, ARAYUZLER.md (interfaces), contract/*.schema.json, SOURCES.md, AI_USE.md
```

---

## Data sources

| Data | Use | Access |
|---|---|---|
| **NASA POWER** daily (PRECTOTCORR, T2M_MAX/MIN, T2MDEW, RH2M, WS2M, WS2M_MAX, ALLSKY_SFC_SW_DWN), community AG | weather for the engine, 2000-01-01 → 2026-11-09 | [power.larc.nasa.gov](https://power.larc.nasa.gov/) API |
| **NASA MERRA-2** soil wetness (GWETROOT, GWETTOP), ~0.5° | regional soil-wetness panel; check of the model's soil water timing | NASA POWER monthly API (source MERRA-2), no login |
| **NASA MODIS** Terra MOD13Q1 v061 NDVI, 250 m, 16-day | crop-calendar check; detecting irrigated points | [ORNL DAAC Land Product Subsets API](https://modis.ornl.gov/data/modis_webservice.html), no login |
| **SoilGrids 2.0** (ISRIC), 250 m | soil card, texture class, coarse fragments | WCS |
| **NASA GPM IMERG** Final monthly V07 (0.1°) | second satellite precipitation estimate in the precipitation check | NSF NCAR GDEX mirror (d736000) |
| **WMO Climate Normals 1991–2020** (Turkish State Meteorological Service stations) | check of POWER precipitation | [NOAA NCEI archive](https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/) |
| **ESA WorldCover 2021** (10 m) | point selection: ≥ 60 % cropland within 300 m (with NDVI: not irrigated) | AWS open data (COG) |
| FAO-56 (Allen et al. 1998), FAO-33 | method and crop/soil parameters | [fao.org/4/x0490e](https://www.fao.org/4/x0490e/x0490e00.htm) |
| Gültekin et al. 2017, KSÜ Doğa Bil. Derg. 20: 283–287 | Konya dryland trial (wheat after fallow / lentil / chickpea) | [doi:10.18016/ksudobil.349258](https://doi.org/10.18016/ksudobil.349258) |
| TEPGE/TÜİK national yields, TMO 2026 prices, 2026 supports | internal decision parameters (never displayed) | see `docs/SOURCES.md` |

Every value, its link and access date are listed in `docs/SOURCES.md`; the YAML files repeat them next to each number.

---

## Validation (consistency checks, not field validation)

| Check | Result |
|---|---|
| Mass balance, all sequences | pass (< 0.01 mm) |
| ET₀ vs FAO-56 Example 18 | pass (±0.1 mm/day) |
| Fallow storage efficiency vs Central Anatolian literature (11–29 %) | info: model 8–17 % in 12 districts; Karaman 30 % (station correction halves its rain while the soil store stays near full) |
| Wheat yield after chickpea / lentil relative to after fallow vs the Konya trial (0.80 / 0.87) | info: model 0.85 / 0.86 at Karapınar (0.89 / 0.90 before the precipitation correction) |
| NASA POWER and NASA GPM IMERG annual precipitation vs WMO station normal | info: see below |
| NASA MERRA-2 root-zone wetness vs model soil-water fullness | info: seasonal ρ 0.87–0.96, monthly anomaly ρ 0.30–0.60 (not independent: POWER weather is also MERRA-2) |
| NASA MODIS NDVI vs model crop calendar | engine function ready (`validate.check_ndvi_calendar`), not yet a contract check |

---

## Assumptions and limitations

- **Results describe a typical field in the district** under 24 past climates, not a measured field.
- **NASA POWER is ~50 km, model/satellite-based.** Its precipitation differs from the nearest station by −14 % to +13 % in 10 districts, but by +36 % (Karapınar), +39 % (Eskişehir) and +83 % (Karaman). The engine therefore **scales daily POWER rain to the station normal** (factor 0.55–1.16); the normal covers 1991–2020, POWER 2000 onward. NASA GPM IMERG was tested as an alternative and was further from the stations on average (~29 % vs ~18 %).
- **One crop calendar** (Konya) is used for all districts: no sourced calendar was found for Sivas, Yozgat or Çankırı dryland wheat, and MODIS NDVI shows no clear elevation trend in green-up or dry-down.
- **Points:** each district is one point (rainfed cropland, checked with WorldCover and NDVI), not a field. The weather cell (~50 km) is shared by the district.
- **AI commentary** is generated from the site's own data by a local model; every number in it must match the data or the report is not shown. It does not replace the farmer or local experts.
- No runoff, snow, capillary rise, stubble mulch or irrigation in the water balance.
- The wind-exposure index is a **count of windy, dry, bare days**, not a measured soil loss.
- **Nitrogen fixation** is shown as a trait only; no kg N/da is estimated (needs a soil test).
- Phosphorus, potassium, micronutrients and compaction cannot be estimated from satellites; the site says so.
- ESA WorldCover does not separate irrigated from rainfed cropland; NDVI (never green in summer) is used for that.
- **Earnings are an internal estimate** from national reference yields, 2026 prices and supports; production costs are not included. The chickpea price (one exchange, Feb 2026) is the least certain parameter and pushes several districts towards chickpea.
- Supports are national 2026 amounts (basic + planned production); conditional extras are not included.

---

## Team

| Person | Role |
|---|---|
| Ömer | engine and science |
| Gümüş | data, contract, decision module, delivery |
| İsmail | web site |
| Muhammet | research, sources, pitch |

AI tools were used; who used which tool for what is listed in [`docs/AI_USE.md`](docs/AI_USE.md).

---

## Türkçe özet

Arksus, İç Anadolu'daki kuru tarım çiftçisi için "nadas mı, nohut mu, mercimek mi?" sorusunu su, toprak, verim ve çiftçinin kazancı açısından birlikte tartar (para gösterilmez), NASA POWER'ın 24 yıllık iklim verisiyle birlikte gösterir. 13 ilin her birinden bir ilçe, 3 toprak derinliği ve 3 rotasyon için hesaplanır. Bir tarla için verim tahmini değildir, "şunu ek" demez; seçenekleri yan yana koyar, kararı çiftçi ve yerel uzman verir. Kurulum ve komutlar yukarıda; tüm kaynaklar `docs/SOURCES.md`'de.
