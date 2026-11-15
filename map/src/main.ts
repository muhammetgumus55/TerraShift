import './style.css';
import * as THREE from 'three';
import { Terrain } from './engine/Terrain';
import { MapCamera } from './engine/MapCamera';
import { OverlayManager } from './engine/Overlay';
import { createSky } from './engine/Sky';
import { scheduler } from './engine/TileStore';
import { BASEMAPS, LABELS, TERRAIN } from './sources';
import {
  formatLat, formatLon, lonLatToMerc, mercScale, mercToLonLat, mercToScene as mercToSceneXZ, polygonCentroid, sceneToMerc, tileBBox as tileBox, type BBox,
} from './geo';
import { featureContains, loadIslands, loadProvinces, type Feature } from './vector/features';
import { Pilots } from './pilots';
import { ProcessSim } from './sim/ProcessSim';
import { FieldView } from './sim/FieldView';
import { parcelAt, parcelByNumber, TkgmError } from './tkgm';
import { attachParcelSearch } from './ui/parcelSearch';
import { applyStatic, getLang, setLang, t, type Key, type Lang } from './strings';
import { LANDUSE } from './vector/fields';
import { VectorScene, ZOOM, type PickMode } from './vector/VectorScene';
import { renderInspector } from './ui/inspector';
import { attachSearch } from './ui/search';
import { esc, fmtArea } from './ui/format';

const kindLabel = (k: Feature['kind']) => t(`kind_${k}` as Key);
setLang(getLang());
applyStatic();

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;

// Renderer ----------------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('#map');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();

