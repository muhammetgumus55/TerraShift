import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DefaultsFile, DepthId, ResultsFile, SiteIndex } from '@/lib/types';
import { decide, inputsFromDefaults } from '@/lib/economics';
import { PRIORITY_IDS, weightsFor } from './priorities';
import { buildVerdict, reasonFor, wheatVsBaseline, whyKey } from './verdict';

const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', rel), 'utf-8')) as T;
const site = read<SiteIndex>('site_index.json');
const defaults = read<DefaultsFile>('defaults.json');
const nigde = read<ResultsFile>('results/nigde.json');

describe('verdict', () => {
  it('Niğde, medium soil, team priorities: the page a farmer sees', () => {
    const v = buildVerdict(site, defaults, nigde, 'medium');
    expect(v.recommended?.rotation.id).toBe('fallow_wheat');
    expect(v.recommended?.status).toBe('recommended');
    expect(v.recommended?.rank).toBe(1);
    expect(v.recommended?.ranked.score).toBeCloseTo(0.72, 2);
    expect(v.recommended?.ranked.driver).toBe('yield');
    // both legumes pull the next wheat too far below wheat after fallow: shown, never suggested
    expect(v.blocked.map((o) => o.rotation.id).sort()).toEqual(['chickpea_wheat', 'lentil_wheat']);
    for (const b of v.blocked) {
      expect(b.status).toBe('blocked');
      expect(b.rank).toBeNull();
      expect(b.ranked.blocked).toContain('wheat_yield_below_baseline');
    }
    expect(v.options[0].rotation.id).toBe('fallow_wheat');
    expect(v.baseline.rotation.is_baseline).toBe(true);
    expect(v.nYears).toBe(24);
    expect(v.nSequences).toBe(72);
  });

  it('year types follow the flip table of the chosen depth', () => {
    const v = buildVerdict(site, defaults, nigde, 'medium');
    expect(v.byYearType.map((y) => y.tercile)).toEqual(['dry', 'normal', 'wet']);
    expect(v.byYearType.map((y) => y.recommended)).toEqual(['fallow_wheat', 'fallow_wheat', 'lentil_wheat']);
    expect(v.byYearType.reduce((s, y) => s + y.nYears, 0)).toBe(24);
  });

  it('depth view is decide() on each depth class, and says when the answer depends on depth', () => {
    const inp = inputsFromDefaults(defaults);
    const v = buildVerdict(site, defaults, nigde, 'medium');
    expect(v.byDepth.map((d) => d.depth.id)).toEqual(['shallow', 'medium', 'deep']);
    for (const d of v.byDepth) expect(d.recommended).toBe(decide(nigde, site, d.depth.id, inp).recommended);
    expect(v.dependsOnDepth).toBe(new Set(v.byDepth.map((d) => d.recommended)).size > 1);
  });

  it('wheat after a legume, as a share of wheat after fallow', () => {
    const v = buildVerdict(site, defaults, nigde, 'medium');
    expect(wheatVsBaseline(v.baseline, v.baseline)).toBe(1);
    for (const b of v.blocked) {
      const r = wheatVsBaseline(b, v.baseline)!;
      expect(r).toBeLessThan(0.85);      // that is why the guardrail blocked it
      expect(r).toBeGreaterThan(0);
    }
  });

  it('Karapınar, "protect my soil": fallow is all that is left, so the page must not call it the least bare', () => {
    const inp = inputsFromDefaults(defaults);
    const v = buildVerdict(site, defaults, read<ResultsFile>('results/karapinar.json'), 'medium', weightsFor('soil', inp.weights));
    expect(v.recommended?.rotation.id).toBe('fallow_wheat');
    expect(v.recommended?.ranked.driver).toBe('soil');           // soil adds most to its score...
    expect(v.recommended!.ranked.parts.soil).toBeLessThan(0.9);  // ...but fallow is not the best on soil
    expect(reasonFor(v)).toEqual({ kind: 'only_eligible' });
    expect(whyKey(v)).toBe('why_only');
  });

  it('the reason shown is true in every district, depth and priority', () => {
    const inp = inputsFromDefaults(defaults);
    const seen = new Set<string>();
    for (const loc of site.locations) {
      const results = read<ResultsFile>(`results/${loc.id}.json`);
      for (const depth of ['shallow', 'medium', 'deep'] as DepthId[]) {
        for (const p of PRIORITY_IDS) {
          const v = buildVerdict(site, defaults, results, depth, weightsFor(p, inp.weights));
          const r = reasonFor(v)!;
          const eligible = v.options.filter((o) => o.status !== 'blocked');
          seen.add(r.kind);
          if (r.kind === 'only_eligible') {
            expect(eligible).toHaveLength(1);
          } else if (r.kind === 'best_on') {
            // "the most / the least" is said only of the option that is first of all three on that criterion
            const best = Math.max(...v.options.map((o) => o.ranked.parts[r.criterion]));
            expect(v.recommended!.ranked.parts[r.criterion]).toBeCloseTo(best, 3);
            expect(whyKey(v)).toBe(`why_${r.criterion}`);
          } else {
            expect(eligible.length).toBeGreaterThan(1);
            expect(v.recommended!.ranked.parts[v.recommended!.ranked.driver]).toBeLessThan(0.999);
            expect(v.recommended!.ranked.score).toBe(Math.max(...eligible.map((o) => o.ranked.score)));
            expect(whyKey(v)).toBe('why_overall');
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(['best_on', 'best_overall', 'only_eligible']);   // the real data shows all three
  });

  it('every district, depth and priority gives one coherent verdict', () => {
    const inp = inputsFromDefaults(defaults);
    for (const loc of site.locations) {
      const results = read<ResultsFile>(`results/${loc.id}.json`);
      for (const depth of ['shallow', 'medium', 'deep'] as DepthId[]) {
        for (const p of PRIORITY_IDS) {
          const v = buildVerdict(site, defaults, results, depth, weightsFor(p, inp.weights));
          expect(v.options).toHaveLength(3);
          expect(v.options.filter((o) => o.status === 'recommended')).toHaveLength(1);   // fallow is never blocked
          expect(v.recommended!.ranked.eligible).toBe(true);
          expect(v.blocked.every((b) => b.ranked.blocked.length > 0)).toBe(true);
          const ranks = v.options.filter((o) => o.rank !== null).map((o) => o.rank);
          expect(ranks).toEqual(ranks.map((_, i) => i + 1));
          if (v.closeCall) expect(v.runnerUp).not.toBeNull();
        }
      }
    }
  });
});
