import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { cloudEnabled } from '@/state/cloud';
import { loadDistrictTotals } from '@/services/cloud';
import { districtOf, toIntentCrop } from '@/domain/consent';
import { percents, planFor, type DistrictPlan as Plan, type TotalRow } from '@/domain/districtPlan';
import { harvestYears, stageOf } from '@/domain/history';
import { nextSeason } from '@/domain/nextSeason';
import type { Verdict } from '@/domain/verdict';
import { Card, cn } from '@/ui/kit';

interface Demo { mock: true; harvest_year: number; source: string; rows: TotalRow[] }

/**
 * "What is your district planting this season?" — the farmers' own plans, as district totals
 * (Supabase district_totals: >= 5 records, no names). Below the threshold the card says so and can
 * show clearly labelled sample data (public/demo/district_plans.json, mock: true) for the demo.
 */
export function DistrictPlan({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  const history = useStore((s) => s.answers.history);
  const parcels = useStore((s) => s.parcels);
  const locationId = useStore((s) => s.locationId);
  const site = useStore((s) => s.core?.site);
  const next = useMemo(() => nextSeason(stageOf(history), verdict, harvestYears(new Date())[2]), [verdict, history]);
  const district = districtOf(parcels, site?.locations.find((l) => l.id === locationId));
  const year = next?.harvestYear ?? null;
  const [real, setReal] = useState<Plan | null | 'failed' | undefined>(undefined);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!cloudEnabled || !year || !district) return;
    let alive = true;
    loadDistrictTotals(year).then((rows) => alive && setReal(planFor(rows, district)), () => alive && setReal('failed'));
    return () => { alive = false; };
    // district is a fresh object each render; its names are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, district?.il, district?.ilce]);

  useEffect(() => {
    if (!showDemo || demo) return;
    fetch('/demo/district_plans.json').then((r) => r.json()).then(setDemo, () => setShowDemo(false));
  }, [showDemo, demo]);

  if (!next || !district) return null;
  const ours = toIntentCrop(next.crop);
  const demoPlan = showDemo && demo ? planFor(demo.rows, district) : null;
  const plan = typeof real === 'object' && real ? real : demoPlan;
  const isDemo = !(typeof real === 'object' && real) && !!demoPlan;
  const label = (c: string) => (c === 'barley' ? t('piBarley') : c === 'other' ? t('piOther') : t(`crop_${c}` as Key));

  return (
    <Card className="grid gap-3">
      <div>
        <p className="flex items-center gap-2 text-lg font-extrabold"><Users size={20} className="text-primary" aria-hidden="true" /> {t('dpTitle')}</p>
        <p className="mt-0.5 text-sm text-muted">{t('dpSub', { y: next.harvestYear, ilce: district.ilce })}</p>
      </div>

      {isDemo && (
        <p className="justify-self-start rounded-full bg-[#fbe7b5] px-3 py-1 text-sm font-extrabold text-[#6b4a00]">{t('dpDemoBadge')}</p>
      )}

      {plan ? (
        <>
          <ul className="grid gap-2">
            {plan.items.map((x, i) => {
              const pct = percents(plan.items)[i];
              const mine = x.crop === ours;
              return (
                <li key={x.crop} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-[15px]">
                    <span className="font-bold">
                      {label(x.crop)}
                      {mine && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-extrabold text-primary">{t('dpOurs')}</span>}
                    </span>
                    <span className="tabular-nums"><b>%{pct}</b> <span className="text-sm text-muted">· {t('dpFields', { n: x.fields })}</span></span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                    <div className={cn('h-full rounded-full', mine ? 'bg-primary' : 'bg-[#b9a27a]', isDemo && 'opacity-60')} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">{t('dpTotal', { n: plan.total })}</p>
          {isDemo && demo && <p className="text-xs text-muted">{demo.source}</p>}
        </>
      ) : (
        <p className="text-[15px] text-muted">{real === 'failed' ? t('dpLoadFail') : t('dpNotEnough')}</p>
      )}

      {!(typeof real === 'object' && real) && (
        <button type="button" onClick={() => setShowDemo(!showDemo)}
          className="justify-self-start text-[15px] font-bold text-primary underline underline-offset-4">
          {t(showDemo ? 'dpDemoHide' : 'dpDemoShow')}
        </button>
      )}
    </Card>
  );
}