const params = new URLSearchParams(location.hash.slice(1));
// Inside the farmer site (iframe) the site's own header carries the brand.
if (params.get('embed') === '1') document.body.classList.add('embedded');
// Opened on its own from the site: offer the way back. Only http(s) links are
// accepted, so a crafted link cannot turn the button into a script URL.
const backUrl = (() => {
  const b = params.get('back');
  try { return b && /^https?:$/.test(new URL(b).protocol) ? b : null; } catch { return null; }
})();
if (backUrl) {
  const a = document.createElement('a');
  a.className = 'back-to-site';
  a.href = backUrl;
  a.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg><span data-i18n="backToSite">${t('backToSite')}</span>`;
  document.querySelector('.topbar')!.prepend(a);
  document.querySelector<HTMLAnchorElement>('.brand')!.href = backUrl;
}
const terrain = new Terrain(renderer, BASEMAPS.find((b) => b.id === params.get('b')) ?? BASEMAPS[0]);
scene.add(terrain.group);
// The map is limited to Turkey (15 Nov): no tiles beyond this box, the camera
// stays inside it, and sky, fog and the masked outside share one paper colour so
// the edge of the box never shows.
const PAPER = '#e9e6dc';
const TR_BOX = { w: 25.2, e: 45.4, s: 35.4, n: 42.6 };
const regionA = lonLatToMerc(TR_BOX.w, TR_BOX.s), regionB = lonLatToMerc(TR_BOX.e, TR_BOX.n);
const REGION = { minX: regionA.x, minY: regionA.y, maxX: regionB.x, maxY: regionB.y };
terrain.region = REGION;
terrain.shared.uFogColor.value.set(PAPER);
terrain.shared.uOutside.value.set(PAPER);
const sky = createSky(terrain.shared.uFogColor.value, { zenith: '#c9d6de', space: PAPER });
scene.add(sky.mesh);

const vectors = new VectorScene();
const overlay = new OverlayManager(vectors, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
terrain.overlay = overlay;

const cam = new MapCamera(canvas, terrain);
{
  const a = mercToSceneXZ(REGION.minX, REGION.maxY), b = mercToSceneXZ(REGION.maxX, REGION.minY);
  cam.bounds = { minX: a.x, maxX: b.x, minZ: a.z, maxZ: b.z };
  cam.maxDistance = 2.4e6;
}

/** Rasterise the 81 provinces once into the Turkey mask the terrain shader reads. */
function buildTurkeyMask(provinces: Feature[]) {
  const W = 4096;
  const H = Math.round(W * (REGION.maxY - REGION.minY) / (REGION.maxX - REGION.minX));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const s = W / (REGION.maxX - REGION.minX);
  ctx.setTransform(s, 0, 0, -s, -REGION.minX * s, REGION.maxY * s);
  const p = new Path2D();
  for (const f of provinces) for (const poly of f.polys) for (const r of poly) {
    p.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
  }
  ctx.fillStyle = '#fff';
  ctx.fill(p, 'evenodd');
  // A hairline stroke closes the slivers between neighbouring province borders.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2 / s;
  ctx.stroke(p);
  terrain.setMask(c, REGION);
}
let dirty = 4;
const wake = (n = 3) => { dirty = Math.max(dirty, n); };
cam.onChange = () => wake();
scheduler.onLoad = () => wake(2);

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  cam.setSize(w, h);
  terrain.lodPx = 300 * Math.max(0.75, Math.min(1.25, h / 900));
  wake();
}
addEventListener('resize', resize);
resize();

// Data --------------------------------------------------------------------------
let mode: PickMode = 'auto';
let active: Feature | null = null;

const pilots = new Pilots();
pilots.onLoaded = () => { refreshInspector(); $('.mock-banner').hidden = !pilots.anyMock; };

Promise.all([loadProvinces(), loadIslands(), pilots.init().catch((e) => { console.warn('Arksus data', e); return []; })])
  .then(([provinces, islands, pilotFeatures]) => {
    vectors.setProvinces(provinces);
    buildTurkeyMask(provinces);
    vectors.setIslands(islands);
    vectors.setPilots(pilotFeatures);
    $('#island-count').textContent = `${islands.length} · OSM`;
    $('.mock-banner').hidden = !pilots.anyMock;
    buildPins();
    buildPlaces();
    overlay.invalidate(null);
    restoreSelectionFromHash();
    refreshInspector();
    wake();
    // Links from the site can ask for the 3D process right away: #s=pilot:<id>&d=<depth>&sim=1
    const d = params.get('d');
    if (d === 'shallow' || d === 'medium' || d === 'deep') { pilots.depth = d; refreshInspector(); }
    const simFor = active?.kind === 'pilot' ? active : null;
    if (params.get('sim') === '1' && simFor) openSim(simFor);
  });

vectors.fields.onData = (b) => { overlay.invalidate(b); wake(); };
vectors.fields.onStatus = () => { updateStatus(); wake(); };

// Initial view: deep link if present, otherwise come in from orbit.
const hashView = parseView();
if (hashView) {
  cam.flyTo(hashView.lon, hashView.lat, { distance: hashView.d, heading: hashView.h, pitch: hashView.p, duration: 0 });
} else {
  cam.flyTo(35.3, 39.0, { distance: 2.3e6, pitch: 0, heading: 0, duration: 0 });
  setTimeout(() => cam.flyTo(35.3, 38.4, { distance: 1.5e6, pitch: THREE.MathUtils.degToRad(40), heading: 0, duration: 2600 }), 700);
}

// Frame loop -------------------------------------------------------------------
let last = performance.now();
let bootDone = false;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const moving = cam.update(dt);
  if (!moving && dirty <= 0 && scheduler.pending === 0) return;
  dirty--;
  scheduler.frame++;

  const fogK = THREE.MathUtils.smoothstep(cam.pitch, 0.15, 1.0);
  terrain.shared.uFogDensity.value = fogK / (cam.distance * 6.5);
  terrain.update(cam.camera, canvas.clientHeight);
  sky.update(cam.camera, cam.distance);
  scheduler.pump();
  renderer.render(scene, cam.camera);

  if (scheduler.frame % 10 === 0) { maybeLoadFields(); updateStatus(); }
  // Close the splash once something is drawn and either loading has settled or a
  // few frames passed. Waiting on a frame count alone hung it: with cached tiles
  // the loop goes idle before reaching that count.
  if (!bootDone && terrain.rendered.length && (scheduler.frame > 20 || scheduler.pending === 0)) {
    bootDone = true;
    $('.boot').classList.add('done');
  }
  updateCompass();
  updatePins();
}
requestAnimationFrame(frame);

// Pilot pins: HTML buttons projected from the 3D point each rendered frame, so
// they stay crisp, keyboard-focusable and readable at any zoom.
type Pin = { el: HTMLButtonElement; f: Feature; pos: THREE.Vector3 };
let pins: Pin[] = [];
function buildPins() {
  const layer = $('.pins');
  layer.innerHTML = '';
  pins = vectors.pilotList.map((f) => {
    const el = document.createElement('button');
    el.className = 'pin';
    el.innerHTML = `<span class="pin-label">${esc(f.name)} <small>${esc(String(f.props.province))}</small></span><span class="pin-stem"></span><span class="pin-dot"></span>`;
    el.setAttribute('aria-label', t('pilotPin', { name: f.name, province: String(f.props.province) }));
    el.addEventListener('click', () => { select(f); cam.fitBBox(f.bbox, { pitch: THREE.MathUtils.degToRad(50), padding: 1.6 }); });
    layer.append(el);
    const c = polygonCentroid(f.polys);
    const sc = mercToSceneXZ(c.x, c.y);
    return { el, f, pos: new THREE.Vector3(sc.x, 0, sc.z) };
  });
  updatePins(true);
}
const projV = new THREE.Vector3();
function updatePins(force = false) {
  if (!pins.length || (!force && dirty < 0)) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const far = cam.zoom < 6.5;
  for (const p of pins) {
    p.pos.y = terrain.sceneHeight(p.pos.x, p.pos.z);
    projV.copy(p.pos).project(cam.camera);
    const visible = vectors.show.pilots && projV.z < 1 && Math.abs(projV.x) < 1.1 && Math.abs(projV.y) < 1.1;
    p.el.hidden = !visible;
    if (!visible) continue;
    p.el.style.transform = `translate(${((projV.x + 1) / 2) * w}px, ${((1 - projV.y) / 2) * h}px) translate(-50%, -100%)`;
    p.el.classList.toggle('far', far);
    p.el.setAttribute('aria-pressed', String(vectors.selected.has(p.f.id)));
  }
}

function maybeLoadFields() {
  const z = cam.zoom;
  const hint = $('.hint');
  if (vectors.show.fields && z >= ZOOM.fieldMin - 0.5) {
    // Request cells covering the detailed tiles near the camera, not the far horizon.
    const b: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const t of terrain.rendered) {
      if (t.z < ZOOM.fieldMin) continue;
      const tb = tileBox(t.z, t.x, t.y);
      b.minX = Math.min(b.minX, tb.minX); b.minY = Math.min(b.minY, tb.minY);
      b.maxX = Math.max(b.maxX, tb.maxX); b.maxY = Math.max(b.maxY, tb.maxY);
    }
    const c = sceneToMerc(cam.target.x, cam.target.z);
    if (isFinite(b.minX)) vectors.fields.want(b, c.x, c.y);
    hint.hidden = true;
  } else if (vectors.show.fields && z >= 10 && z < ZOOM.fieldMin - 0.5) {
    hint.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>${t('zoomForFields')}`;
    hint.hidden = false;
  } else hint.hidden = true;
}



