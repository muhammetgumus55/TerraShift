// Field terrain & runoff view: one selected area as a 3D block (elevation +
// satellite), with elevation / slope colouring, contour lines, a profile, and a
// simple surface-runoff simulation where rain flows downhill, soaks in, ponds
// in hollows or leaves the area.
//
// Honest limits, also shown in the panel: elevation is SRTM-based (~30 m, the
// best open DEM for Turkey; there is no open LiDAR), so hollows smaller than a
// few tens of metres do not exist in it. The runoff model routes water between
// cells at Manning sheet-flow speed with a constant infiltration rate (see
// Runoff below) — an illustration of
// where water goes on this slope, not a hydrological forecast.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  WORLD, mercScale, mercToTile, pointInPolygon, tileBBox, type BBox, type Polygon,
} from '../geo';
import { TERRAIN, type RasterSource } from '../sources';
import { t } from '../strings';
import { fmtNum } from '../ui/format';

export type FieldViewInput = {
  name: string;
  bbox: BBox;                      // mercator metres
  polys: Polygon[] | null;         // field outline, if the area came from a feature
  imagery: RasterSource;
  /** Wettest week in the nearest Arksus district's ledger, for the rain preset. */
  wettestWeek: Promise<{ district: string; mm: number } | null>;
};

const GRID = 112;                  // cells along the longer side

// ---------------------------------------------------------------------------
// Data

async function bitmap(url: string, raw = false): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return raw ? createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : createImageBitmap(blob);
}

/** Elevation (m) on an nx × ny grid of cell centres over b, from z15 terrain tiles, bilinear. */
async function loadDem(b: BBox, nx: number, ny: number): Promise<Float32Array> {
  const z = TERRAIN.maxZoom;
  const [x0, y0] = mercToTile(z, b.minX, b.maxY);
  const [x1, y1] = mercToTile(z, b.maxX, b.minY);
  const tiles = new Map<string, Float32Array>();
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    jobs.push(bitmap(TERRAIN.url(z, x, y), true).then((bmp) => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const px = ctx.getImageData(0, 0, 256, 256).data;
      const d = new Float32Array(256 * 256);
      for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768;
      tiles.set(`${x}/${y}`, d);
    }));
  }
  await Promise.all(jobs);
  const size = WORLD / (1 << z);
  const at = (mx: number, my: number) => {
    const fx = (mx + WORLD / 2) / size, fy = (WORLD / 2 - my) / size;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const d = tiles.get(`${tx}/${ty}`);
    if (!d) return 0;
    const u = Math.min(255, Math.max(0, (fx - tx) * 256 - 0.5)), v = Math.min(255, Math.max(0, (fy - ty) * 256 - 0.5));
    const i0 = Math.floor(u), j0 = Math.floor(v), i1 = Math.min(255, i0 + 1), j1 = Math.min(255, j0 + 1);
    const a = u - i0, c = v - j0;
    return (d[j0 * 256 + i0] * (1 - a) + d[j0 * 256 + i1] * a) * (1 - c) + (d[j1 * 256 + i0] * (1 - a) + d[j1 * 256 + i1] * a) * c;
  };
  const out = new Float32Array(nx * ny);
  const dx = (b.maxX - b.minX) / nx, dy = (b.maxY - b.minY) / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    out[j * nx + i] = at(b.minX + (i + 0.5) * dx, b.maxY - (j + 0.5) * dy);
  }
  return out;
}

/** Satellite image of b stitched from tiles, about `px` wide. Row 0 is north. */
async function loadImagery(b: BBox, src: RasterSource, px = 1024): Promise<HTMLCanvasElement> {
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const z = Math.max(8, Math.min(src.maxZoom, Math.floor(Math.log2((WORLD * px) / (256 * w)))));
  const [x0, y0] = mercToTile(z, b.minX, b.maxY);
  const [x1, y1] = mercToTile(z, b.maxX, b.minY);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round(px * (h / w));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b7d63';
  ctx.fillRect(0, 0, c.width, c.height);
  const s = c.width / w;
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const tb = tileBBox(z, x, y);
    jobs.push(bitmap(src.url(z, x, y)).then((bmp) => {
      ctx.drawImage(bmp, (tb.minX - b.minX) * s, (b.maxY - tb.maxY) * s, (tb.maxX - tb.minX) * s, (tb.maxY - tb.minY) * s);
      bmp.close();
    }).catch(() => { /* a missing tile leaves the earth-tone fill */ }));
  }
  await Promise.all(jobs);
  return c;
}

