import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from '@/i18n';
import { useStore, type Step } from '@/state/store';
import { cn } from '@/ui/kit';

const STEPS: { id: Step; key: 'step1' | 'step2' | 'step3'; short: 'stepShort1' | 'stepShort2' | 'stepShort3' }[] = [
  { id: 'find', key: 'step1', short: 'stepShort1' }, { id: 'questions', key: 'step2', short: 'stepShort2' }, { id: 'result', key: 'step3', short: 'stepShort3' },
];

/**
 * Where every step after the welcome lives. While the field is being found it is
 * a card on the left of a wide screen (a sheet at the bottom of a phone), so the
 * map stays usable. From the questions on it becomes a window over almost the
 * whole screen with a margin of map around it, and folds down to a bar.
 */
export function Panel({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const step = useStore((s) => s.step);
  const question = useStore((s) => s.question);
  const findMode = useStore((s) => s.findMode);
  const open = useStore((s) => s.sheetOpen);
  const setOpen = useStore((s) => s.setSheetOpen);
  const scroller = useRef<HTMLDivElement>(null);
  const at = step === 'analyzing' ? 'questions' : step;
  const index = STEPS.findIndex((s) => s.id === at);
  // The map must stay reachable while the farmer is touching it.
  const onMap = step === 'find' && (findMode === 'tap' || findMode === 'draw');
  const wide = step !== 'find';

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step, question, findMode]);

  return (
    <section
      aria-label={t(STEPS[Math.max(0, index)].key)}
      className={cn(
        'absolute z-20 flex flex-col bg-paper shadow-panel ease-out',
        wide
          ? cn('inset-x-2 bottom-2 rounded-[1.5rem] transition-[height] duration-300 md:bottom-6 md:left-[max(1.5rem,4vw)] md:rounded-[1.75rem]',
            open ? 'h-[calc(100dvh-5.25rem)] md:right-[max(1.5rem,4vw)] md:h-[calc(100dvh-7rem)]' : 'h-[4.5rem] md:right-auto md:w-[22rem]')
          : cn('inset-x-0 bottom-0 rounded-t-[1.75rem] transition-[max-height] duration-300',
            open ? (onMap ? 'max-h-[40dvh]' : 'max-h-[60dvh]') : 'max-h-[4.5rem]',
            'md:inset-x-auto md:bottom-4 md:left-4 md:top-[4.75rem] md:max-h-none md:w-[28rem] md:rounded-[1.75rem]'),
      )}
    >
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className={cn('flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 pt-2 text-sm font-bold text-muted', !wide && 'md:hidden')}>
        <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-line" />
        <span className="flex items-center gap-1">{open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{open ? t('showMap') : t('showPanel')}</span>
      </button>

      <ol className={cn('flex w-full shrink-0 items-center gap-1.5 px-4 pb-3 pt-1', wide ? 'mx-auto max-w-2xl' : 'md:pt-4', wide && !open && 'hidden')} aria-label={t('step1')}>
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === index ? 'step' : undefined}
            className={cn('flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-bold',
              i === index ? 'bg-primary text-white' : i < index ? 'bg-primary-soft text-primary' : 'bg-canvas text-faint')}>
            <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black', i === index ? 'bg-gold text-primary-strong' : i < index ? 'bg-primary text-white' : 'bg-raise')}>
              {i < index ? '✓' : i + 1}
            </span>
            <span className="truncate" title={t(s.key)}>{t(s.short)}</span>
          </li>
        ))}
      </ol>

      <div ref={scroller} className={cn('thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(6rem,env(safe-area-inset-bottom))]', wide && 'md:px-6', wide && !open && 'hidden')}>
        {/* Questions read best in a column; the result uses the width for its menu. */}
        <div className={cn('mx-auto w-full', !wide ? '' : step === 'result' ? 'max-w-6xl' : 'max-w-2xl')}>{children}</div>
      </div>
    </section>
  );
}
