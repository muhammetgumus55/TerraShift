// The decision as the farmer pages need it. Every score, guardrail and ranking
// comes from lib/economics.ts (decide, summarize, flipTable, priceRobustness);
// this file only arranges those outputs: which option is suggested, which are
// blocked, what happens in dry or wet years and on shallower or deeper soil.

import {
  decide, flipTable, inputsFromDefaults, priceRobustness, summarize,
  type Decision, type FlipCell, type PriceRobustness, type RankedRotation, type RotationSummary, type Tercile, type Weights,
} from '@/lib/economics';
import type { DefaultsFile, DepthClass, DepthId, ResultsFile, Rotation, SiteIndex } from '@/lib/types';
import type { Key } from '@/i18n';

export type OptionStatus = 'recommended' | 'eligible' | 'blocked';

export interface OptionView {
  rotation: Rotation;
  summary: RotationSummary;
  ranked: RankedRotation;
  status: OptionStatus;
  /** Place among the options that pass the guardrails; null when blocked. */
  rank: number | null;
}

export interface YearTypeVerdict { tercile: Tercile; recommended: string | null; closeCall: boolean; nYears: number }
export interface DepthVerdict { depth: DepthClass; recommended: string | null; closeCall: boolean }

export interface Verdict {
  depthId: DepthId;
  scenarioId: string;
  weights: Weights;
  decision: Decision;
  /** Suggested first, then the other eligible ones, then the blocked ones. */
  options: OptionView[];
  recommended: OptionView | null;
  runnerUp: OptionView | null;
  closeCall: boolean;
  blocked: OptionView[];
  baseline: OptionView;
  /** This depth in the dry, normal and wet thirds of the climate years. */
  byYearType: YearTypeVerdict[];
  /** The same priorities on each depth class. */
  byDepth: DepthVerdict[];
  dependsOnDepth: boolean;
  robustness: PriceRobustness;
  flip: FlipCell[];
  nYears: number;
  /** Two-year sequences behind this verdict: rotations × climate years. */
  nSequences: number;
}

export function buildVerdict(
  site: SiteIndex, defaults: DefaultsFile, results: ResultsFile, depthId: DepthId, weights?: Weights,
): Verdict {
  const inputs = inputsFromDefaults(defaults);
  const w = weights ?? inputs.weights;
  const decision = decide(results, site, depthId, inputs, w);
  const summaries = summarize(results, site, depthId);

  let place = 0;
  const options: OptionView[] = decision.ranking.map((ranked) => {
    const rotation = site.rotations.find((r) => r.id === ranked.rotation_id)!;
    const summary = summaries.find((s) => s.rotation_id === ranked.rotation_id)!;
    const rank = ranked.eligible ? ++place : null;
    const status: OptionStatus = !ranked.eligible ? 'blocked' : ranked.rotation_id === decision.recommended ? 'recommended' : 'eligible';
    return { rotation, summary, ranked, status, rank };
  });
  const find = (id: string | null) => options.find((o) => o.rotation.id === id) ?? null;

  const flip = flipTable(results, site, inputs, w);
  const byYearType: YearTypeVerdict[] = (['dry', 'normal', 'wet'] as const).map((tercile) => {
    const cell = flip.find((c) => c.depth_id === depthId && c.tercile === tercile);
    return { tercile, recommended: cell?.rotation_id ?? null, closeCall: cell?.close_call ?? false, nYears: cell?.n_years ?? 0 };
  });
  const byDepth: DepthVerdict[] = site.depth_classes.map((depth) => {
    const d = depth.id === depthId ? decision : decide(results, site, depth.id, inputs, w);
    return { depth, recommended: d.recommended, closeCall: d.close_call };
  });

  const nYears = site.start_years[1] - site.start_years[0] + 1;
  return {
    depthId,
    scenarioId: results.scenario_id,
    weights: w,
    decision,
    options,
    recommended: find(decision.recommended),
    runnerUp: find(decision.runner_up),
    closeCall: decision.close_call,
    blocked: options.filter((o) => o.status === 'blocked'),
    baseline: options.find((o) => o.rotation.is_baseline) ?? options[0],
    byYearType,
    byDepth,
    dependsOnDepth: new Set(byDepth.map((d) => d.recommended)).size > 1,
    robustness: priceRobustness(results, site, depthId, inputs, w),
    flip,
    nYears,
    nSequences: site.rotations.length * nYears,
  };
}

/**
 * Why the suggested option is suggested, in a form the page can state as a fact.
 * `ranked.driver` is only the criterion that adds most to the score; the option may still be
 * far from the best on it (fallow under "protect my soil" is the barest option, yet soil adds
 * most to its score). A superlative is therefore said only when the option really is first.
 */
export type Reason =
  | { kind: 'only_eligible' }                          // the other options were blocked by a guardrail
  | { kind: 'best_on'; criterion: keyof Weights }      // first of all three on the driving criterion
  | { kind: 'best_overall' };                          // ahead on the weighted total, not on the driver

/** `parts` are relative to the best of all three options, so the best one has exactly 1. */
const FIRST = 0.999;

export function reasonFor(v: Verdict): Reason | null {
  const rec = v.recommended;
  if (!rec) return null;
  if (v.options.filter((o) => o.status !== 'blocked').length === 1) return { kind: 'only_eligible' };
  const criterion = rec.ranked.driver;
  return rec.ranked.parts[criterion] >= FIRST ? { kind: 'best_on', criterion } : { kind: 'best_overall' };
}

/** The sentence for `reasonFor`: one of the `why_*` strings; null when nothing is suggested. */
export function whyKey(v: Verdict): Key | null {
  const r = reasonFor(v);
  if (!r) return null;
  if (r.kind === 'only_eligible') return 'why_only';
  return r.kind === 'best_on' ? (`why_${r.criterion}` as Key) : 'why_overall';
}

/** Median wheat yield of an option as a share of the median wheat yield after fallow (1 = the same). */
export function wheatVsBaseline(option: OptionView, baseline: OptionView): number | null {
  const base = baseline.summary.wheat_yield_ratio.p50;
  return base > 0 ? option.summary.wheat_yield_ratio.p50 / base : null;
}