// Picking & hover ---------------------------------------------------------------
const tooltip = $('.tooltip');
let hoverRaf = 0;
let lastPointer: PointerEvent | null = null;

canvas.addEventListener('pointermove', (e) => {
  lastPointer = e;
  if (drawing) return;
  if (e.buttons) { canvas.classList.add('dragging'); setHover(null); return; }
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; if (lastPointer) hoverAt(lastPointer); });
});
canvas.addEventListener('pointerleave', () => { setHover(null); $('#sb-lat').textContent = '–'; $('#sb-lon').textContent = '–'; $('#sb-elev').textContent = '–'; });
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (drawing) return;
  if (e.button !== 0 || cam.movedSincePointerDown > 5) return;
  const hit = cam.groundAt(e.clientX, e.clientY);
  if (!hit) return;
  const m = sceneToMerc(hit.x, hit.z);
  const f = vectors.pick(m.x, m.y, cam.zoom, mode);
  const additive = e.shiftKey || e.metaKey;
  // At parcel zoom a click also asks TKGM for the registered parcel at that
  // point, unless we already hold that parcel. The field (or whatever was under
  // the cursor) is selected at once so the click never feels dead.
  const wantParcel = vectors.show.parcels && f?.kind !== 'parcel'
    && (mode === 'parcel' || (mode === 'auto' && cam.zoom >= ZOOM.parcelMin));
  if (!(wantParcel && mode === 'parcel')) {
    if (additive) { if (f) toggleInSelection(f); } else select(f);
  }
  if (wantParcel) {
    const [lon, lat] = mercToLonLat(m.x, m.y);
    queryParcelAt(lat, lon, additive);
  }
});

let parcelSeq = 0;
async function queryParcelAt(lat: number, lon: number, additive: boolean) {
  const seq = ++parcelSeq;
  toast(t('queryingParcel'));
  try {
    const p = addParcel(await parcelAt(lat, lon));
    if (seq !== parcelSeq) return; // a newer click won
    if (additive) { if (!vectors.selected.has(p.id)) toggleInSelection(p); } else select(p);
    parcelSearch.prefill(p);
    hideToast();
  } catch (err) {
    if (seq !== parcelSeq) return;
    toast(err instanceof TkgmError && err.notFound ? t('noParcelHere') : t('psFail'));
  }
}

/** Keep one instance per parcel so selection and hover compare by identity. */
function addParcel(f: Feature): Feature {
  if (!vectors.parcels.add(f)) return vectors.parcels.all.get(f.id)!;
  overlay.invalidate(f.bbox);
  wake();
  return f;
}

