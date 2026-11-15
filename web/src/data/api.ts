// The contract files the engine writes to public/data (make data). Loading
// order: site_index, defaults and validation once at start; a district's
// results, soil-wetness and AI commentary when a field is picked; the ~2 MB
// weekly ledger only when the 3D field view opens.

import type {
  AgentFile, DefaultsFile, ExplainFile, FertilizerFile, LedgerFile, ResultsFile, SiteIndex, SmapFile, SoilHealthFile, SowingFile, ValidationFile,
} from '@/lib/types';

const base = `${import.meta.env.BASE_URL}data`;
const cache = new Map<string, Promise<unknown>>();

export function getJSON<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${base}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    // A failed request is retried next time rather than cached as a rejection.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export interface Core { site: SiteIndex; defaults: DefaultsFile; validation: ValidationFile }

export async function loadCore(): Promise<Core> {
  const [site, defaults, validation] = await Promise.all([
    getJSON<SiteIndex>('site_index.json'),
    getJSON<DefaultsFile>('defaults.json'),
    getJSON<ValidationFile>('validation.json'),
  ]);
  return { site, defaults, validation };
}

export const loadResults = (locationId: string, scenarioId = 'baseline') =>
  getJSON<ResultsFile>(scenarioId === 'baseline' ? `results/${locationId}.json` : `results/${locationId}__${scenarioId}.json`);

/** smap/{id}.json always exists per contract; a missing file must not break the page. */
export const loadSmap = (locationId: string) => getJSON<SmapFile>(`smap/${locationId}.json`).catch(() => null);

/** AI commentary exists only after `python -m nobetsu.agent`; absent is normal. */
export const loadAgent = (locationId: string) => getJSON<AgentFile>(`agent/${locationId}.json`).catch(() => null);

/** Why-this-crop explanations (python -m nobetsu.explain); absent is normal. */
export const loadExplain = (locationId: string) => getJSON<ExplainFile>(`explain/${locationId}.json`).catch(() => null);
/** Public URL of a file under public/data (audio clips referenced from the data files). */
export const dataUrl = (path: string) => `${base}/${path}`;

export const loadLedger = (locationId: string) => getJSON<LedgerFile>(`ledger/${locationId}.json`);
export const loadFertilizer = () => getJSON<FertilizerFile>('fertilizer.json');
export const loadSowing = () => getJSON<SowingFile>('sowing.json');
export const loadSoilHealth = () => getJSON<SoilHealthFile>('soil_health.json');