// ---------------------------------------------------------------------------
// Runoff: cell-to-cell routing at Manning velocity on the DEM grid.
//
// A frictionless "virtual pipes" scheme was tried first: on a 5 % slope it moved
// water ~40 m/s and piled 30 cm into single cells within a minute. Here each
// wet cell sends water only to lower neighbours, at the sheet-flow speed
// Manning's equation gives for its depth and steepest slope (n = 0.05, a
// typical value for cultivated soil; an assumption), never more than would
// level the two heads. That keeps flows at realistic cm/s–m/s speeds and stays
// stable with steps of several seconds.

const MANNING_N = 0.05;

class Runoff {
  W: Float32Array;                 // water depth, m
  private dW: Float32Array;
  private Hout: Float32Array;      // ground level just outside each edge cell (extrapolated)
  rained = 0; infiltrated = 0; outflow = 0; // m³
  time = 0;                        // s

  constructor(readonly H: Float32Array, readonly nx: number, readonly ny: number, readonly l: number) {
    const n = nx * ny;
    this.W = new Float32Array(n);
    this.dW = new Float32Array(n);
    // Outside the box the slope continues as it was at the edge: water leaves
    // where the land falls away and is held where it rises.
    this.Hout = new Float32Array(n).fill(Infinity);
    const set = (c: number, inner: number) => { this.Hout[c] = Math.min(this.Hout[c], 2 * H[c] - H[inner]); };
    for (let i = 0; i < nx; i++) { set(i, i + nx); set((ny - 1) * nx + i, (ny - 2) * nx + i); }
    for (let j = 0; j < ny; j++) { set(j * nx, j * nx + 1); set(j * nx + nx - 1, j * nx + nx - 2); }
  }

  reset() {
    this.W.fill(0);
    this.rained = this.infiltrated = this.outflow = this.time = 0;
  }

  get stored() { let s = 0; for (const w of this.W) s += w; return s * this.l * this.l; }

  /** Advance dt seconds with a rain rate and an infiltration capacity, both in m/s. */
  step(dt: number, rain: number, infil: number) {
    const { H, W, dW, nx, ny, l, Hout } = this;
    const A = l * l;
    const n = nx * ny;
    // Rain in, infiltration out.
    for (let c = 0; c < n; c++) {
      const w = W[c] + rain * dt;
      const soak = Math.min(w, infil * dt);
      this.infiltrated += soak * A;
      W[c] = w - soak;
    }
    this.rained += rain * dt * n * A;
    dW.fill(0);
    let out = 0;
    const nb = [0, 0, 0, 0], drop = [0, 0, 0, 0];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const w = W[c];
      if (w < 1e-5) continue;
      const h = H[c] + w;
      nb[0] = i > 0 ? c - 1 : -1; nb[1] = i < nx - 1 ? c + 1 : -1;
      nb[2] = j > 0 ? c - nx : -1; nb[3] = j < ny - 1 ? c + nx : -1;
      let total = 0, steepest = 0;
      for (let k = 0; k < 4; k++) {
        const hn = nb[k] >= 0 ? H[nb[k]] + W[nb[k]] : Hout[c];
        const d = h - hn;
        drop[k] = d > 0 ? d : 0;
        total += drop[k];
        if (drop[k] > steepest) steepest = drop[k];
      }
      if (total <= 0) continue;
      // Manning sheet-flow velocity, then the share of the cell's water that
      // crosses a cell width this step (capped so the scheme stays stable).
      const v = (Math.pow(w, 2 / 3) * Math.sqrt(steepest / l)) / MANNING_N;
      const frac = Math.min(0.5, (v * dt) / l);
      // Never move more than would bring this cell level with its lowest neighbour.
      const move = Math.min(w * frac, steepest / 2);
      dW[c] -= move;
      for (let k = 0; k < 4; k++) {
        if (!drop[k]) continue;
        const part = (move * drop[k]) / total;
        if (nb[k] >= 0) dW[nb[k]] += part; else out += part * A;
      }
    }
    for (let c = 0; c < n; c++) W[c] = Math.max(0, W[c] + dW[c]);
    this.outflow += out;
    this.time += dt;
  }
}

