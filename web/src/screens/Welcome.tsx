import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { withMap } from '@/map/api';
import { Button } from '@/ui/kit';

/** Opening view: the country from above, one question, one button. */
export function Welcome() {
  const { t } = useT();
  const go = useStore((s) => s.go);
  const hasSaved = useStore((s) => s.parcels.length > 0 && !!s.locationId && s.answers.depth !== null);

  const start = () => {
    withMap((m) => m.region());
    go('find');
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end md:justify-center md:bg-gradient-to-r md:from-[#07140e]/92 md:via-[#07140e]/55 md:to-transparent">
      {/* On a phone the words sit in the lower half, on their own dark ground, and the country stays visible above. */}
      <div className="pointer-events-auto w-full max-w-2xl animate-rise bg-gradient-to-t from-[#07140e] via-[#07140e]/93 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-20 text-white md:bg-none md:p-14">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold sm:text-sm">{t('kicker')}</p>
        <h1 className="mt-2 text-[2.15rem] font-black leading-[1.05] sm:text-6xl md:mt-3">{t('heroTitle')}</h1>
        <p className="mt-3 max-w-xl text-base leading-snug text-white/90 sm:text-xl sm:leading-relaxed md:mt-4">{t('heroBody')}</p>

        <ol className="mt-4 grid grid-cols-3 gap-2 text-sm font-semibold sm:text-base md:mt-6">
          {(['step1', 'step2', 'step3'] as const).map((k, i) => (
            <li key={k} className="flex items-center gap-2 rounded-2xl bg-white/12 px-2.5 py-2 backdrop-blur-sm sm:px-3.5 sm:py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-sm font-black text-primary-strong sm:h-8 sm:w-8">{i + 1}</span>
              <span className="leading-tight">{t(k)}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 md:mt-7">
          <Button variant="gold" size="lg" onClick={start} className="w-full text-xl sm:w-auto sm:min-w-44">
            {t('start')} <ArrowRight size={24} strokeWidth={2.6} />
          </Button>
          {hasSaved && (
            <button type="button" onClick={() => go('result')} className="min-h-12 rounded-2xl px-1 text-base font-bold text-white underline decoration-gold decoration-2 underline-offset-4">
              {t('resume')}
            </button>
          )}
        </div>
        {/* On a phone the "ask the farmer" button sits in the bottom-right corner: keep these lines clear of it. */}
        <p className="mt-3 pr-[4.75rem] text-[13px] leading-snug text-white/75 sm:text-sm md:mt-5 md:pr-0">{t('heroScope')} {t('heroPrivacy')}</p>
      </div>
    </div>
  );
}
