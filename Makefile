# Arksus — owner: Gümüş (Rol B). Windows: install make (e.g. `winget install ezwinports.make`) or run the commands below by hand.
PYTHON ?= python

.PHONY: test test-py test-web test-map mock data web map agent ndvi merra2

test: test-py test-web test-map

test-py:
	cd engine && $(PYTHON) -m pytest -q

# Web tests run once İsmail's web/ skeleton (package.json with vitest) exists.
test-web:
	@if [ -f web/package.json ]; then cd web && npm test -- --run; else echo "web/package.json yok: web testleri atlandı"; fi

# The 3D map (map/) builds against web/public/data and web/src/lib; typecheck + build.
test-map:
	@if [ -f map/package.json ]; then cd map && npm run build; else echo "map/package.json yok: harita derlemesi atlandı"; fi

mock:
	cd engine && $(PYTHON) -m nobetsu.build --mock --out ../web/public/data

# One process per district (build.py --jobs); same output as a sequential run.
data:
	cd engine && $(PYTHON) -m nobetsu.build --out ../web/public/data

# NASA MERRA-2 soil wetness (replaces SMAP) and MODIS NDVI caches; no login. NDVI is slow (ORNL API).
merra2:
	cd engine && $(PYTHON) -m nobetsu.merra2
ndvi:
	cd engine && $(PYTHON) -m nobetsu.modis

# AI district commentary with a free local model: `ollama pull qwen2.5:14b` once, then after `make data`.
agent:
	cd engine && $(PYTHON) -m nobetsu.agent

web:
	cd web && npm ci && npm run build

map:
	cd map && npm ci && npm run build
