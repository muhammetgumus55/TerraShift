// One store for the whole flow: where the farmer is, the field, the answers.
// The map reads it too, so the panel and the 3D view never drift apart.

import { create } from 'zustand';
import type { SoilTest } from '@/lib/fertilizer';
import type { DepthId, WaterRegime } from '@/lib/types';
import type { Core } from '@/data/api';
import type { Parcel } from '@/domain/field';
import { EMPTY_HISTORY, type History, type PastCrop } from '@/domain/history';
import type { PriorityId } from '@/domain/priorities';
import { DEFAULT_PREFS, normalizePrefs, type Prefs, type SectionId } from '@/domain/sections';
import { currentAccount, logout, savePrefs, type Account } from '@/domain/auth';

export type Lang = 'tr' | 'en';
export type Step = 'welcome' | 'find' | 'questions' | 'analyzing' | 'result';
export type FindMode = 'menu' | 'tap' | 'draw' | 'search' | 'number' | 'pilot';

export interface Answers {
  water: WaterRegime | null;
  history: History;
  /** 'unknown' = the farmer does not know: medium is used and the page says so. */
  depth: DepthId | 'unknown' | null;
  priority: PriorityId | null;
  hasSoilTest: boolean | null;
  soilTest: SoilTest;
}

export const EMPTY_ANSWERS: Answers = {
  water: null, history: EMPTY_HISTORY, depth: null, priority: null, hasSoilTest: null, soilTest: {},
};

export const QUESTION_IDS = ['water', 'history', 'depth', 'priority', 'soil'] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

interface State {
  lang: Lang;
  step: Step;
  question: number;
  findMode: FindMode;
  core: Core | null;
  coreError: boolean;
  parcels: Parcel[];
  /** Pilot district whose results stand for the field. */
  locationId: string | null;
  distanceKm: number | null;
  answers: Answers;
  /** Panel folded away on a phone so the map is visible. */
  sheetOpen: boolean;
  /** The two-year view is playing on the map. */
  sim: boolean;
  /** Simple or advanced result, and the sections picked by hand. */
  prefs: Prefs;
  /** Device-only trial account (domain/auth.ts); null when signed out. */
  user: string | null;
  profileOpen: boolean;
  /** Result section on screen; the farmer's answers can open one. */
  section: SectionId;
  askOpen: boolean;

  setLang(lang: Lang): void;
  setCore(core: Core): void;
  setCoreError(): void;
  go(step: Step): void;
  setQuestion(i: number): void;
  setFindMode(m: FindMode): void;
  setField(parcels: Parcel[], locationId: string | null, distanceKm: number | null): void;
  answer<K extends keyof Answers>(key: K, value: Answers[K]): void;
  setHistory(i: 0 | 1 | 2, crop: PastCrop | null): void;
  setSheetOpen(open: boolean): void;
  setSim(on: boolean): void;
  setPrefs(p: Prefs): void;
  signedIn(a: Account): void;
  signOut(): void;
  setProfileOpen(open: boolean): void;
  setSection(id: SectionId): void;
  setAskOpen(open: boolean): void;
  reset(): void;
}

const KEY = 'nobetsu.v2';
type Saved = Pick<State, 'lang' | 'step' | 'parcels' | 'locationId' | 'distanceKm' | 'answers' | 'prefs'>;

function load(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const s = JSON.parse(raw) as Partial<Saved>;
    // A half-finished run restarts at the questions; a finished one reopens on its result.
    const done = s.step === 'result' && Array.isArray(s.parcels) && s.parcels.length > 0 && !!s.locationId;
    return { ...s, step: done ? 'result' : 'welcome', answers: { ...EMPTY_ANSWERS, ...s.answers } };
  } catch { return {}; }
}

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'tr' || q === 'en') return q;
    return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'tr';
  } catch { return 'tr'; }
}

const saved = typeof localStorage === 'undefined' ? {} : load();
const account = currentAccount();

export const useStore = create<State>((set) => ({
  lang: saved.lang ?? initialLang(),
  step: saved.step ?? 'welcome',
  question: 0,
  findMode: 'menu',
  core: null,
  coreError: false,
  parcels: saved.parcels ?? [],
  locationId: saved.locationId ?? null,
  distanceKm: saved.distanceKm ?? null,
  answers: saved.answers ?? EMPTY_ANSWERS,
  sheetOpen: true,
  sim: false,
  prefs: account?.prefs ?? normalizePrefs(saved.prefs ?? DEFAULT_PREFS),
  user: account?.username ?? null,
  profileOpen: false,
  section: 'summary',
  askOpen: false,

  setLang: (lang) => set({ lang }),
  setCore: (core) => set({ core, coreError: false }),
  setCoreError: () => set({ coreError: true }),
  // A new analysis opens on the suggestion, not on whatever section was last read.
  go: (step) => set((s) => ({ step, sheetOpen: true, sim: false, findMode: step === 'find' ? 'menu' : s.findMode, section: step === 'analyzing' ? 'summary' : s.section })),
  setQuestion: (question) => set({ question }),
  setFindMode: (findMode) => set({ findMode }),
  setField: (parcels, locationId, distanceKm) => set({ parcels, locationId, distanceKm }),
  answer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
  setHistory: (i, crop) => set((s) => {
    const history = [...s.answers.history] as History;
    history[i] = crop;
    return { answers: { ...s.answers, history } };
  }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  // On a phone the panel steps aside so the field is visible while it plays.
  setSim: (sim) => set({ sim, sheetOpen: !sim }),
  // A signed-in farmer's settings follow the account.
  setPrefs: (prefs) => set((s) => { if (s.user) savePrefs(s.user, prefs); return { prefs }; }),
  signedIn: (a) => set({ user: a.username, prefs: a.prefs }),
  signOut: () => { logout(); set({ user: null }); },
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setSection: (section) => set({ section }),
  setAskOpen: (askOpen) => set({ askOpen }),
  reset: () => set({ step: 'welcome', question: 0, findMode: 'menu', sim: false, parcels: [], locationId: null, distanceKm: null, answers: EMPTY_ANSWERS }),
}));

// Kept on this device only: no account, nothing sent anywhere.
useStore.subscribe((s) => {
  try {
    const out: Saved = { lang: s.lang, step: s.step, parcels: s.parcels, locationId: s.locationId, distanceKm: s.distanceKm, answers: s.answers, prefs: s.prefs };
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch { /* storage blocked (private tab): the page still works */ }
});

/** Depth class the engine is asked for: "I don't know" falls back to medium. */
export const depthFor = (a: Answers): DepthId => (a.depth && a.depth !== 'unknown' ? a.depth : 'medium');