const parcelSearch = attachParcelSearch({
  onFound: (found) => {
    const p = addParcel(found);
    select(p);
    cam.fitBBox(p.bbox, { pitch: THREE.MathUtils.degToRad(45), padding: 2.4 });
  },
  viewCenter: () => cam.center,
});

function hoverAt(e: PointerEvent) {
  const hit = cam.groundAt(e.clientX, e.clientY);
  if (!hit) { setHover(null); return; }
  const m = sceneToMerc(hit.x, hit.z);
  const [lon, lat] = mercToLonLat(m.x, m.y);
  $('#sb-lat').textContent = formatLat(lat);
  $('#sb-lon').textContent = formatLon(lon);
  $('#sb-elev').textContent = `${Math.round(terrain.heightM(m.x, m.y))} m`;
  const f = vectors.pick(m.x, m.y, cam.zoom, mode);
  setHover(f);
  if (f) {
    const a = fmtArea(f.areaM2);
    tooltip.innerHTML = `<span class="kind-chip"><i class="dot dot-${f.kind}"></i>${kindLabel(f.kind)}</span><b>${esc(f.name)}</b><small>${a.value} ${a.unit}</small>`;
    const r = canvas.getBoundingClientRect();
    tooltip.style.left = `${e.clientX - r.left}px`;
    tooltip.style.top = `${e.clientY - r.top}px`;
    tooltip.hidden = false;
  }
}

function setHover(f: Feature | null) {
  if (vectors.hovered?.id === f?.id) return;
  if (vectors.hovered) overlay.invalidate(vectors.hovered.bbox);
  vectors.hovered = f;
  if (f) overlay.invalidate(f.bbox);
  canvas.classList.toggle('hovering', !!f);
  if (!f) tooltip.hidden = true;
  wake();
}

// Selection -------------------------------------------------------------------
function select(f: Feature | null) {
  // A plain click replaces the selection list unless the item is already in it.
  if (f && vectors.selected.has(f.id)) { active = f; refreshInspector(); return; }
  for (const s of vectors.selected.values()) overlay.invalidate(s.bbox);
  vectors.selected.clear();
  active = f;
  if (f) { vectors.selected.set(f.id, f); overlay.invalidate(f.bbox); }
  refreshInspector();
  writeHash();
  wake();
}

function toggleInSelection(f: Feature) {
  if (vectors.selected.has(f.id)) {
    vectors.selected.delete(f.id);
    if (active?.id === f.id) active = [...vectors.selected.values()].at(-1) ?? null;
  } else {
    vectors.selected.set(f.id, f);
    active = f;
  }
  overlay.invalidate(f.bbox);
  refreshInspector();
  writeHash();
  wake();
}

function ancestors(f: Feature): Feature[] {
  const c = polygonCentroid(f.polys);
  const out: Feature[] = [];
  if (f.kind !== 'province' && f.kind !== 'pilot') {
    const p = vectors.provinces.at(c.x, c.y)[0];
    if (p) out.push(p);
  }
  if (f.kind === 'parcel' && f.parentId) {
    const field = vectors.fields.index.all.get(f.parentId);
    if (field) out.push(field);
  }
  if (f.kind === 'field' || f.kind === 'parcel') {
    const isl = vectors.islands.at(c.x, c.y)[0];
    if (isl) out.splice(1, 0, isl);
  }
  return out;
}

function elevationStats(f: Feature) {
  const b = f.bbox;
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  const N = 14;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = b.minX + ((b.maxX - b.minX) * (i + 0.5)) / (N + 1);
    const y = b.minY + ((b.maxY - b.minY) * (j + 0.5)) / (N + 1);
    if (!featureContains(f, x, y)) continue;
    const h = terrain.heightM(x, y);
    min = Math.min(min, h); max = Math.max(max, h); sum += h; n++;
  }
  if (!n) {
    const c = polygonCentroid(f.polys);
    const h = terrain.heightM(c.x, c.y);
    return { min: h, max: h, mean: h };
  }
  return { min, max, mean: sum / n };
}

