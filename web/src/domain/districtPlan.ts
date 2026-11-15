// "What is planted in your district this season?" — shares of the district totals (Supabase rpc
// district_totals: only districts with at least 5 records, no user ids). Owner: Gümüş. Pure, tested.

import type { District } from './consent';

export interface TotalRow { il: string; ilce: string; crop: string; fields: number }
export interface Share { crop: string; fields: number; share: number }
export interface DistrictPlan { total: number; items: Share[] }

const norm = (s: string) => s.trim().toLocaleLowerCase('tr');

/** The district's rows as shares of its total, largest first; null when the district has no rows. */
export function planFor(rows: TotalRow[], d: District): DistrictPlan | null {
  const mine = rows.filter((r) => norm(r.il) === norm(d.il) && norm(r.ilce) === norm(d.ilce) && r.fields > 0);
  const total = mine.reduce((s, r) => s + Number(r.fields), 0);
  if (!total) return null;
  const items = mine
    .map((r) => ({ crop: r.crop, fields: Number(r.fields), share: Number(r.fields) / total }))
    .sort((a, b) => b.fields - a.fields || a.crop.localeCompare(b.crop));
  return { total, items };
}

/** Percentages that add up to 100 (largest remainder), for display. */
export function percents(items: Share[]): number[] {
  const raw = items.map((x) => x.share * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; out[i]++; left--; }
  return out;
}
