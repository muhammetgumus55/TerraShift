# Arksus

**Fallow saves water but leaves the soil bare. Arksus weighs water, soil, yield and what the farmer can earn across 24 years of NASA climate data, and shows which rotation suits the land best.**

[![test](https://github.com/muhammetgumus55/TerraShift/actions/workflows/test.yml/badge.svg)](https://github.com/muhammetgumus55/TerraShift/actions/workflows/test.yml)

NASA Space Apps Challenge 2026 · *Field Shift: Adapting Farms with NASA Data* · Türkçe özet [aşağıda](#türkçe-özet)

---

## Contents

- [The problem](#the-problem)
- [What Arksus does](#what-arksus-does)
- [How it answers the challenge](#how-it-answers-the-challenge)
- [NASA and other data](#nasa-and-other-data)
- [How it works](#how-it-works)
- [Validation](#validation)
- [Assumptions and limitations](#assumptions-and-limitations)
- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Team and AI use](#team-and-ai-use)

---

## The problem

In rainfed Central Anatolia (Turkey), wheat is usually followed by a year of **bare fallow**. The fallow year stores rain in the soil, so the next wheat crop is safer in a dry year. It also earns nothing that year. The soil stays bare and tilled for more than a year and is exposed to wind. Wind erosion around Karapınar in the 1960s was officially linked to the fallow–cereal system and frequent disc tillage.

Growing **chickpea** or **lentil** instead of fallow earns an income, fixes nitrogen and shortens the bare period. However, it leaves less water for the next wheat crop. After the 2025 drought and low 2026 grain prices, farmers face this question again. No tool weighs water, soil, yield and earnings together for a given piece of land.

## What Arksus does

Arksus compares three two-year rotations ending in winter wheat:

| Rotation | Role |
|---|---|
| Fallow → Wheat | current practice (baseline) |
| Chickpea → Wheat | alternative |
| Lentil → Wheat | alternative |

The comparison covers **13 districts** (one rainfed district per Central Anatolian province), **3 soil depth classes** and **24 climate years** (sequences starting 2001–2024). For each rotation, compared with fallow, the site shows:

- **Water:** plant-available water left in the soil at wheat sowing; months in which wheat is under water or heat stress.
- **Soil:** bare days per month; windy, dry, bare days (a wind-exposure count); nitrogen fixation; a regional soil card from SoilGrids.
- **Yield:** the range of wheat and legume yields that water allows (P10 / P50 / P90 over 24 years).
- **Recommendation:** *"Most suitable for this land under your priorities: …"* The farmer sets four priority sliders: earnings, wheat yield, soil and water. Each recommendation shows its main reason, the blocked options and whether the result is a close call.
- **Why this crop, in text and voice:** a short explanation built only from the site's own numbers, read aloud by the farmer mascot in Turkish or English. The clips are pre-generated with a free local text-to-speech engine (Piper).
- **Beyond "what to plant":**
  - a fertiliser plan from the official TAGEM Central Anatolia soil-test tables; phosphorus and potassium need the farmer's lab values;
  - how to sow: window, seed rate from the farmer's own seed label, depth and row spacing;
  - soil-protection practices backed by regional evidence.

  Details are in [`docs/GUBRE.md`](docs/GUBRE.md).
- **Climate sensitivity:** five drier or warmer scenarios per district.
- **3D map:** a terrain map of Turkey ([`map/`](map/README.md)) for picking the district, field or parcel.

**Guardrails.** Some rotations are never recommended, however much they would earn:

- a rotation that cuts the next wheat below **85 %** of the yield after fallow;
- a rotation whose year-1 crop reaches less than **30 %** of its potential in the median year.

The thresholds are in `engine/config/defaults.yaml` → `decision.guardrails`.

**No money on screen.** Prices and supports are used **inside** the browser only, to judge which rotation earns more; the site shows 0–1 scores, never currency.

**What it is not.** It is not a yield forecast for one field and not a price forecast. Its fertiliser plan does not replace a soil test. The final decision stays with the farmer and local experts.

## How it answers the challenge

| Challenge asks | Arksus |
|---|---|
| Use NASA Earth observation data to help farms adapt | Five NASA datasets: POWER drives the model; GPM IMERG, MERRA-2 and MODIS NDVI check it and placed the points |
| Address a changing climate | 24 historical climate years show the spread between dry, normal and wet years, plus drier and warmer scenarios |
| Support a practical farm decision | One concrete choice (what to grow before wheat), ranked by the farmer's own priorities with blocked options and their reasons |
| Be usable by farmers | Guided flow, plain-language Turkish and English, spoken explanations, no money or jargon on screen |
| Be honest about uncertainty | Every number has a source type badge; ranges instead of single values; "close call" when the options are near each other |

---

## NASA and other data

| Data | Used for | Access |
|---|---|---|
| **NASA POWER** daily (rain, temperature, dew point, humidity, wind, solar radiation), community AG, 2000 → | weather driving the water balance; rain station-corrected (see limitations) | [power.larc.nasa.gov](https://power.larc.nasa.gov/) API |
| **NASA GPM IMERG** Final monthly V07, 0.1° | second satellite rain estimate in the precipitation check | NSF NCAR GDEX mirror (d736000), no login |
| **NASA MERRA-2** root-zone and surface soil wetness, ~0.5° | regional soil-wetness panel; check of the model's soil-water timing | NASA POWER monthly API, no login |
| **NASA MODIS** Terra MOD13Q1 v061 NDVI, 250 m, 16-day | crop-calendar check; found 9 of 13 first points on irrigated fields | [ORNL DAAC subsets API](https://modis.ornl.gov/data/modis_webservice.html), no login |
| **SoilGrids 2.0** (ISRIC), 250 m | texture class, coarse fragments, soil card | WCS |
| **ESA WorldCover 2021**, 10 m | point selection: ≥ 60 % cropland within 300 m | AWS open data |
| **WMO Climate Normals 1991–2020** (Turkish State Meteorological Service stations) | rain correction and precipitation check | [NOAA NCEI archive](https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/) |
| FAO-56 (Allen et al. 1998), FAO-33 | method; crop and soil parameters | [fao.org/4/x0490e](https://www.fao.org/4/x0490e/x0490e00.htm) |
| Gültekin et al. 2017, KSÜ Doğa Bil. Derg. 20: 283–287 | Konya dryland trial (wheat after fallow / lentil / chickpea) | [doi:10.18016/ksudobil.349258](https://doi.org/10.18016/ksudobil.349258) |
| TEPGE / TÜİK yields, TMO 2026 prices, 2026 supports | internal decision parameters (never displayed) | [`docs/SOURCES.md`](docs/SOURCES.md) |

NASA SMAP L4 was planned for soil moisture, but the data request was never delivered. It was dropped on 15 Nov and MERRA-2 fills its place; no mock data was used.

Every value is listed with its link and access date in [`docs/SOURCES.md`](docs/SOURCES.md). The YAML files repeat the source next to each number as `value, unit, source, type, verified`.

---

## How it works

```
NASA POWER (daily weather, station-corrected rain) ─────────┐
NASA GPM IMERG · NASA MERRA-2 · NASA MODIS NDVI (checks) ───┤
SoilGrids 2.0 (soil) · ESA WorldCover (point selection) ────┼─► engine/  (Python, offline)
engine/config/*.yaml (crops, soil, locations, references) ──┘     FAO-56 water balance, yield ratio, checks
                                                                   │
                                                                   ▼
                                                     web/public/data/*.json   (contract: docs/contract/*.schema.json)
                                                                   │
                                                                   ▼
                                       web/ (React)  +  map/ (three.js)  —  decision runs in the browser
```

- **The engine computes physical results only** (water, evapotranspiration, yield ratio 0–1). It runs once and writes JSON.
- **The browser makes the decision.** It scores each rotation for earnings, wheat yield, soil and water. The earnings score is an internal estimate: yield ratio × reference yield × price, plus support. The browser then applies the guardrails and names the most suitable rotation. There is no server-side decision and no money on screen.
- **Every number carries a type badge:** `measured`, `model`, `official`, `statistic`, `literature`, `assumption` or `user`. Values not yet sourced are `null` and shown as pending, never as a number.
- **Live context.** The browser also fetches some data without keys: map tiles and imagery, place search, parcel lookup, Sentinel-2 scenes and the last 30 days of NASA POWER rain at the field. None of this changes the recommendation.
- **Optional sign-in.** Supabase (email and password) stores the farmer's answers. Consent texts are in [`docs/legal/`](docs/legal/README.md); they are drafts pending legal review.

### Engine in short

- **ET₀:** FAO-56 Penman–Monteith, daily; tested against FAO-56 Example 18 (3.88 vs 3.9 mm/day).
- **Water balance:** daily, two-layer, dual crop coefficient (FAO-56 Ch. 7). Roots grow into stored water. The mass balance closes to ~1e-12 mm over all 2,808 sequences.
- **Sequence:** a spin-up wheat year, then the rotation's year 1 (bare fallow, or bare → legume → bare), then winter wheat.
- **Yield:** `Ya/Ym = 1 − Ky (1 − ΣETa/ΣETc)` (FAO-33). There is no extra "previous crop" factor; the water effect is already in the model.
- **Available water capacity:** derived from the SoilGrids texture class, using the FAO-56 Table 19 midpoint × (1 − coarse fragments). SoilGrids' own estimate (58–144 mm/m) is implausibly low for these clay soils. It is kept for comparison, together with a Saxton & Rawls (2006) estimate.
- **Explanations:** `nobetsu.explain` turns the results into short farmer-friendly sentences with whole numbers; templates only. `nobetsu.tts` voices them, producing 234 Turkish and English clips.

---

## Validation

These are consistency checks against literature and observations, not field validation. They run in `engine/nobetsu/validate.py` and their results are shown on the site.

| Check | Result |
|---|---|
| Mass balance, all sequences | **pass** (< 0.01 mm) |
| ET₀ vs FAO-56 Example 18 | **pass** (±0.1 mm/day) |
| Fallow storage efficiency vs Central Anatolian literature (11–29 %) | info: model 8–17 % in 12 districts; Karaman 30 % |
| Wheat after chickpea / lentil relative to after fallow vs the Konya trial (0.80 / 0.87) | info: model 0.85 / 0.86 at Karapınar |
| NASA POWER and GPM IMERG annual rain vs WMO station normals | info: POWER differs from the station by −14 % to +83 % before correction; IMERG averages ~29 % off, POWER ~18 % |
| NASA MERRA-2 root-zone wetness vs model soil water | info: seasonal ρ 0.87–0.96, monthly anomaly ρ 0.30–0.60 (not independent: POWER weather also comes from MERRA-2) |
| NASA MODIS NDVI vs model crop calendar | engine check; no clear elevation trend in green-up or dry-down, so one calendar is kept |

The test suite has about 200 engine tests (pytest) plus web unit tests (vitest). Both run in CI on every push, together with the web and map builds.

---

## Assumptions and limitations

- **Results describe a typical rainfed field in the district** under 24 past climates, not a measured field. Each district is one point on rainfed cropland, checked with WorldCover and NDVI; the ~50 km weather cell is shared by the district.
- **Rain is station-corrected.** POWER rain differs from the nearest station normal by −14 % to +13 % in 10 districts, but by +36 % at Karapınar, +39 % at Eskişehir and +83 % at Karaman. Daily POWER rain is therefore scaled to the WMO 1991–2020 normal (factor 0.55–1.16; linear scaling, Teutschbein & Seibert 2012). The normal covers 1991–2020; POWER covers 2000 onward.
- **One crop calendar** (Konya) is used for all districts. No sourced calendar was found for Sivas, Yozgat or Çankırı dryland wheat, and MODIS NDVI shows no clear elevation trend.
- **Not modelled:** runoff, snow, capillary rise, stubble mulch and irrigation.
- **Soil indicators are counts, not losses.** The wind-exposure index counts windy, dry, bare days; it is not a measured soil loss. Nitrogen fixation is shown as a trait, with no kg N/da estimate.
- **Not seen from satellites:** phosphorus, potassium, micronutrients and compaction. The site says so and asks for a soil test.
- **Earnings are an internal estimate.** They use national reference yields, 2026 prices and national supports (basic plus planned production). Production costs are not included. The chickpea price (one exchange, Feb 2026) is the most uncertain parameter.
- **AI-written district reports are hidden.** A local language model drafted them, but they failed human review for meaning errors. The "why this crop" text is built from templates instead.

---

## Quick start

Requirements: Python 3.11+ and Git; Node.js 20+ for the web and map.

```bash
git clone https://github.com/muhammetgumus55/TerraShift.git
cd TerraShift
pip install -e "./engine[dev]"
make test
```

| Command | What it does |
|---|---|
| `make test` | engine tests (pytest), web tests (vitest) and the map build |
| `make data` | builds the real JSON from the committed data cache, one process per district (~1.5 min, no network) |
| `make web` / `make map` | builds the web site / the 3D map |
| `make mock` | builds fake JSON in the same format, for UI work only (do not commit) |
| `make merra2` / `make ndvi` | refreshes the NASA MERRA-2 / MODIS NDVI caches (no login; NDVI is slow and resumable) |

To run the site locally:

```bash
npm --prefix web install
npm --prefix web run dev
```

<details>
<summary>Without <code>make</code> (e.g. Windows)</summary>

```bash
cd engine
python -m pytest -q                                       # tests
python -m nobetsu.build --out ../web/public/data          # make data
python -m nobetsu.build --mock --out ../web/public/data   # make mock
python -m nobetsu.power                                   # NASA POWER for locations without a cache
python -m nobetsu.imerg                                   # NASA GPM IMERG monthly rain
python -m nobetsu.soilgrids                               # SoilGrids for all locations
python -m nobetsu.merra2                                  # NASA MERRA-2 soil wetness
python -m nobetsu.modis                                   # NASA MODIS NDVI (slow, resumable)
python -m nobetsu.explain --no-llm                        # "why this crop" texts
python -m nobetsu.tts                                     # voice clips (Piper, local)
```

</details>

### Add a district

1. Add a point to `engine/config/locations.yaml` (id, name, district, province, lat, lon, note).
2. Fetch its data: `power`, `soilgrids`, `imerg`, `merra2`, `modis`. Check with NDVI that the point is not irrigated, i.e. not green in summer.
3. Add its WMO 1991–2020 precipitation normal to `engine/config/references.yaml` and a block to `engine/config/defaults.yaml`.
4. Run `make data && make test`.

---

## Repository layout

```
engine/
  config/        YAML parameters with sources: crops, soil, locations, rotations, defaults, references, scenarios
  nobetsu/       data clients (power, imerg, merra2, modis, soilgrids), model (et0, waterbalance, rotations,
                 yieldmodel, indicators, runner), checks (validate), output (export, build, explain, tts)
  tests/         pytest
web/             React + Vite site; public/data/ holds the generated JSON, audio and explanations
map/             3D terrain map (three.js, separate Vite app)
data/            committed cache of NASA POWER, IMERG, MERRA-2, MODIS NDVI and SoilGrids downloads
docs/            plan, data contract, sources, fertiliser notes, legal texts, team guides
```

The Python package is still named `nobetsu` (the project's working name) so that imports and the data contract stay stable.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/README.md`](docs/README.md) | index of all documents |
| [`docs/PROJE_OZETI.md`](docs/PROJE_OZETI.md) | five-minute overview in Turkish, for non-developers |
| [`docs/PLAN_MVP.md`](docs/PLAN_MVP.md) | the plan and rules (single source of truth) |
| [`docs/ARAYUZLER.md`](docs/ARAYUZLER.md) | interfaces between engine, data and web; JSON contract |
| [`docs/SOURCES.md`](docs/SOURCES.md) | every number with its source, link and access date |
| [`docs/GUBRE.md`](docs/GUBRE.md) | fertiliser, sowing and soil-health method |
| [`docs/AI_USE.md`](docs/AI_USE.md) | which AI tools were used for what |

---

## Team and AI use

| Person | Role |
|---|---|
| Ömer | engine and science (water balance, yield model, NASA data checks, explanations and voice) |
| Gümüş | data, contract, decision module, delivery |
| İsmail | web site |
| Muhammet | research, sources, pitch |
| Biar | 3D map |

AI tools were used during development. Who used which tool for what is listed in [`docs/AI_USE.md`](docs/AI_USE.md).

---

## Türkçe özet

Arksus, İç Anadolu'da kuru tarım yapan çiftçinin buğdaydan önceki yıl için sorduğu "nadas mı, nohut mu, mercimek mi?" sorusunu yanıtlar. Su, toprak, verim ve çiftçinin kazancı birlikte tartılır. Hesap, NASA POWER'ın 24 yıllık iklim verisiyle yapılır; yağış, istasyon normaline göre düzeltilir. NASA GPM IMERG, MERRA-2 ve MODIS NDVI ise modeli kontrol eder.

13 ilin her birinden bir ilçe, 3 toprak derinliği ve 3 rotasyon hesaplanır. Site çiftçinin önceliklerine göre "bu arazi için en uygun" seçeneği gösterir; gerekçesini, engellenen seçenekleri ve sonuçların yakın olup olmadığını da yazar. "Neden bu ürün?" açıklaması çiftçi maskotu tarafından Türkçe ya da İngilizce sesli okunur. Sitede para gösterilmez. Sonuçlar tek bir tarlanın verim tahmini değildir; kararı çiftçi ve yerel uzman verir.

Ayrıntılı Türkçe anlatım: [`docs/PROJE_OZETI.md`](docs/PROJE_OZETI.md). Kaynaklar: [`docs/SOURCES.md`](docs/SOURCES.md).