const inspectorBody = $('.inspector-body');
function refreshInspector() {
  renderInspector(inspectorBody, {
    active,
    selection: [...vectors.selected.values()],
    ancestors,
    elevation: elevationStats,
    pilot: (f) => pilots.data(f),
    nearestPilot: (f) => {
      const c = polygonCentroid(f.polys);
      const [lon, lat] = mercToLonLat(c.x, c.y);
      return pilots.nearest(lon, lat);
    },
    pilotList: vectors.pilotList,
  }, {
    focus: (f) => cam.fitBBox(f.bbox, { pitch: Math.min(cam.pitch, 0.9) }),
    toggle: toggleInSelection,
    remove: (f) => toggleInSelection(f),
    clear: () => select(null),
    exportGeoJSON,
    copy: (text) => { navigator.clipboard?.writeText(text).then(() => toast(t('copied')), () => toast(t('copyFailed'))); },
    setDepth: (d) => { pilots.depth = d; refreshInspector(); },
    setScenario: (id) => { pilots.scenario = id; refreshInspector(); },
    setWeight: (k, v) => { pilots.setWeight(k, v); refreshInspector(); },
    resetWeights: () => { pilots.resetWeights(); refreshInspector(); },
    simulate: (f) => { openSim(f); },
    terrain: (f) => { openTerrainFor(f); },
    select: (f) => { active = f; if (!vectors.selected.has(f.id)) select(f); else refreshInspector(); },
  });
}
refreshInspector();

function exportGeoJSON(list: Feature[]) {
  const fc = {
    type: 'FeatureCollection',
    features: list.map((f) => ({
      type: 'Feature',
      id: f.id,
      properties: { tur: kindLabel(f.kind), ad: f.name, alan_m2: Math.round(f.areaM2), ...f.props },
      geometry: {
        type: 'MultiPolygon',
        coordinates: f.polys.map((p) => p.map((r) => {
          const ring: number[][] = [];
          for (let i = 0; i < r.length; i += 2) {
            const [lon, lat] = mercToLonLat(r[i], r[i + 1]);
            ring.push([+lon.toFixed(7), +lat.toFixed(7)]);
          }
          ring.push(ring[0]);
          return ring;
        })),
      },
    })),
  };
  const blob = new Blob([JSON.stringify(fc, null, 1)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = list.length === 1 ? `terrashift-${list[0].kind}-${slug(list[0].name)}.geojson` : `terrashift-secim-${list.length}.geojson`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(t('exported', { n: list.length }));
}
const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-|-$/g, '');

// UI wiring -------------------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>('.modes button').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode as PickMode;
  document.querySelectorAll('.modes button').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
  const need = { province: 0, pilot: 0, island: ZOOM.islandMin, field: ZOOM.fieldMin, parcel: ZOOM.parcelMin, auto: 0 }[mode];
  if (cam.zoom < need) toast(t('needZoom', { k: kindLabel(mode as Feature['kind']).toLocaleLowerCase(getLang()), z: need }));
  if (mode === 'pilot') setLayer('pilots', true);
  if (mode === 'parcel' || mode === 'field') { setLayer('fields', true); if (mode === 'parcel') setLayer('parcels', true); }
  if (mode === 'island') setLayer('islands', true);
  if (mode === 'province') setLayer('provinces', true);
}));

function setLayer(name: string, on: boolean) {
  const input = document.querySelector<HTMLInputElement>(`[data-layer="${name}"]`)!;
  input.checked = on;
  applyLayer(name, on);
}
function applyLayer(name: string, on: boolean) {
  if (name === 'labels') terrain.shared.uLabelsOn.value = on ? 1 : 0;
  else (vectors.show as Record<string, boolean>)[name] = on;
  overlay.invalidate(null);
  updateAttribution();
  wake();
}
document.querySelectorAll<HTMLInputElement>('[data-layer]').forEach((i) => i.addEventListener('change', () => applyLayer(i.dataset.layer!, i.checked)));

const exag = $<HTMLInputElement>('#exag');
exag.addEventListener('input', () => {
  terrain.shared.uExaggeration.value = +exag.value;
  $('#exag-out').textContent = `${(+exag.value).toLocaleString('tr-TR', { minimumFractionDigits: 1 })}×`;
  wake();
});

// Basemap cards with a live thumbnail of central Anatolia from each source.
const grid = $('.basemap-grid');
function buildBasemaps() {
grid.innerHTML = '';
for (const b of BASEMAPS) {
  const btn = document.createElement('button');
  btn.className = 'basemap';
  btn.setAttribute('aria-pressed', String(b.id === terrain.imagery.source.id));
  btn.innerHTML = `<img alt="" loading="lazy" crossorigin="anonymous" src="${b.url(7, 75, 48)}"><span>${b.label}</span><small>${getLang() === 'en' && b.noteEn ? b.noteEn : b.note}</small><em class="badge ${b.open ? '' : 'closed'}">${b.open ? t('open') : t('commercial')}</em>`;
  btn.addEventListener('click', () => {
    terrain.setBasemap(b);
    grid.querySelectorAll('.basemap').forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
    updateAttribution();
    writeHash();
    wake(10);
  });
  grid.append(btn);
}
$('.uses').innerHTML = Object.values(LANDUSE).map((u) => `<li><i class="dot" style="background:${u.color}"></i>${getLang() === 'tr' ? u.label : u.en}</li>`).join('');
}
buildBasemaps();

