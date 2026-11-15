import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { percents, planFor, type TotalRow } from './districtPlan';

const rows: TotalRow[] = [
  { il: 'Kırşehir', ilce: 'Kaman', crop: 'wheat', fields: 6 },
  { il: 'Kırşehir', ilce: 'Kaman', crop: 'chickpea', fields: 3 },
  { il: 'Kırşehir', ilce: 'Kaman', crop: 'lentil', fields: 1 },
  { il: 'Ankara', ilce: 'Polatlı', crop: 'wheat', fields: 9 },
];

describe('district plan', () => {
  it('shares of the district, largest first; other districts ignored; names matched case-insensitively', () => {
    const p = planFor(rows, { il: 'KIRŞEHİR', ilce: 'kaman' })!;
    expect(p.total).toBe(10);
    expect(p.items.map((x) => [x.crop, x.share])).toEqual([['wheat', 0.6], ['chickpea', 0.3], ['lentil', 0.1]]);
  });
  it('no rows (below the 5-record threshold, or none yet) gives null', () => {
    expect(planFor(rows, { il: 'Konya', ilce: 'Karapınar' })).toBeNull();
  });
  it('percents add up to 100', () => {
    const p = planFor([{ il: 'a', ilce: 'b', crop: 'x', fields: 1 }, { il: 'a', ilce: 'b', crop: 'y', fields: 1 }, { il: 'a', ilce: 'b', crop: 'z', fields: 1 }], { il: 'a', ilce: 'b' })!;
    expect(percents(p.items)).toEqual([34, 33, 33]);
  });
  it('the demo file is flagged as made-up and covers the 13 pilot districts', () => {
    const demo = JSON.parse(readFileSync(resolve(__dirname, '../../public/demo/district_plans.json'), 'utf-8'));
    const site = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/site_index.json'), 'utf-8'));
    expect(demo.mock).toBe(true);
    expect(demo.verified).toBe(false);
    for (const l of site.locations) expect(planFor(demo.rows, { il: l.province, ilce: l.name })).not.toBeNull();
  });
});