// ---------------------------------------------------------------------------
// Rendering

const terrainVertex = /* glsl */ `
attribute float elev;
attribute float slope;
varying vec2 vUv;
varying float vElev;
varying float vSlope;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vElev = elev;
  vSlope = slope;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const terrainFragment = /* glsl */ `
uniform sampler2D map;
uniform sampler2D mask;
uniform int mode;
uniform float hMin, hMax, contour, contourOn;
uniform vec3 sunDir;
varying vec2 vUv;
varying float vElev;
varying float vSlope;
varying vec3 vNormal;

// Viridis (perceptually uniform, readable with colour-vision deficiencies).
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777, 0.0054, 0.3341), c1 = vec3(0.1050, 1.4046, 1.3846), c2 = vec3(-0.3309, 0.2148, 0.0951);
  const vec3 c3 = vec3(-4.6342, -5.7991, -19.3324), c4 = vec3(6.2283, 14.1799, 56.6906), c5 = vec3(4.7764, -13.7451, -65.3530);
  const vec3 c6 = vec3(-5.4355, 4.6459, 26.3124);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}
void main() {
  vec3 base = texture2D(map, vUv).rgb;
  if (mode == 1) base = viridis(clamp((vElev - hMin) / max(0.01, hMax - hMin), 0.0, 1.0));
  if (mode == 2) {
    // Slope classes in %: flat → gentle → moderate → steep, one warm hue ramp.
    float s = vSlope;
    base = s < 2.0 ? vec3(0.93, 0.92, 0.84) : s < 5.0 ? vec3(0.95, 0.80, 0.52) : s < 10.0 ? vec3(0.88, 0.55, 0.25) : vec3(0.62, 0.25, 0.12);
  }
  float diff = max(dot(normalize(vNormal), normalize(sunDir)), 0.0);
  vec3 col = base * (0.55 + 0.6 * diff);
  if (contourOn > 0.5) {
    float c = vElev / contour;
    float f = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), 1e-4);
    col = mix(col, vec3(1.0), (1.0 - min(f, 1.0)) * 0.55);
  }
  vec4 m = texture2D(mask, vUv);
  float inside = m.g;
  float outline = m.r * (1.0 - m.g);
  col = mix(mix(col, vec3(dot(col, vec3(0.33))), 0.6) * 0.75 + 0.12, col, inside);
  col = mix(col, vec3(0.98, 0.78, 0.18), outline);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const waterVertex = /* glsl */ `
attribute float depth;
varying float vDepth;
varying vec3 vView;
varying vec3 vNormal;
void main() {
  vDepth = depth;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  // Water lies nearly flat; an up normal avoids recomputing normals every frame.
  vNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * mv;
}`;