// On narrow screens the layer panel would cover most of the map; start it closed.
if (innerWidth < 860) $('.panel-head').setAttribute('aria-expanded', 'false');
$('.panel-head').addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
});

// Pilot districts come first; the rest are well-mapped farming plains and islands to explore.
const PLACES = [
  { name: 'Çukurova', sub: { tr: 'narenciye', en: 'citrus' }, lon: 35.32, lat: 36.92, d: 8000, p: 50 },
  { name: 'Harran', sub: { tr: 'pamuk', en: 'cotton' }, lon: 39.02, lat: 36.86, d: 9000, p: 52 },
  { name: 'Ergene', sub: { tr: 'Trakya', en: 'Thrace' }, lon: 26.92, lat: 41.33, d: 8000, p: 50 },
  { name: 'Gökçeada', sub: { tr: 'ada', en: 'island' }, lon: 25.86, lat: 40.17, d: 42000, p: 45 },
  { name: 'Bozcaada', sub: { tr: 'bağlar', en: 'vineyards' }, lon: 26.03, lat: 39.83, d: 14000, p: 50 },
];
const places = $('.places');
function buildPlaces() {
  places.innerHTML = '';
  for (const f of vectors.pilotList) {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'pilot';
    a.innerHTML = `${esc(f.name)} <small>${esc(t('kind_pilot').toLocaleLowerCase(getLang()))}</small>`;
    a.addEventListener('click', (e) => { e.preventDefault(); select(f); cam.fitBBox(f.bbox, { pitch: THREE.MathUtils.degToRad(50), padding: 1.6 }); });
    places.append(a);
  }
  for (const p of PLACES) {
    const a = document.createElement('a');
    a.href = '#';
    a.innerHTML = `${esc(p.name)} <small>${esc(p.sub[getLang()])}</small>`;
    a.addEventListener('click', (e) => { e.preventDefault(); cam.flyTo(p.lon, p.lat, { distance: p.d, pitch: THREE.MathUtils.degToRad(p.p), heading: 0 }); });
    places.append(a);
  }
}

function goHome() { cam.flyTo(35.2, 38.9, { distance: 1.45e6, pitch: THREE.MathUtils.degToRad(30), heading: 0 }); }
document.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  switch (el.dataset.action) {
    case 'zoom-in': cam.zoomBy(0.5, null, false); break;
    case 'zoom-out': cam.zoomBy(2, null, false); break;
    case 'north': cam.resetNorth(); break;
    case 'pitch': cam.togglePitch(); break;
    case 'home': goHome(); break;
    case 'draw-area': setDrawing(!drawing); break;
  }
  wake();
}));

attachSearch($<HTMLFormElement>('.search'), (hit) => {
  if (hit.bbox) {
    const a = lonLatToMerc(hit.bbox[2], hit.bbox[0]), b = lonLatToMerc(hit.bbox[3], hit.bbox[1]);
    cam.fitBBox({ minX: a.x, minY: a.y, maxX: b.x, maxY: b.y }, { pitch: THREE.MathUtils.degToRad(45), padding: 1.1 });
  } else cam.flyTo(hit.lon, hit.lat, { distance: 3000, pitch: THREE.MathUtils.degToRad(45) });
});

addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea, select')) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); $<HTMLInputElement>('#search-input').focus(); }
  else if (k === 'Escape') { if (drawing) setDrawing(false); else { parcelSearch.close(); select(null); } }
  else if (k === '+' || k === '=') cam.zoomBy(0.5, null, false);
  else if (k === '-' || k === '_') cam.zoomBy(2, null, false);
  else if (k === 'ArrowLeft') cam.nudge(-1, 0);
  else if (k === 'ArrowRight') cam.nudge(1, 0);
  else if (k === 'ArrowUp') cam.nudge(0, 1);
  else if (k === 'ArrowDown') cam.nudge(0, -1);
  else if (k === 'n' || k === 'N') cam.resetNorth();
  else if (k === 'p' || k === 'P') cam.togglePitch();
  else if (k === 'h' || k === 'H') goHome();
  else return;
  wake();
});

// Language ------------------------------------------------------------------------
function applyLang(l: Lang) {
  setLang(l);
  applyStatic();
  document.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  buildBasemaps();
  buildPlaces();
  buildPins();
  refreshInspector();
  updateStatus();
}
document.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang as Lang)));
document.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));

