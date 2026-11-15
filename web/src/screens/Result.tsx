import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Ban, BookOpen, CalendarDays, CalendarRange, ChartScatter, ChevronRight, CirclePlay, CloudSun, Columns3, Gauge, Info, Layers, Leaf, MapPin, Mountain, Pencil, Settings2, Share2, Shovel, Sparkles, Sprout, Square, Star, Volume2 } from 'lucide-react';
import { translate, useT, type Key } from '@/i18n';
import { depthFor, useStore } from '@/state/store';
import { useDistrict, useExplain } from '@/data/hooks';
import { dataUrl } from '@/data/api';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { harvestYears, practiceOf, stageOf } from '@/domain/history';
import { nextSeason, type NextSeason } from '@/domain/nextSeason';
import { weightsFor } from '@/domain/priorities';
import { ROTATION_COLOR_ON_MAP } from '@/domain/sim';
import { buildVerdict, type Verdict } from '@/domain/verdict';
import { inputsFromDefaults } from '@/lib/economics';
import type { CropId, DepthId, RotationId } from '@/lib/types';
import { Button, Card, DataBadge, Note, cn } from '@/ui/kit';
import { CropIcon } from '@/ui/crops';
import { Farmer } from '@/ui/farmer/Farmer';
import { PlantingIntent } from './result/PlantingIntent';
import { DistrictPlan } from './result/DistrictPlan';
import { Options } from './result/Options';
import { WhatIf } from './result/WhatIf';
import { FieldSim } from './result/FieldSim';
import { FieldCalendar, YearStrip } from './result/Charts';
import { FieldTerrain } from './result/FieldTerrain';
import { RightNow } from './result/RightNow';
import { Fertilizer } from './result/Fertilizer';
import { Sowing } from './result/Sowing';
import { SoilHealth } from './result/SoilHealth';
import { AgentCard, Details } from './result/Details';
import { Greenness } from './result/Greenness';
import { showFor, visible, type Mode, type SectionId } from '@/domain/sections';