const waterFragment = /* glsl */ `
varying float vDepth;
varying vec3 vView;
varying vec3 vNormal;
uniform vec3 sunDir;
void main() {
  if (vDepth < 0.004) discard;
  float d = clamp(vDepth / 0.25, 0.0, 1.0);
  vec3 col = mix(vec3(0.55, 0.85, 0.98), vec3(0.08, 0.32, 0.72), d);
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float spec = pow(max(dot(reflect(-normalize(sunDir), n), v), 0.0), 40.0);
  col = mix(col, vec3(0.9, 0.96, 1.0), fres * 0.5) + spec * 0.6;
  gl_FragColor = vec4(col, smoothstep(0.004, 0.03, vDepth) * (0.55 + 0.4 * d));
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------------------

export class FieldView {
  private root: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 1, 50000);
  private controls: OrbitControls;
  private raf = 0;
  private ro: ResizeObserver;
  private nx = 0; private ny = 0;
  private H: Float32Array = new Float32Array(0);
  private hMin = 0; private hMax = 1;
  private cell = 1;                // ground metres per cell
  private inside = new Uint8Array(0);
  private exag = 3;
  private terrainGeo: THREE.BufferGeometry | null = null;
  private waterGeo: THREE.BufferGeometry | null = null;
  private sides: THREE.Mesh | null = null;
  private terrainMat: THREE.ShaderMaterial | null = null;
  private runoff: Runoff | null = null;
  private running = false;
  private rainMm = 40;
  private infilMmH = 8;
  private readonly RAIN_HOURS = 1;
  private sun = new THREE.Vector3(-0.5, 0.8, 0.4).normalize();
  private textures: THREE.Texture[] = [];
  private span = 0;

  constructor(host: HTMLElement, private readonly input: FieldViewInput, private readonly onClose: () => void) {
    this.root = document.createElement('section');
    this.root.className = 'sim fv';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'fv-title');
    this.root.innerHTML = this.chrome();
    host.append(this.root);

    const canvas = this.root.querySelector<HTMLCanvasElement>('canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A plain studio backdrop, as in field-drainage tools: nothing competes with the block.
    this.scene.background = new THREE.Color('#e7e5df');
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;

    this.wire();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
    this.root.querySelector<HTMLButtonElement>('.sim-close')!.focus();
    this.load().catch((e) => {
      console.warn('field view', e);
      this.q('.fv-status').textContent = t('fvFailed');
    });
    input.wettestWeek.then((w) => {
      if (!w) return;
      const btn = this.q<HTMLButtonElement>('.fv-preset');
      btn.hidden = false;
      btn.textContent = t('fvPreset', { mm: fmtNum(w.mm, 0), district: w.district });
      btn.onclick = () => this.setRain(Math.round(w.mm));
    });
  }

  private q<T extends HTMLElement = HTMLElement>(s: string) { return this.root.querySelector(s) as T; }

  private chrome() {
    return `
      <div class="sim-panel fv-panel">
        <header class="sim-head">
          <div>
            <h2 id="fv-title">${t('fvTitle', { name: this.input.name })}</h2>
            <p>${t('fvSub')}</p>
          </div>
          <button class="sim-close" aria-label="${t('simClose')}"><svg class="icon"><use href="#i-x"/></svg></button>
        </header>
        <div class="sim-stage">
          <canvas aria-label="${t('fvTitle', { name: this.input.name })}"></canvas>
          <p class="fv-status" role="status">${t('fvLoading')}</p>
          <aside class="fv-side" aria-label="${t('fvControls')}">
            <section>
              <h3>${t('fvStats')}</h3>
              <dl class="fv-stats"></dl>
            </section>
            <section>
              <h3>${t('fvView')}</h3>
              <div class="seg fv-mode" role="group" aria-label="${t('fvView')}">
                <button data-mode="0" aria-pressed="true">${t('fvSat')}</button>
                <button data-mode="1" aria-pressed="false">${t('fvElev')}</button>
                <button data-mode="2" aria-pressed="false">${t('fvSlope')}</button>
              </div>
              <div class="fv-legend"></div>
              <label class="fv-check"><input type="checkbox" class="fv-contours" checked> ${t('fvContours')} <span class="fv-ci"></span></label>
              <label class="fv-range">${t('fvExag')} <output class="fv-exag-out">3×</output>
                <input type="range" class="fv-exag" min="1" max="10" step="0.5" value="3"></label>
              <label class="fv-range">${t('fvSun')}
                <input type="range" class="fv-sun" min="0" max="360" step="5" value="225"></label>
            </section>
            <section>
              <h3>${t('fvWater')}</h3>
              <label class="fv-range">${t('fvRain')} <output class="fv-rain-out">40 mm</output>
                <input type="range" class="fv-rain" min="5" max="120" step="5" value="40"></label>
              <button class="btn fv-preset" hidden></button>
              <label class="fv-range">${t('fvInfil')} <output class="fv-infil-out">8 ${t('mmPerHour')}</output>
                <input type="range" class="fv-infil" min="0" max="40" step="1" value="8"></label>
              <div class="fv-buttons">
                <button class="btn primary fv-run" disabled>▶ ${t('fvStart')}</button>
                <button class="btn fv-reset" disabled>${t('fvReset')}</button>
              </div>
              <dl class="fv-results"></dl>
            </section>
            <p class="fv-note">${t('fvNote')}</p>
          </aside>
          <figure class="fv-profile" aria-label="${t('fvProfile')}">
            <figcaption>${t('fvProfile')}</figcaption>
            <canvas width="300" height="96"></canvas>
          </figure>
        </div>
      </div>`;
  }

  private wire() {
    this.q('.sim-close').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } });
    this.root.querySelectorAll<HTMLButtonElement>('.fv-mode button').forEach((b) => b.addEventListener('click', () => {
      this.root.querySelectorAll('.fv-mode button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      if (this.terrainMat) this.terrainMat.uniforms.mode.value = +b.dataset.mode!;
      this.legend(+b.dataset.mode!);
    }));
    this.q<HTMLInputElement>('.fv-contours').addEventListener('change', (e) => {
      if (this.terrainMat) this.terrainMat.uniforms.contourOn.value = (e.target as HTMLInputElement).checked ? 1 : 0;
    });
    this.q<HTMLInputElement>('.fv-exag').addEventListener('input', (e) => {
      this.exag = +(e.target as HTMLInputElement).value;
      this.q('.fv-exag-out').textContent = `${this.exag}×`;
      this.applyHeights();
    });
    this.q<HTMLInputElement>('.fv-sun').addEventListener('input', (e) => {
      const a = THREE.MathUtils.degToRad(+(e.target as HTMLInputElement).value);
      this.sun.set(Math.sin(a), 0.75, Math.cos(a)).normalize();
    });
    this.q<HTMLInputElement>('.fv-rain').addEventListener('input', (e) => this.setRain(+(e.target as HTMLInputElement).value));
    this.q<HTMLInputElement>('.fv-infil').addEventListener('input', (e) => {
      this.infilMmH = +(e.target as HTMLInputElement).value;
      this.q('.fv-infil-out').textContent = `${this.infilMmH} ${t('mmPerHour')}`;
    });
    this.q('.fv-run').addEventListener('click', () => {
      if (!this.runoff) return;
      if (!this.running && this.runoff.time >= this.RAIN_HOURS * 3600 * 2) this.runoff.reset();
      this.running = !this.running;
      this.runLabel();
    });
    this.q('.fv-reset').addEventListener('click', () => { this.runoff?.reset(); this.running = false; this.runLabel(); this.updateWater(); this.results(); });
  }

  private setRain(mm: number) {
    this.rainMm = Math.max(5, Math.min(300, mm));
    const r = this.q<HTMLInputElement>('.fv-rain');
    if (mm > +r.max) r.max = String(Math.ceil(mm / 10) * 10);
    r.value = String(this.rainMm);
    this.q('.fv-rain-out').textContent = `${fmtNum(this.rainMm, 0)} mm`;
  }

  private runLabel() {
    this.q('.fv-run').textContent = this.running ? `❚❚ ${t('fvPause')}` : `▶ ${t('fvStart')}`;
  }

  // -------------------------------------------------------------------------

  private async load() {
    const b = this.input.bbox;
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    this.nx = w >= h ? GRID : Math.max(16, Math.round(GRID * (w / h)));
    this.ny = w >= h ? Math.max(16, Math.round(GRID * (h / w))) : GRID;
    const k = mercScale((b.minY + b.maxY) / 2);
    this.cell = w / this.nx / k;
    const [H, img] = await Promise.all([loadDem(b, this.nx, this.ny), loadImagery(b, this.input.imagery)]);
    this.H = H;
    this.hMin = Infinity; this.hMax = -Infinity;
    for (const v of H) { this.hMin = Math.min(this.hMin, v); this.hMax = Math.max(this.hMax, v); }

    // Which cells lie inside the field outline (for the stats); all of them for a drawn box.
    this.inside = new Uint8Array(this.nx * this.ny);
    const polys = this.input.polys;
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const mx = b.minX + ((i + 0.5) / this.nx) * w, my = b.maxY - ((j + 0.5) / this.ny) * h;
      this.inside[j * this.nx + i] = !polys || polys.some((p) => pointInPolygon(mx, my, p)) ? 1 : 0;
    }

    this.build(img);
    this.stats();
    this.profile();
    this.legend(0);
    this.runoff = new Runoff(this.H, this.nx, this.ny, this.cell);
    this.q('.fv-status').hidden = true;
    this.q<HTMLButtonElement>('.fv-run').disabled = false;
    this.q<HTMLButtonElement>('.fv-reset').disabled = false;
    this.results();
  }

  private maskCanvas(width: number, height: number) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d')!;
    const b = this.input.bbox;
    if (!this.input.polys) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      return c;
    }
    const s = width / (b.maxX - b.minX);
    ctx.setTransform(s, 0, 0, -s, -b.minX * s, b.maxY * s);
    const p = new Path2D();
    for (const poly of this.input.polys) for (const r of poly) {
      p.moveTo(r[0], r[1]);
      for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
      p.closePath();
    }
    ctx.fillStyle = '#fff';
    ctx.fill(p, 'evenodd');
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 4 / s;
    ctx.stroke(p);
    return c;
  }

  private build(img: HTMLCanvasElement) {
    const { nx, ny } = this;
    const W = nx * this.cell, D = ny * this.cell;
    const geo = new THREE.PlaneGeometry(W, D, nx - 1, ny - 1);
    geo.rotateX(-Math.PI / 2);
    const elev = new Float32Array(nx * ny);
    elev.set(this.H);
    geo.setAttribute('elev', new THREE.BufferAttribute(elev, 1));
    geo.setAttribute('slope', new THREE.BufferAttribute(this.slopes(), 1));
    this.terrainGeo = geo;

    const map = new THREE.CanvasTexture(img);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const mask = new THREE.CanvasTexture(this.maskCanvas(img.width, img.height));
    this.textures.push(map, mask);
    const relief = Math.max(1, this.hMax - this.hMin);
    // Contour step that gives roughly 8–15 lines over the area's relief.
    const steps = [0.5, 1, 2, 5, 10, 20, 50];
    const ci = steps.find((s) => relief / s <= 15) ?? 100;
    this.q('.fv-ci').textContent = `(${fmtNum(ci, ci < 1 ? 1 : 0)} m)`;
    this.terrainMat = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        map: { value: map }, mask: { value: mask }, mode: { value: 0 },
        hMin: { value: this.hMin }, hMax: { value: this.hMax }, contour: { value: ci }, contourOn: { value: 1 },
        sunDir: { value: this.sun },
      },
    });
    this.scene.add(new THREE.Mesh(geo, this.terrainMat));

    const wgeo = new THREE.PlaneGeometry(W, D, nx - 1, ny - 1);
    wgeo.rotateX(-Math.PI / 2);
    wgeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(nx * ny), 1));
    this.waterGeo = wgeo;
    const wmat = new THREE.ShaderMaterial({
      vertexShader: waterVertex, fragmentShader: waterFragment, transparent: true, depthWrite: false,
      uniforms: { sunDir: { value: this.sun } },
    });
    this.scene.add(new THREE.Mesh(wgeo, wmat));

    this.applyHeights();

    // Frame the block: look from the south-east, a bit above, whole area in view.
    const span = Math.max(W, D);
    this.camera.near = span / 500;
    this.camera.far = span * 20;
    this.camera.updateProjectionMatrix();
    this.span = span;
    this.controls.target.set(0, 0, 0);
    this.fitCamera();
    this.controls.minDistance = span * 0.2;
    this.controls.maxDistance = span * 4;
  }

  /** True slope in % per cell, from central differences on the unexaggerated DEM. */
  private slopes(): Float32Array {
    const { nx, ny, H, cell } = this;
    const out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const dx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / ((Math.min(nx - 1, i + 1) - Math.max(0, i - 1)) * cell);
      const dz = (H[Math.min(ny - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / ((Math.min(ny - 1, j + 1) - Math.max(0, j - 1)) * cell);
      out[c] = Math.hypot(dx, dz) * 100;
    }
    return out;
  }

  /** Vertex heights for the current exaggeration, plus the soil walls under the block. */
  private applyHeights() {
    if (!this.terrainGeo) return;
    const pos = this.terrainGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.H.length; i++) pos.setY(i, (this.H[i] - this.hMin) * this.exag);
    pos.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();
    this.terrainGeo.computeBoundingSphere();
    this.buildSides();
    this.updateWater();
  }

  private buildSides() {
    const { nx, ny } = this;
    const pos = this.terrainGeo!.getAttribute('position') as THREE.BufferAttribute;
    const base = -Math.max(6, (this.hMax - this.hMin) * this.exag * 0.35 + 4);
    const verts: number[] = [];
    const edge = (idx: number[]) => {
      for (let k = 0; k < idx.length - 1; k++) {
        const a = idx[k], b = idx[k + 1];
        const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a), bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
        verts.push(ax, ay, az, bx, by, bz, ax, base, az, bx, by, bz, bx, base, bz, ax, base, az);
      }
    };
    const row = (j: number) => Array.from({ length: nx }, (_, i) => j * nx + i);
    const col = (i: number) => Array.from({ length: ny }, (_, j) => j * nx + i);
    edge(row(0)); edge(row(ny - 1).reverse()); edge(col(0).reverse()); edge(col(nx - 1));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    if (this.sides) { this.scene.remove(this.sides); this.sides.geometry.dispose(); }
    this.sides = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#7a5a3c', side: THREE.DoubleSide }));
    this.scene.add(this.sides);
    if (!this.scene.children.some((o) => o instanceof THREE.HemisphereLight)) {
      this.scene.add(new THREE.HemisphereLight('#fffaf0', '#6b5a44', 2.2));
    }
  }

  private updateWater() {
    if (!this.waterGeo || !this.runoff) return;
    const pos = this.waterGeo.getAttribute('position') as THREE.BufferAttribute;
    const depth = this.waterGeo.getAttribute('depth') as THREE.BufferAttribute;
    const W = this.runoff.W;
    for (let i = 0; i < W.length; i++) {
      // Lift the surface a hair above ground so thin films still show over the terrain.
      pos.setY(i, (this.H[i] - this.hMin + W[i]) * this.exag + 0.05);
      depth.setX(i, W[i]);
    }
    pos.needsUpdate = true;
    depth.needsUpdate = true;
  }

  // -------------------------------------------------------------------------
  // Panel

  private stats() {
    let n = 0, sum = 0, sMean = 0, sMax = 0, lo = Infinity, hi = -Infinity;
    const slope = this.terrainGeo!.getAttribute('slope') as THREE.BufferAttribute;
    for (let i = 0; i < this.H.length; i++) {
      if (!this.inside[i]) continue;
      n++; sum += this.H[i];
      lo = Math.min(lo, this.H[i]); hi = Math.max(hi, this.H[i]);
      const s = slope.getX(i); sMean += s; sMax = Math.max(sMax, s);
    }
    const area = n * this.cell * this.cell;
    const rows: [string, string][] = [
      [t('area'), area >= 1e4 ? `${fmtNum(area / 1e4, 1)} ha · ${fmtNum(area / 1000, 0)} ${t('donumUnit')}` : `${fmtNum(area, 0)} m²`],
      [t('fvMean'), `${fmtNum(sum / Math.max(1, n), 0)} m`],
      [t('fvRelief'), `${fmtNum(hi - lo, 1)} m`],
      [t('fvSlopeMean'), `%${fmtNum(sMean / Math.max(1, n), 1)}`],
      [t('fvSlopeMax'), `%${fmtNum(sMax, 1)}`],
      [t('fvCell'), `${fmtNum(this.cell, 1)} m · ${this.nx}×${this.ny}`],
    ];
    this.q('.fv-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  private legend(mode: number) {
    const el = this.q('.fv-legend');
    if (mode === 1) {
      el.innerHTML = `<span class="fv-ramp"></span><span class="fv-ends"><span>${fmtNum(this.hMin, 0)} m</span><span>${fmtNum(this.hMax, 0)} m</span></span>`;
    } else if (mode === 2) {
      el.innerHTML = [['#edebd6', '< %2'], ['#f2cc85', '%2–5'], ['#e08c40', '%5–10'], ['#9e401f', '> %10']]
        .map(([c, l]) => `<span class="fv-chip"><i style="background:${c}"></i>${l}</span>`).join('');
    } else el.innerHTML = '';
  }

  private profile() {
    const c = this.q<HTMLCanvasElement>('.fv-profile canvas');
    const ctx = c.getContext('2d')!;
    const { nx, ny, H } = this;
    // Along the longer side, through the middle.
    const along = nx >= ny;
    const n = along ? nx : ny;
    const vals = Array.from({ length: n }, (_, k) => (along ? H[Math.floor(ny / 2) * nx + k] : H[k * nx + Math.floor(nx / 2)]));
    const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(0.5, hi - lo);
    const W = c.width, Hh = c.height, pad = 6;
    ctx.clearRect(0, 0, W, Hh);
    ctx.beginPath();
    vals.forEach((v, k) => {
      const x = pad + (k / (n - 1)) * (W - 2 * pad);
      const y = Hh - 18 - ((v - lo) / span) * (Hh - 32);
      if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = '#2f5d46';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(W - pad, Hh - 18); ctx.lineTo(pad, Hh - 18); ctx.closePath();
    ctx.fillStyle = 'rgba(47,93,70,0.12)';
    ctx.fill();
    ctx.fillStyle = '#56645b';
    ctx.font = '11px "Fira Code", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtNum(hi, 0)} m`, W - pad, 11);
    ctx.textAlign = 'left';
    ctx.fillText(`${fmtNum(lo, 0)} m · ${fmtNum(n * this.cell, 0)} m`, pad, Hh - 4);
  }

  private results() {
    const r = this.runoff;
    if (!r) return;
    let wet = 0, cells = 0, maxD = 0;
    for (let i = 0; i < r.W.length; i++) {
      if (!this.inside[i]) continue;
      cells++;
      if (r.W[i] > 0.02) wet++;
      maxD = Math.max(maxD, r.W[i]);
    }
    const rained = Math.max(1e-9, r.rained);
    const pct = (v: number) => `%${fmtNum((100 * v) / rained, 0)}`;
    const mins = Math.floor(r.time / 60);
    this.q('.fv-results').innerHTML = [
      [t('fvTime'), `${Math.floor(mins / 60)} ${t('hourShort')} ${mins % 60} ${t('minShort')}`],
      [t('fvPonded'), `%${fmtNum((100 * wet) / Math.max(1, cells), 0)}`],
      [t('fvMaxDepth'), `${fmtNum(maxD * 100, 0)} cm`],
      [t('fvSoaked'), r.rained ? pct(r.infiltrated) : '–'],
      [t('fvLeft'), r.rained ? pct(r.outflow) : '–'],
      [t('fvSurface'), r.rained ? pct(r.stored) : '–'],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  // -------------------------------------------------------------------------

  private lastFrame = performance.now();
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.running && this.runoff) {
      const total = this.RAIN_HOURS * 3600;
      const rate = this.rainMm / 1000 / total;        // m/s while it rains
      const infil = this.infilMmH / 1000 / 3600;
      // Tied to the clock, not to frames: 1 real second = 30 simulated minutes, so
      // two hours play in ~4 s on a fast laptop and on a phone alike (a busy page
      // behind the view used to slow it to a crawl). At most 40 steps per frame.
      const steps = Math.min(40, Math.max(1, Math.round((realDt * 1800) / 10)));
      for (let k = 0; k < steps; k++) this.runoff.step(10, this.runoff.time < total ? rate : 0, infil);
      this.updateWater();
      this.results();
      // Stop an hour after the rain ends; by then the field has mostly drained or ponded.
      if (this.runoff.time >= total * 2) { this.running = false; this.runLabel(); }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // On wide screens the controls panel covers the left ~290 px; shift the
    // picture's centre right by half of that so the block sits in the free area.
    // On phones the panel covers the lower part instead: lift the picture into the upper half.
    if (w > 760) this.camera.setViewOffset(w, h, -145, 0, w, h); else this.camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  /** Whole block in view from the south-east; pulls back on portrait screens. */
  private fitCamera() {
    if (!this.span) return;
    const dir = new THREE.Vector3(0.75, 0.8, 1.15).normalize();
    // Narrower than tall: the block's width is what must fit, so pull back further.
    const dist = (this.span * 1.6) / Math.min(1, this.camera.aspect * (this.camera.aspect < 1 ? 0.75 : 1.15));
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.controls.maxDistance = Math.max(this.span * 4, dist * 1.5);
  }

  close() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | undefined;
      mat?.dispose?.();
    });
    for (const tex of this.textures) tex.dispose();
    this.renderer.dispose();
    this.root.remove();
    this.onClose();
  }
}