// Status ------------------------------------------------------------------------
const compass = $('.compass svg');
let lastHeading = NaN;
function updateCompass() {
  if (cam.heading === lastHeading) return;
  lastHeading = cam.heading;
  compass.setAttribute('style', `transform: rotate(${-cam.heading}rad)`);
  const tr = getLang() === 'tr';
  $('.pitch-btn').textContent = cam.pitch > 0.1 ? (tr ? '2B' : '2D') : (tr ? '3B' : '3D');
}

function updateStatus() {
  $('#sb-zoom').textContent = cam.zoom.toFixed(1);
  const tiles = scheduler.pending, fields = vectors.fields.loadingCount;
  const load = $('#sb-load');
  if (tiles || fields) {
    load.hidden = false;
    $('#sb-load-text').textContent = fields ? t('loadingFields', { n: fields }) : t('loadingTiles', { n: tiles });
  } else if (vectors.fields.lastError && cam.zoom >= ZOOM.fieldMin) {
    load.hidden = false;
    $('#sb-load-text').textContent = t('willRetry', { e: vectors.fields.lastError });
  } else load.hidden = true;
  if (scheduler.frame % 120 === 0) writeHash();
}

function updateAttribution() {
  const parts = [terrain.imagery.source.attribution, TERRAIN.attribution];
  if (terrain.shared.uLabelsOn.value) parts.push(LABELS.attribution);
  parts.push('Arksus: NASA POWER, SoilGrids 2.0', 'geoBoundaries (OSM, CC BY-SA)', '© OpenStreetMap (ODbL)');
  const el = $('#sb-attr');
  el.textContent = parts.join(' · ');
  el.title = parts.join('\n');
}
updateAttribution();

