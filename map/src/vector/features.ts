import {
  bboxIntersects, lonLatToMerc, mercScale, pointInPolygon, polygonAreaM2, ringBBox,
  type BBox, type Polygon,
} from '../geo';

export type FeatureKind = 'pilot' | 'province' | 'island' | 'field' | 'parcel';

export type Feature = {
  id: string;
  kind: FeatureKind;
  name: string;
  polys: Polygon[];
  bbox: BBox;
  areaM2: number;
  props: Record<string, string | number | null>;
  parentId?: string;
};

export function makeFeature(f: Omit<Feature, 'bbox' | 'areaM2'> & { areaM2?: number }): Feature {
  const bbox: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of f.polys) ringBBox(p[0], bbox);
  return { ...f, bbox, areaM2: f.areaM2 ?? polygonAreaM2(f.polys) };
}

export function featureContains(f: Feature, x: number, y: number): boolean {
  if (x < f.bbox.minX || x > f.bbox.maxX || y < f.bbox.minY || y > f.bbox.maxY) return false;
  return f.polys.some((p) => pointInPolygon(x, y, p));
}

/** A bucket grid over feature bboxes: enough for a few thousand polygons. */
export class FeatureIndex {
  private cells = new Map<string, Feature[]>();
  readonly all = new Map<string, Feature>();
  constructor(private readonly cell: number) {}

  add(f: Feature) {
    if (this.all.has(f.id)) return false;
    this.all.set(f.id, f);
    this.forCells(f.bbox, (k) => {
      let c = this.cells.get(k);
      if (!c) this.cells.set(k, (c = []));
      c.push(f);
    });
    return true;
  }

  query(b: BBox): Feature[] {
    const seen = new Set<Feature>();
    this.forCells(b, (k) => {
      const c = this.cells.get(k);
      if (c) for (const f of c) if (bboxIntersects(f.bbox, b)) seen.add(f);
    });
    return [...seen];
  }

  at(x: number, y: number): Feature[] {
    const c = this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`);
    return c ? c.filter((f) => featureContains(f, x, y)) : [];
  }

  private forCells(b: BBox, fn: (k: string) => void) {
    const x0 = Math.floor(b.minX / this.cell), x1 = Math.floor(b.maxX / this.cell);
    const y0 = Math.floor(b.minY / this.cell), y1 = Math.floor(b.maxY / this.cell);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) {
      // Giant feature (a province at a fine grid): register in a capped band.
      for (let x = x0; x <= x1; x += Math.ceil((x1 - x0 + 1) / 64)) for (let y = y0; y <= y1; y += Math.ceil((y1 - y0 + 1) / 64)) fn(`${x},${y}`);
      return;
    }
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) fn(`${x},${y}`);
  }
}

// Static layers ------------------------------------------------------------

const toMercRings = (polys: number[][][]): Polygon[] =>
  polys.map((p) => p.map((r) => {
    const out = new Float64Array(r.length);
    for (let i = 0; i < r.length; i += 2) {
      const m = lonLatToMerc(r[i], r[i + 1]);
      out[i] = m.x; out[i + 1] = m.y;
    }
    return out;
  }));

export async function loadProvinces(): Promise<Feature[]> {
  const rows = (await (await fetch(`${import.meta.env.BASE_URL}data/provinces.json`)).json()) as {
    name: string; iso: string; areaKm2: number; polys: number[][][];
  }[];
  return rows.map((r) => makeFeature({
    id: `il:${r.iso}`,
    kind: 'province',
    name: r.name,
    polys: toMercRings(r.polys as unknown as number[][][]),
    areaM2: r.areaKm2 * 1e6,
    props: { 'ISO 3166-2': r.iso, Plaka: Number(r.iso.slice(3)) },
  }));
}

export async function loadIslands(): Promise<Feature[]> {
  const rows = (await (await fetch(`${import.meta.env.BASE_URL}data/islands.json`)).json()) as {
    id: number; t: 'w' | 'r'; name: string | null; nameEn: string | null; kind: string; areaM2: number; polys: number[][][];
  }[];
  return rows.map((r) => makeFeature({
    id: `ada:${r.t}${r.id}`,
    kind: 'island',
    name: r.name ?? (r.kind === 'islet' ? 'Adacık (isimsiz)' : 'Ada (isimsiz)'),
    polys: toMercRings(r.polys as unknown as number[][][]),
    areaM2: r.areaM2,
    props: {
      Tür: r.kind === 'islet' ? 'Adacık' : 'Ada',
      'İngilizce ad': r.nameEn,
      OSM: `${r.t === 'w' ? 'way' : 'relation'}/${r.id}`,
    },
  }));
}

/** Pilot district = a Arksus location: a point that represents the district,
 *  drawn with a 10 km circle so it can be picked on the map. The circle is a
 *  display aid, not a boundary from the data. */
export const PILOT_RADIUS_M = 10000;
export function pilotFeature(loc: { id: string; name: string; province: string; lat: number; lon: number; elevation_m: number }): Feature {
  const c = lonLatToMerc(loc.lon, loc.lat);
  const r = PILOT_RADIUS_M * mercScale(c.y);
  const n = 96;
  const ring = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ring[i * 2] = c.x + Math.cos(a) * r;
    ring[i * 2 + 1] = c.y + Math.sin(a) * r;
  }
  return makeFeature({
    id: `pilot:${loc.id}`,
    kind: 'pilot',
    name: loc.name,
    polys: [[ring]],
    props: { location_id: loc.id, province: loc.province },
  });
}
