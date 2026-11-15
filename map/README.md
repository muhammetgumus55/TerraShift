# Arksus · land map (`map/`)

A 3D land map of Turkey built on three.js, for the Arksus project
(NASA Space Apps 2026, *Field Shift*). It opens the 13 Central Anatolian pilot districts
(one per province, from `web/public/data/site_index.json`) with their 24-year water / soil results, and lets you pick
provinces, islands, fields and parcels anywhere in Turkey.

```bash
cd map
npm install
npm run dev          # http://localhost:5180, tiles fetched directly
npm run dev:proxy    # same, but tiles go through the dev server (for sandboxed browsers)
npm run build        # typecheck + production build into dist/
npm run data         # rebuild public/data/{provinces,islands}.json from scripts/*-raw.json
```

## What is real and what is not

| Layer | Source | Status |
|---|---|---|
| Terrain | Mapzen Terrain Tiles on AWS Open Data (SRTM, GMTED, ETOPO1) | measured |
| Imagery | Sentinel-2 cloudless 2023 (EOX, open), Esri World Imagery (commercial, optional), OSM, OpenTopoMap | |
| Provinces | geoBoundaries gbOpen TUR ADM1 (OSM-derived, CC BY-SA) | |
| Islands | OpenStreetMap `place=island|islet` in Turkey, prebuilt | ODbL |
| Fields | OpenStreetMap `landuse=farmland|orchard|vineyard|…`, live from Overpass per z13 cell, cached in the browser | ODbL; coverage is uneven (sparse around Karapınar) |
| Parcels | TKGM Parsel Sorgu (`src/tkgm.ts`): ada/parsel form and click-to-query at z14+ | **blocked in the browser**: the service answers 403 to requests coming from other sites. Needs official TKGM (MEGSİS) access, or an import of the KML/GeoJSON exported from parselsorgu.tkgm.gov.tr |
| Pilot districts | `../web/public/data` (served as `/data/nobetsu`, copied into the build) and `../web/src/lib/{types,economics}.ts`, read in place | follows the contract (ARAYUZLER.md) and the display rules in ISMAIL_BAKMALI.md |

## How it works

- `src/engine/Terrain.ts`: Web Mercator quadtree. Each tile is one shared grid
  displaced on the GPU by its elevation tile; ancestors stand in while children load.
- `src/engine/Overlay.ts`: vector layers are rasterised into a per-tile canvas and
  blended in the terrain shader, so they drape exactly at any exaggeration.
- `src/engine/MapCamera.ts`: pan and zoom anchored to the terrain point under the cursor.
- `src/pilots.ts`: loads Arksus data and calls its `economics.ts`; money and kg/da
  are hidden while cost or Ym is still `null`, as the project's rules require.
- `src/strings.ts`: every UI string in Turkish and English.

Public Overpass instances rate-limit hard and are sometimes at capacity; field
loading backs off and retries on its own.

`map/` is a standalone Vite app next to `web/`; it does not touch `web/` and
only reads the data contract from it.
