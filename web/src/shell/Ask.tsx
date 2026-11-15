import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Send, X } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { depthFor, useStore } from '@/state/store';
import { useDistrict } from '@/data/hooks';
import { buildVerdict, whyKey } from '@/domain/verdict';
import { weightsFor } from '@/domain/priorities';
import { inputsFromDefaults } from '@/lib/economics';
import { stageOf, harvestYears } from '@/domain/history';
import { nextSeason } from '@/domain/nextSeason';
import { answer, SUGGESTIONS, type Action, type FieldContext, type Reply } from '@/domain/assistant';
import { visible } from '@/domain/sections';
import { Farmer } from '@/ui/farmer/Farmer';
import { cn } from '@/ui/kit';

interface Message { from: 'farmer' | 'me'; text: string; action?: Action; suggest?: boolean }

/** What the farmer knows about the field on screen, or null before there is a result. */
function useFieldContext(): FieldContext | null {
  const { t } = useT();
  const core = useStore((s) => s.core);
  const locationId = useStore((s) => s.locationId);
  const answers = useStore((s) => s.answers);
  const district = useDistrict(core ? locationId : null);
  return useMemo(() => {
    if (!core || district.status !== 'ready' || !answers.depth || !answers.priority) return null;
    const weights = weightsFor(answers.priority, inputsFromDefaults(core.defaults).weights);
    const v = buildVerdict(core.site, core.defaults, district.data.results, depthFor(answers), weights);
    const n = nextSeason(stageOf(answers.history), v, harvestYears(new Date())[2]);
    const loc = core.site.locations.find((l) => l.id === locationId);
    if (!n || !v.recommended || !loc) return null;
    return {
      location: `${loc.name}, ${loc.province}`, harvestYear: n.harvestYear, crop: n.crop, then: n.then, wheatNow: n.wheatNow,
      driver: v.recommended.ranked.driver as FieldContext['driver'],
      why: whyKey(v) ?? 'why_overall',
      alternatives: n.alternatives.map((a) => ({ crop: a.crop, close: a.close })),
      blocked: v.blocked.map((b) => ({ crop: b.rotation.crops[0], reasons: b.ranked.blocked.map((r) => t(`block_${r}` as Key)) })),
      irrigated: answers.water === 'irrigated',
    };
  }, [core, district, answers, locationId, t]);
}

/**
 * The farmer in the bottom-right corner, on every screen: tap him and ask.
 * Answers are worked out on this device from what the page knows
 * (domain/assistant.ts) until the AI agent is connected.
 */
export function Ask() {
  const { t } = useT();
  const step = useStore((s) => s.step);
  const sim = useStore((s) => s.sim);
  const open = useStore((s) => s.askOpen);
  const setOpen = useStore((s) => s.setAskOpen);
  const [greeted, setGreeted] = useState(false);

  // Say hello once on the opening screen, then keep quiet.
  useEffect(() => {
    if (step !== 'welcome' || greeted) return;
    const id = window.setTimeout(() => setGreeted(true), 7000);
    return () => window.clearTimeout(id);
  }, [step, greeted]);
  if (sim) return null;
  const hello = step === 'welcome' && !greeted && !open;

  return (
    <>
      {open && <AskWindow onClose={() => setOpen(false)} />}
      <div className="fixed bottom-3 right-3 z-40 flex items-end gap-2 md:bottom-5 md:right-5">
        {hello && (
          <p className="mb-3 max-w-56 animate-rise rounded-2xl rounded-br-sm bg-white px-3.5 py-2 text-[15px] font-bold leading-snug text-ink shadow-float">{t('askHello')}</p>
        )}
        <button type="button" onClick={() => { setOpen(!open); setGreeted(true); }} aria-expanded={open} aria-label={t('askOpen')} title={t('askOpen')}
          className={cn('grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-paper shadow-panel transition hover:scale-105 active:scale-95 md:h-[4.5rem] md:w-[4.5rem]',
            open && 'ring-4 ring-gold')}>
          <Farmer mood={hello ? 'waving' : 'idle'} size={44} className="mt-1" />
        </button>
      </div>
    </>
  );
}

