import { useEffect, useMemo, useState } from 'react';
import { Check, LogIn, MapPinned } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { cloudEnabled, useCloud } from '@/state/cloud';
import { loadIntent, saveIntent } from '@/services/cloud';
import { districtOf, hasConsent, needsNotice, toIntentCrop, type IntentCrop } from '@/domain/consent';
import { harvestYears, stageOf } from '@/domain/history';
import { nextSeason } from '@/domain/nextSeason';
import type { Verdict } from '@/domain/verdict';
import { Card, cn } from '@/ui/kit';

/**
 * "What will you sow this season?" — the farmer's own plan for the coming harvest, counted per
 * district when they agreed to the district statistics (docs/legal/acik-riza-metni.md, İzin 1).
 * Only il + ilçe, harvest year, crop and irrigation are sent; never the field.
 */
export function PlantingIntent({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  const user = useCloud((s) => s.user);
  const consents = useCloud((s) => s.consents);
  const history = useStore((s) => s.answers.history);
  const water = useStore((s) => s.answers.water);
  const parcels = useStore((s) => s.parcels);
  const locationId = useStore((s) => s.locationId);
  const site = useStore((s) => s.core?.site);
  const setProfileOpen = useStore((s) => s.setProfileOpen);
  const next = useMemo(() => nextSeason(stageOf(history), verdict, harvestYears(new Date())[2]), [verdict, history]);
  const district = districtOf(parcels, site?.locations.find((l) => l.id === locationId));
  const [chosen, setChosen] = useState<IntentCrop | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const allowed = !!user && !needsNotice(consents) && hasConsent(consents, 'district_stats');

  // What this farmer already said for this harvest year, if anything.
  useEffect(() => {
    if (!allowed || !next) return;
    let alive = true;
    loadIntent(next.harvestYear).then((i) => { if (alive && i) { setChosen(i.crop); setState('saved'); } }, () => {});
    return () => { alive = false; };
  }, [allowed, next]);

  if (!cloudEnabled || !next || !district) return null;

  if (!user || !allowed) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
        <MapPinned size={18} className="text-primary" aria-hidden="true" />
        {t(user ? 'piNeedConsent' : 'piSignIn')}
        <button type="button" onClick={() => setProfileOpen(true)} className="inline-flex min-h-11 items-center gap-1 font-bold text-primary underline underline-offset-4">
          {!user && <LogIn size={16} aria-hidden="true" />} {t(user ? 'gConsentsTitle' : 'gSignIn')}
        </button>
      </p>
    );
  }

  const options: IntentCrop[] = [...new Set<IntentCrop>([
    toIntentCrop(next.crop), ...next.alternatives.map((a) => toIntentCrop(a.crop)), 'wheat', 'chickpea', 'lentil', 'barley', 'fallow', 'other',
  ])];
  const label = (c: IntentCrop) => (c === 'barley' ? t('piBarley') : c === 'other' ? t('piOther') : t(`crop_${c}` as Key));

  const pick = async (crop: IntentCrop) => {
    setChosen(crop); setState('busy');
    try {
      await saveIntent(user.id, { harvest_year: next.harvestYear, il: district.il, ilce: district.ilce, crop, irrigation: water });
      setState('saved');
    } catch { setState('failed'); }
  };

  return (
    <Card className="grid gap-2.5">
      <p className="flex items-center gap-2 text-lg font-extrabold"><MapPinned size={20} className="text-primary" aria-hidden="true" /> {t('piTitle')}</p>
      <p className="text-sm text-muted">{t('piHelp', { y: next.harvestYear })}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('piTitle')}>
        {options.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={chosen === c} disabled={state === 'busy'} onClick={() => void pick(c)}
            className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-base font-bold',
              chosen === c ? 'border-primary bg-primary text-white' : 'border-line bg-white hover:border-primary/60')}>
            {chosen === c && state === 'saved' && <Check size={18} strokeWidth={3} aria-hidden="true" />} {label(c)}
          </button>
        ))}
      </div>
      {state === 'saved' && chosen && <p role="status" className="text-sm font-semibold text-primary">{t('piSaved', { crop: label(chosen), ilce: district.ilce })}</p>}
      {state === 'failed' && <p role="alert" className="text-sm font-semibold text-bad">{t('piError')}</p>}
    </Card>
  );
}
