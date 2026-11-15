// Loads the Arksus data files (web/public/data, served under /data/nobetsu) and
// turns them into what the pilot-district panel shows. All range and decision maths
// goes through the project's own economics.ts, never re-implemented here.
// 14 Nov: the site shows no money (ARAYUZLER §9); defaults.json holds decision parameters only.
// 15 Nov: climate scenarios (E2), the decision module (priorities → ranking, guardrails,
// close call, price robustness, flip table) and the evidence panel (validation.json).

import type { AgentFile, DefaultsFile, DepthId, LedgerFile, LocationId, ResultsFile, SiteIndex, SmapFile, ValidationFile } from '../../web/src/lib/types';
import {
  decide, flipTable, inputsFromDefaults, priceRobustness, summarize,
  type Decision, type DecisionInputs, type FlipCell, type PriceRobustness, type Weights,
} from '../../web/src/lib/economics';
import { pilotFeature, type Feature } from './vector/features';
import type { PilotData } from './ui/inspector';

// Standalone, the map serves the contract data itself under data/nobetsu. Built into the
// farmer site (/harita/), VITE_NOBETSU_DATA points at the site's own /data so the ~30 MB
// of results and ledgers is deployed once.
const base = (import.meta.env.VITE_NOBETSU_DATA as string | undefined) ?? `${import.meta.env.BASE_URL}data/nobetsu`;
const getJSON = <T>(path: string) => fetch(`${base}/${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
});

const resultsPath = (id: string, scenario: string) => (scenario === 'baseline' ? `results/${id}.json` : `results/${id}__${scenario}.json`);

export class Pilots {
  site: SiteIndex | null = null;
  defaults: DefaultsFile | null = null;
  validation: ValidationFile | null = null;
  features: Feature[] = [];
  depth: DepthId = 'medium';
  scenario = 'baseline';
  weights: Weights | null = null;
  private inputs: DecisionInputs | null = null;
  private results = new Map<string, ResultsFile>();   // key: `${id}__${scenario}`
  private smap = new Map<string, SmapFile>();
  private agent = new Map<string, AgentFile | null>();
  private ledgers = new Map<string, Promise<LedgerFile>>();
  private loading = new Map<string, Promise<void>>();
  onLoaded: () => void = () => {};

  async init() {
    [this.site, this.defaults] = await Promise.all([getJSON<SiteIndex>('site_index.json'), getJSON<DefaultsFile>('defaults.json')]);
    this.inputs = inputsFromDefaults(this.defaults);
    this.weights = { ...this.inputs.weights };
    getJSON<ValidationFile>('validation.json').then((v) => { this.validation = v; this.onLoaded(); }).catch(() => {});
    this.features = this.site.locations.map(pilotFeature);
    return this.features;
  }

  get anyMock() {
    return !!(this.site?.mock || this.defaults?.mock || this.validation?.mock || [...this.results.values()].some((r) => r.mock));
  }

  setWeight(k: keyof Weights, v: number) {
    if (this.weights) this.weights = { ...this.weights, [k]: Math.max(0, v) };
  }

  resetWeights() {
    if (this.inputs) this.weights = { ...this.inputs.weights };
  }

  /** Fetch a district's results (current scenario) and SMAP file once; the panel re-renders when they land. */
  ensure(id: string) {
    const key = `${id}__${this.scenario}`;
    if (this.results.has(key) || this.loading.has(key)) return;
    const p = Promise.all([
      getJSON<ResultsFile>(resultsPath(id, this.scenario)),
      this.smap.has(id) ? Promise.resolve(this.smap.get(id)!) : getJSON<SmapFile>(`smap/${id}.json`).catch(() => null),
      this.agent.has(id) ? Promise.resolve(this.agent.get(id)!) : getJSON<AgentFile>(`agent/${id}.json`).catch(() => null),
    ])
      .then(([r, s, a]) => { this.results.set(key, r); if (s) this.smap.set(id, s); this.agent.set(id, a); this.onLoaded(); })
      .catch((e) => console.warn('Arksus results', key, e))
      .finally(() => this.loading.delete(key));
    this.loading.set(key, p);
  }

  data(f: Feature): PilotData | null {
    if (!this.site || !this.defaults || !this.inputs || !this.weights) return null;
    const id = String(f.props.location_id) as LocationId;
    const location = this.site.locations.find((l) => l.id === id);
    if (!location) return null;
    this.ensure(id);
    const results = this.results.get(`${id}__${this.scenario}`) ?? null;
    let summaries = null, decision: Decision | null = null, robustness: PriceRobustness | null = null, flip: FlipCell[] | null = null;
    if (results) {
      summaries = summarize(results, this.site, this.depth);
      decision = decide(results, this.site, this.depth, this.inputs, this.weights);
      robustness = priceRobustness(results, this.site, this.depth, this.inputs, this.weights);
      flip = flipTable(results, this.site, this.inputs, this.weights);
    }
    return {
      site: this.site, location, results, smap: this.smap.get(id) ?? null, summaries, depth: this.depth,
      moneyPending: false, scenario: this.scenario, weights: this.weights, decision, robustness, flip,
      validation: this.validation,
      agent: this.agent.get(id) ?? null,
    };
  }

  /** Weekly water ledger for the process simulation (baseline climate only, per contract). */
  ledger(id: string): Promise<LedgerFile> {
    let p = this.ledgers.get(id);
    if (!p) {
      p = getJSON<LedgerFile>(`ledger/${id}.json`);
      p.catch(() => this.ledgers.delete(id));
      this.ledgers.set(id, p);
    }
    return p;
  }

  /** Baseline results for a district (the simulation always shows the historical climate). */
  async baselineResults(id: string): Promise<ResultsFile> {
    const key = `${id}__baseline`;
    const hit = this.results.get(key);
    if (hit) return hit;
    const r = await getJSON<ResultsFile>(resultsPath(id, 'baseline'));
    this.results.set(key, r);
    return r;
  }

  /** Nearest pilot point and its ground distance, if within reach of the district. */
  nearest(lon: number, lat: number, maxKm = 80): { feature: Feature; km: number } | null {
    if (!this.site) return null;
    let best: { feature: Feature; km: number } | null = null;
    for (const loc of this.site.locations) {
      const km = haversineKm(lat, lon, loc.lat, loc.lon);
      if (km <= maxKm && (!best || km < best.km)) best = { feature: this.features.find((f) => f.props.location_id === loc.id)!, km };
    }
    return best;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