let toastTimer = 0;
function hideToast() { clearTimeout(toastTimer); $('.toast').hidden = true; }
function toast(msg: string) {
  const t = $('.toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 2600);
}

// Deep links: #lat,lon,distance,heading,pitch&b=basemap&s=selected ---------------------
function parseView() {
  const v = params.get('v');
  if (!v) return null;
  const [lat, lon, d, h, p] = v.split(',').map(Number);
  if ([lat, lon, d].some((n) => !isFinite(n))) return null;
  return { lat, lon, d, h: THREE.MathUtils.degToRad(h || 0), p: THREE.MathUtils.degToRad(p || 0) };
}
function writeHash() {
  const [lon, lat] = cam.center;
  const q = new URLSearchParams();
  q.set('v', [lat.toFixed(5), lon.toFixed(5), Math.round(cam.distance), Math.round(THREE.MathUtils.radToDeg(cam.heading)), Math.round(THREE.MathUtils.radToDeg(cam.pitch))].join(','));
  q.set('b', terrain.imagery.source.id);
  const staticSel = [...vectors.selected.values()].filter((f) => f.kind === 'province' || f.kind === 'island' || f.kind === 'pilot').map((f) => f.id);
  if (staticSel.length) q.set('s', staticSel.join(';'));
  // TKGM parcels are re-fetched by number on load, so a link opens the same parcel.
  const tk = [...vectors.selected.values()].filter((f) => f.id.startsWith('tkgm:')).map((f) => f.id.slice(5));
  if (tk.length) q.set('p', tk.slice(0, 5).join(';'));
  history.replaceState(null, '', `#${q.toString()}`);
}
function restoreSelectionFromHash() {
  const s = params.get('s');
  if (!s) return;
  for (const id of s.split(';')) {
    const f = vectors.provinces.all.get(id) ?? vectors.islands.all.get(id) ?? vectors.pilots.all.get(id);
    if (f) { vectors.selected.set(id, f); active = f; overlay.invalidate(f.bbox); }
  }
  refreshInspector();
  for (const ref of (params.get('p') ?? '').split(';').filter(Boolean)) {
    const m = ref.match(/^(\d+):(\d+)\/(\d+)$/);
    if (!m) continue;
    parcelByNumber(+m[1], m[2], m[3]).then((found) => {
      const p = addParcel(found);
      vectors.selected.set(p.id, p);
      active = p;
      overlay.invalidate(p.bbox);
      refreshInspector();
      writeHash();
    }).catch(() => toast(t('psNotFound')));
  }
}

// Process simulation -----------------------------------------------------------
// Field terrain & runoff ---------------------------------------------------------
let fieldView: FieldView | null = null;

/** Wettest week (weekly rain total) in the nearest district's ledger, for the rain preset. */
async function wettestWeekNear(lon: number, lat: number) {
  const near = pilots.nearest(lon, lat, 150);
  if (!near) return null;
  const ledger = await pilots.ledger(String(near.feature.props.location_id)).catch(() => null);
  if (!ledger) return null;
  let mm = 0;
  // Rain is the same for every rotation and depth; one series per start year is enough.
  for (const s of ledger.series) if (s.rotation_id === 'fallow_wheat' && s.depth_id === 'medium') for (const w of s.weeks) mm = Math.max(mm, w.p_mm);
  return mm > 0 ? { district: near.feature.name, mm } : null;
}

function openFieldView(name: string, bbox: BBox, polys: Feature['polys'] | null) {
  if (fieldView) return;
  const c = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
  const [lon, lat] = mercToLonLat(c.x, c.y);
  fieldView = new FieldView($('#app'), {
    name, bbox, polys, imagery: terrain.imagery.source, wettestWeek: wettestWeekNear(lon, lat),
  }, () => { fieldView = null; wake(); });
}

function openTerrainFor(f: Feature) {
  if (f.kind === 'pilot') {
    // The pilot circle is 20 km across, too coarse for field-scale terrain: take
    // a 2.4 km square around the district's point instead.
    const c = polygonCentroid(f.polys);
    const half = 1200 * mercScale(c.y);
    openFieldView(f.name, { minX: c.x - half, maxX: c.x + half, minY: c.y - half, maxY: c.y + half }, null);
    return;
  }
  const b = f.bbox;
  const k = mercScale((b.minY + b.maxY) / 2);
  // Pad around the outline so the slope leading into and out of the field shows; at least 300 m.
  const pad = Math.max((b.maxX - b.minX) * 0.15, (b.maxY - b.minY) * 0.15, 60 * k);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const hw = Math.max((b.maxX - b.minX) / 2 + pad, 150 * k), hh = Math.max((b.maxY - b.minY) / 2 + pad, 150 * k);
  openFieldView(f.name, { minX: cx - hw, maxX: cx + hw, minY: cy - hh, maxY: cy + hh }, f.polys);
}

// "Pick an area": drag a box on the map, as in field-drainage tools.
let drawing = false;
let drawStart: { x: number; y: number; ground: THREE.Vector3 } | null = null;
const drawBox = document.createElement('div');
drawBox.className = 'draw-box';
drawBox.hidden = true;
$('#app').append(drawBox);

function setDrawing(on: boolean) {
  drawing = on;
  cam.enabled = !on;
  drawStart = null;
  drawBox.hidden = true;
  canvas.classList.toggle('drawing', on);
  $('.draw-btn').setAttribute('aria-pressed', String(on));
  const hint = $('.hint');
  if (on) { hint.textContent = t('fvDrawHint'); hint.hidden = false; setHover(null); } else hint.hidden = true;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!drawing || e.button !== 0) return;
  const g = cam.groundAt(e.clientX, e.clientY);
  if (!g) return;
  canvas.setPointerCapture(e.pointerId);
  drawStart = { x: e.clientX, y: e.clientY, ground: g };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing || !drawStart) return;
  const r = canvas.getBoundingClientRect();
  Object.assign(drawBox.style, {
    left: `${Math.min(drawStart.x, e.clientX) - r.left}px`, top: `${Math.min(drawStart.y, e.clientY) - r.top}px`,
    width: `${Math.abs(e.clientX - drawStart.x)}px`, height: `${Math.abs(e.clientY - drawStart.y)}px`,
  });
  drawBox.hidden = false;
});
canvas.addEventListener('pointerup', (e) => {
  if (!drawing || !drawStart) return;
  const end = cam.groundAt(e.clientX, e.clientY);
  const start = drawStart.ground;
  drawStart = null;
  drawBox.hidden = true;
  if (!end) return;
  const a = sceneToMerc(start.x, start.z), b = sceneToMerc(end.x, end.z);
  const box = { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
  const k = mercScale((box.minY + box.maxY) / 2);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY) / k;
  if (span < 150) { toast(t('fvTooSmall')); return; }
  if (span > 6000) { toast(t('fvTooBig')); return; }
  setDrawing(false);
  openFieldView(t('fvDrawn'), box, null);
});

let sim: ProcessSim | null = null;
async function openSim(f: Feature) {
  if (sim || !pilots.site) return;
  const id = String(f.props.location_id);
  toast(t('simLoading'));
  try {
    const [ledger, results] = await Promise.all([pilots.ledger(id), pilots.baselineResults(id)]);
    hideToast();
    // The map keeps its state underneath; the simulation is a modal on top.
    sim = new ProcessSim($('#app'), {
      site: pilots.site, locationName: f.name, results, ledger, depth: pilots.depth,
      showBaselineNote: pilots.scenario !== 'baseline',
    }, () => { sim = null; wake(); });
  } catch (e) {
    console.warn('ledger', e);
    toast(t('simFailed'));
  }
}

// Exposed for debugging in the console.
Object.assign(window, { terrashift: { cam, terrain, vectors, overlay, pilots, mercScale } });