/** The answer, simplest first: what suits this land, why, what to do next. Everything else is below it. */
export function Result() {
  const { t, tx, num } = useT();
  const core = useStore((s) => s.core)!;
  const parcels = useStore((s) => s.parcels);
  const locationId = useStore((s) => s.locationId);
  const distanceKm = useStore((s) => s.distanceKm);
  const answers = useStore((s) => s.answers);
  const prefs = useStore((s) => s.prefs);
  const go = useStore((s) => s.go);
  const reset = useStore((s) => s.reset);
  const setQuestion = useStore((s) => s.setQuestion);
  const district = useDistrict(locationId);
  const [asRainfed, setAsRainfed] = useState(false);
  const depth = depthFor(answers);
  const location = core.site.locations.find((l) => l.id === locationId);

  const verdict = useMemo(() => {
    if (district.status !== 'ready') return null;
    const weights = weightsFor(answers.priority ?? 'balanced', inputsFromDefaults(core.defaults).weights);
    return buildVerdict(core.site, core.defaults, district.data.results, depth, weights);
  }, [district, answers.priority, core, depth]);

  const irrigated = answers.water === 'irrigated' && !asRainfed;
  const recId = irrigated ? null : (verdict?.decision.recommended as RotationId | null | undefined) ?? null;

  // The field on the map takes the colour of the suggested rotation.
  useEffect(() => {
    withMap((m) => {
      m.setField(parcels, recId ? ROTATION_COLOR_ON_MAP[recId] : undefined);
      m.fitField(fieldPolygons(parcels), { orbit: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId]);
  // Folding the window shows the map: fly to the field so it is what the farmer sees.
  const panelOpen = useStore((s) => s.sheetOpen);
  const sim = useStore((s) => s.sim);
  useEffect(() => {
    if (!panelOpen && !sim) withMap((m) => m.fitField(fieldPolygons(parcels), { orbit: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  if (!location) return <Note tone="warn">{t('loadFailed')}</Note>;
  if (district.status === 'loading') return <p className="py-8 text-center text-lg text-muted" role="status">{t('loading')}</p>;
  if (district.status === 'error' || !verdict) return <Note tone="bad">{t('loadFailed')}<Button className="mt-2" onClick={() => window.location.reload()}>{t('retry')}</Button></Note>;

  const { results, smap, agent } = district.data;
  const depthLabel = tx(core.site.depth_classes.find((d) => d.id === depth)?.label);
  const isPilot = parcels[0]?.source === 'pilot';

  const irrigatedOnly = (el: ReactNode) => (irrigated ? null : el);
  const sections: Section[] = [
    {
      id: 'summary', key: 'secSummary', icon: Star,
      body: irrigated ? (
        <Card className="grid gap-3 border-2 border-water/40 bg-water-soft">
          <h1 className="text-2xl font-black leading-tight">{t('irrTitle')}</h1>
          <p className="text-lg leading-snug">{t('irrBody')}</p>
          <Button onClick={() => setAsRainfed(true)}>{t('irrSeeAnyway')}</Button>
        </Card>
      ) : (
        <>
          {answers.water === 'irrigated' && <Note tone="warn" icon={<Info size={20} />}>{t('irrShown')}</Note>}
          {answers.water === 'limited' && <Note tone="info" icon={<Info size={20} />}>{t('qWaterSub')}</Note>}
          <Hero verdict={verdict} locationId={locationId} depth={depth} />
          <OtherChoices verdict={verdict} />
          <PlantingIntent verdict={verdict} />
          <DistrictPlan verdict={verdict} />
          <Blocked verdict={verdict} />
          <Note tone="info" icon={<Info size={20} />}>
            {!isPilot && distanceKm !== null && <b>{t('covered', { name: location.name, km: num(distanceKm, distanceKm < 10 ? 1 : 0) })} </b>}
            {t('coveredNote')}
          </Note>
        </>
      ),
    },
    { id: 'options', key: 'secOptions', icon: Columns3, body: irrigatedOnly(<Options verdict={verdict} />) },
    { id: 'climates', key: 'secClimates', icon: ChartScatter, body: irrigatedOnly(<YearStrip results={results} depth={depth} />) },
    { id: 'twoYears', key: 'secTwoYears', icon: CirclePlay, body: irrigatedOnly(<FieldSim results={results} depth={depth} />) },
    { id: 'calendar', key: 'secCalendar', icon: CalendarRange, body: irrigatedOnly(<FieldCalendar results={results} depth={depth} />) },
    { id: 'whatIf', key: 'secWhatIf', icon: CloudSun, body: irrigatedOnly(<WhatIf verdict={verdict} locationId={location.id} />) },
    // Terrain and runoff matter for every field, irrigated or not.
    { id: 'terrain', key: 'secTerrain', icon: Mountain, body: <FieldTerrain /> },
    { id: 'now', key: 'secNow', icon: Gauge, body: <RightNow smap={smap} location={location} /> },
    {
      id: 'fertilizer', key: 'secFertilizer', icon: Sprout,
      body: <>{irrigated && <Note tone="info">{t('fertIrrigatedNote')}</Note>}<Fertilizer results={results} rotationId={recId} /></>,
    },
    { id: 'sowing', key: 'secSowing', icon: Shovel, body: <Sowing rotationId={recId} /> },
    { id: 'soilHealth', key: 'secSoilHealth', icon: Layers, body: <SoilHealth results={results} verdict={verdict} /> },
    { id: 'greenness', key: 'secGreenness', icon: Leaf, body: isPilot ? null : <Greenness /> },
    { id: 'ai', key: 'secAi', icon: Sparkles, body: agent?.guards.passed && agent.report ? <AgentCard agent={agent} /> : null },
    { id: 'details', key: 'secDetails', icon: BookOpen, body: <Details verdict={verdict} results={results} /> },
  ].filter((x) => x.body !== null && visible(prefs, x.id as SectionId)) as Section[];

  return (
    // One column the width of the panel: a long word or a row of buttons may not widen the page on a phone.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <header className="grid">
        <p className="flex items-start gap-1.5 text-[15px] font-bold leading-snug text-muted md:text-base">
          <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> <span>{t('resFor', { name: `${location.name}, ${location.province}`, depth: depthLabel })}</span>
        </p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" onClick={() => { setQuestion(0); go('questions'); }} className="flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary md:text-base"><Pencil size={16} /> {t('editAnswers')}</button>
          <button type="button" onClick={() => { reset(); go('find'); }} className="flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary md:text-base"><MapPin size={16} /> {t('newField')}</button>
        </div>
      </header>
      <Sections sections={sections} />
    </div>
  );
}

type SectionKey = 'secSummary' | 'secOptions' | 'secClimates' | 'secTwoYears' | 'secCalendar' | 'secWhatIf' | 'secTerrain'
  | 'secNow' | 'secFertilizer' | 'secSowing' | 'secSoilHealth' | 'secGreenness' | 'secAi' | 'secDetails';
interface Section { id: SectionId; key: SectionKey; icon: typeof Star; body: ReactNode }

/**
 * The result as a menu: one subject at a time instead of one long page. A list
 * on the left of a wide window, a row of chips on a phone; each subject ends
 * with a button to the next one, so it can still be read in order.
 */
function Sections({ sections }: { sections: Section[] }) {
  const { t } = useT();
  const active = useStore((s) => s.section);
  const setActive = useStore((s) => s.setSection);
  const nav = useRef<HTMLElement>(null);
  const i = Math.max(0, sections.findIndex((s) => s.id === active));
  const current = sections[i];
  const next = sections[i + 1];

  const open = (id: SectionId) => setActive(id);
  // Whoever opens a section (the menu or the farmer's answer): back to the top, chip in view on a phone.
  useEffect(() => {
    nav.current?.parentElement?.closest('.thin-scroll')?.scrollTo({ top: 0 });
    nav.current?.querySelector(`[data-sec="${current.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [current.id]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="grid gap-2 md:sticky md:top-0">
      <ModeSwitch />
      <nav ref={nav} aria-label={t('secMenu')}
        className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-paper px-4 py-2 [scrollbar-width:none] md:mx-0 md:grid md:max-h-[calc(100dvh-15rem)] md:gap-0.5 md:overflow-y-auto md:p-0">
        {sections.map((s) => {
          const Icon = s.icon;
          const on = s.id === current.id;
          return (
            <button key={s.id} type="button" data-sec={s.id} onClick={() => open(s.id)} aria-current={on ? 'page' : undefined}
              className={cn('flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-3.5 text-left text-[15px] font-bold transition md:min-h-10 md:w-full md:py-1.5',
                on ? 'bg-primary text-white' : 'bg-canvas text-ink hover:bg-primary-soft md:bg-transparent')}>
              <Icon size={18} aria-hidden="true" className={on ? 'text-gold' : 'text-primary'} />
              <span className="whitespace-nowrap md:whitespace-normal">{t(s.key)}</span>
            </button>
          );
        })}
      </nav>
      </div>
      <div key={current.id} className="grid max-w-3xl animate-fade gap-5">
        {current.body}
        {next && (
          <Button variant="primary" size="lg" onClick={() => open(next.id)} className="w-full md:w-auto md:justify-self-end" icon={<ChevronRight size={22} />}>
            {t('secNext', { s: t(next.key) })}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Simple or advanced, one tap away; the full list of sections is in the settings. */
function ModeSwitch() {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const setProfileOpen = useStore((s) => s.setProfileOpen);
  const pick = (mode: Mode) => setPrefs({ mode, show: showFor(mode) });
  return (
    <div className="flex items-center gap-2">
      <div role="radiogroup" aria-label={t('modeLabel')} className="flex flex-1 rounded-2xl bg-canvas p-1">
        {(['simple', 'advanced'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={prefs.mode === m} onClick={() => pick(m)}
            className={cn('min-h-10 flex-1 rounded-xl px-3 text-[15px] font-extrabold', prefs.mode === m ? 'bg-white text-primary shadow-sm' : 'text-muted')}>
            {t(m === 'simple' ? 'modeSimple' : 'modeAdvanced')}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setProfileOpen(true)} aria-label={t('settings')} title={t('settings')}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-canvas text-primary hover:bg-primary-soft"><Settings2 size={20} /></button>
    </div>
  );
}

function closeText(v: Verdict, t: ReturnType<typeof useT>['t'], tx: ReturnType<typeof useT>['tx']): string {
  if (v.closeCall && v.runnerUp) return t('recClose', { r: tx(v.runnerUp.rotation.label) });
  return v.runnerUp ? t('recNotClose') : t('recOnly');
}

function Hero({ verdict, locationId, depth }: { verdict: Verdict; locationId: string | null; depth: DepthId }) {
  const { t, tx, lang } = useT();
  const priority = useStore((s) => s.answers.priority);
  const history = useStore((s) => s.answers.history);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const rec = verdict.recommended;
  const explainFile = useExplain(locationId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { window.speechSynthesis?.cancel(); audioRef.current?.pause(); }, []);

  const next = useSeason(verdict, history);
  if (!rec || !next) return <Note tone="bad" icon={<Ban size={20} />}>{t('recNone')}</Note>;
  const crop = t(`crop_${next.crop}` as Key);
  const thenLine = next.wheatNow ? t('heroThenChoice', { crop: t(`crop_${next.then}` as Key).toLocaleLowerCase(lang) }) : t('heroThenWheat');
  const why = t(`why_${rec.ranked.driver}` as Key);
  // Why this crop, in plain words: facts from the engine, worded by the local model (or the fact sentences).
  const explain = explainFile.status === 'ready' && explainFile.data
    ? explainFile.data.explanations[depth]?.[rec.rotation.id as RotationId]?.[lang] ?? null : null;
  const close = closeText(verdict, t, tx);
  const blocked = verdict.blocked.map((b) => `${tx(b.rotation.label)}: ${b.ranked.blocked.map((r) => t(`block_${r}` as Key)).join(' ')}`);
  const summary = [
    `${t('recTitle')}: ${t('heroSeason', { y: next.harvestYear })} ${crop}. ${thenLine}`,
    why, explain?.text ?? '', close,
    blocked.length ? `${t('recBlocked')}: ${blocked.join(' ')}` : t('noBlocked'),
    translate(lang, 'supports'),
  ].join(' ');

  const speak = () => {
    // The guide's recorded voice (ElevenLabs, made at build time) when there is a clip; the browser voice otherwise.
    if (explain?.audio) {
      if (speaking) { audioRef.current?.pause(); setSpeaking(false); return; }
      const a = audioRef.current ?? new Audio();
      audioRef.current = a;
      a.src = dataUrl(explain.audio);
      a.onended = a.onerror = () => setSpeaking(false);
      a.play().then(() => setSpeaking(true), () => setSpeaking(false));
      return;
    }
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(summary);
    u.lang = lang === 'tr' ? 'tr-TR' : 'en-GB';
    u.rate = 0.92;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  const share = async () => {
    const text = `Arksus · ${summary}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    } catch { /* the farmer closed the share sheet */ }
  };

  return (
    <section aria-labelledby="rec-title" className="animate-rise rounded-[1.75rem] bg-gradient-to-br from-primary-strong to-primary p-5 text-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id="rec-title" className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">{t('recTitle')}</p>
          <p className="mt-2 text-base font-bold text-white/85">{t('heroSeason', { y: next.harvestYear })}</p>
        </div>
        {/* The guide reads the suggestion aloud with "Listen". */}
        <Farmer mood={speaking ? 'talking' : 'idle'} size={58} title={t('farmerName')} className="-mt-1 shrink-0" />
      </div>
      <p className="mt-1 flex items-center gap-3 text-[2.4rem] font-black leading-[1.05]"><CropIcon crop={next.crop} size={40} /> {crop}</p>
      <p className="mt-1.5 text-base text-white/85">{thenLine}</p>
      <p className="mt-3 text-xl font-semibold leading-snug">{why}</p>
      {explain && (
        <div className="mt-3 rounded-2xl bg-white/12 px-3.5 py-3">
          <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.06em] text-gold">
            <Sparkles size={16} /> {t('explainTitle', { crop })} <DataBadge type="model" />
          </p>
          <ul className="mt-2 space-y-1.5 text-base leading-snug">
            {explain.sentences.map((s, i) => <li key={i}>{s.text}</li>)}
          </ul>
          <p className="mt-2 text-xs text-white/70">{t(explain.source === 'model' ? 'explainByModel' : 'explainByFacts')}</p>
        </div>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-white/85">
        {t('recDriver', { d: t(`crit_${rec.ranked.driver}` as Key) })} <DataBadge type="model" />
        <span aria-hidden="true">·</span>
        {priority && priority !== 'balanced'
          ? <>{t('yourPriority', { p: t(`prio_${priority}` as Key) })} <DataBadge type="user" /></>
          : <>{t('teamPriority')} <DataBadge type="assumption" /></>}
      </p>
      <p className={cn('mt-3 rounded-2xl px-3.5 py-2.5 text-base font-semibold leading-snug', verdict.closeCall ? 'bg-gold text-primary-strong' : 'bg-white/14')}>{close}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(explain?.audio || 'speechSynthesis' in window) && (
          <button type="button" onClick={speak} aria-pressed={speaking} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-primary-strong active:scale-[0.98]">
            {speaking ? <Square size={18} fill="currentColor" /> : <Volume2 size={20} />} {speaking ? t('stopListen') : t('listen')}
          </button>
        )}
        <button type="button" onClick={share} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/16 px-4 text-base font-bold active:scale-[0.98]">
          <Share2 size={19} /> {t('share')}
        </button>
        {copied && <span role="status" className="self-center text-sm">{t('shared')}</span>}
      </div>
    </section>
  );
}

const cropNote = (c: CropId): Key => (c === 'fallow' ? 'cropNote_fallow' : c === 'wheat' ? 'cropNote_wheat' : 'cropNote_legume');

/** The coming season for this field: the suggested sequence laid on what the farmer said was last on it. */
function useSeason(verdict: Verdict, history: ReturnType<typeof useStore.getState>['answers']['history']): NextSeason | null {
  return useMemo(() => nextSeason(stageOf(history), verdict, harvestYears(new Date())[2]), [verdict, history]);
}

/**
 * Other crops that also pass the guardrails for the first-year slot. When wheat
 * is due now, the first-year choice is the year after, so the suggested crop
 * is listed here as well.
 */
function OtherChoices({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  const history = useStore((s) => s.answers.history);
  const next = useSeason(verdict, history);
  if (!next) return null;
  const practice = practiceOf(history);
  const items: { crop: CropId; tag: Key; best?: boolean }[] = [
    ...(next.wheatNow ? [{ crop: next.then, tag: 'altBest' as Key, best: true }] : []),
    ...next.alternatives.map((a) => ({ crop: a.crop, tag: (a.close ? 'altClose' : 'altLess') as Key })),
  ];
  return (
    <Card className="grid gap-3">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarDays size={22} className="text-primary" aria-hidden="true" />
        {next.wheatNow ? t('altTitleLater', { y: next.harvestYear + 1 }) : t('altTitle')}</h2>
      <p className="text-[15px] leading-snug text-muted">{t(next.wheatNow ? 'altSubLater' : 'altSub')}</p>
      {items.length ? (
        <ul className="grid gap-2">
          {items.map((it) => (
            <li key={it.crop} className={cn('flex items-center gap-3 rounded-2xl p-3', it.best ? 'bg-primary-soft' : 'bg-canvas')}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-primary"><CropIcon crop={it.crop} size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-extrabold leading-tight">{t(`crop_${it.crop}` as Key)}</span>
                <span className="block text-sm leading-snug text-muted">{t(cropNote(it.crop))}</span>
              </span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', it.best ? 'bg-primary text-white' : 'bg-white text-muted')}>{t(it.tag)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-[15px]">{t('altNone')}</p>}
      {practice !== 'unknown' && <p className="text-[15px] leading-snug text-muted">{t(`practice_${practice}` as Key)}</p>}
    </Card>
  );
}

/** Options the guardrails took out are always named, with the reason. */
function Blocked({ verdict }: { verdict: Verdict }) {
  const { t, tx } = useT();
  if (!verdict.blocked.length) return <Note tone="good">{t('noBlocked')}</Note>;
  return (
    <Card className="grid gap-2 border-bad/30 bg-bad-soft/50">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-bad"><Ban size={20} aria-hidden="true" /> {t('recBlocked')}</h2>
      <ul className="grid gap-2">
        {verdict.blocked.map((b) => (
          <li key={b.rotation.id} className="text-base leading-snug">
            <b>{tx(b.rotation.label)}</b>
            {b.ranked.blocked.map((r) => <span key={r} className="block text-[15px] text-ink/80">{t(`block_${r}` as Key)} <DataBadge type="model" /></span>)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