function AskWindow({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const ctx = useFieldContext();
  const step = useStore((s) => s.step);
  const [msgs, setMsgs] = useState<Message[]>(() => [{ from: 'farmer', text: t('as_hello'), suggest: true }]);
  const [text, setText] = useState('');
  const [talking, setTalking] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    setText('');
    setMsgs((m) => [...m, { from: 'me', text: question }]);
    setTalking(true);
    const r: Reply = answer(question, ctx, t);
    // A short pause reads as the farmer thinking; then he talks for a moment.
    timers.current.push(window.setTimeout(() => setMsgs((m) => [...m, { from: 'farmer', ...r }]), 380));
    timers.current.push(window.setTimeout(() => setTalking(false), 380 + Math.min(2600, 30 * r.text.length)));
  };

  const act = (a: Action) => {
    const st = useStore.getState();
    if (a.kind === 'settings') { st.setProfileOpen(true); return; }
    if (a.kind === 'find') { st.go('find'); if (!matchMedia('(min-width: 768px)').matches) onClose(); return; }
    // A section hidden by the chosen mode is switched on, so the button never leads nowhere.
    if (!visible(st.prefs, a.id)) st.setPrefs({ ...st.prefs, show: { ...st.prefs.show, [a.id]: true } });
    st.setSection(a.id);
    if (st.step !== 'result' && st.parcels.length && st.locationId) st.go('result');
    st.setSheetOpen(true);
    if (!matchMedia('(min-width: 768px)').matches) onClose();
  };
  const label = (a: Action): Key => (a.kind === 'settings' ? 'askOpenSettings' : a.kind === 'find' ? 'askOpenFind' : 'askOpenSection');

  return (
    <section role="dialog" aria-labelledby="ask-title"
      className="fixed inset-x-2 bottom-[5.25rem] top-[4.75rem] z-40 flex animate-rise flex-col overflow-hidden rounded-[1.5rem] bg-paper shadow-panel md:inset-x-auto md:bottom-28 md:right-5 md:top-auto md:h-[min(34rem,calc(100dvh-9rem))] md:w-[24rem]">
      <header className="flex items-center gap-3 border-b border-line bg-primary-strong px-4 py-3 text-white">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/12"><Farmer mood={talking ? 'talking' : 'idle'} size={36} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="ask-title" className="text-lg font-extrabold leading-tight">{t('askTitle')}</h2>
          <p className="truncate text-sm text-white/80">{ctx ? ctx.location : t('askSub')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/12"><X size={22} /></button>
      </header>

      <div ref={list} className="thin-scroll grid flex-1 content-start gap-2.5 overflow-y-auto px-3 py-3" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={cn('grid max-w-[88%] gap-2', m.from === 'me' ? 'justify-self-end' : 'justify-self-start')}>
            <p className={cn('rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug', m.from === 'me' ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm')}>{m.text}</p>
            {m.action && !(m.action.kind === 'find' && step === 'find') && (
              <button type="button" onClick={() => act(m.action!)} className="flex min-h-10 items-center gap-1.5 justify-self-start rounded-xl bg-primary-soft px-3 text-sm font-bold text-primary hover:bg-primary hover:text-white">
                {t(label(m.action))} <ArrowRight size={16} />
              </button>
            )}
            {m.suggest && i === msgs.length - 1 && (
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((k) => (
                  <button key={k} type="button" onClick={() => ask(t(k))} className="min-h-10 rounded-full border-2 border-line bg-white px-3 text-sm font-bold text-ink hover:border-primary">{t(k)}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="flex items-center gap-2 border-t border-line bg-white p-2.5" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('askPlaceholder')} aria-label={t('askPlaceholder')} maxLength={300}
          className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-base focus:border-primary focus:outline-none" />
        <button type="submit" disabled={!text.trim()} aria-label={t('askSend')} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white disabled:opacity-40"><Send size={20} /></button>
      </form>
      <p className="bg-white px-3 pb-2 text-xs text-muted">{t('askNote')}</p>
    </section>
  );
}
