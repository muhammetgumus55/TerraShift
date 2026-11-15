// The farmer's answers. Until the AI agent is connected, questions are matched
// to a fixed set of topics by keywords (Turkish and English), and the answer is
// built from what the page already knows: the suggestion for this field, the
// glossary, where the data comes from. Nothing is sent anywhere. The agent can
// replace `answer` with the same input and output.

import type { CropId } from '@/lib/types';
import type { Key } from '@/i18n';
import type { SectionId } from './sections';

export interface FieldContext {
  location: string;
  harvestYear: number;
  crop: CropId;
  then: CropId;
  wheatNow: boolean;
  driver: 'value' | 'yield' | 'soil' | 'water';
  alternatives: { crop: CropId; close: boolean }[];
  blocked: { crop: CropId; reasons: string[] }[];
  irrigated: boolean;
}

export type Action = { kind: 'section'; id: SectionId } | { kind: 'settings' } | { kind: 'find' };
export interface Reply { text: string; action?: Action; suggest?: boolean }

type T = (k: Key, vars?: Record<string, string | number>) => string;

/** Lower case, Turkish letters folded to ASCII, punctuation to spaces, padded for whole-word checks. */
export function normalize(s: string): string {
  const folded = s.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c);
  return ` ${folded.replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const has = (text: string, kw: string) => (kw.length <= 3 ? text.includes(` ${kw} `) : text.includes(kw));

type Topic =
  | 'plant' | 'why' | 'alternatives' | 'data' | 'trust' | 'settings' | 'account' | 'irrigation'
  | 'fertilizer' | 'sowing' | 'field' | 'weather' | 'hello' | 'thanks';

// Order matters on a tie: the more specific topic comes first ("başka ne ekebilirim" is about alternatives).
const TOPICS: Record<Topic, string[]> = {
  why: ['neden', 'nicin', 'niye', 'sebep', 'why', 'reason', 'because'],
  alternatives: ['baska', 'alternatif', 'diger', 'secenek', 'else', 'other', 'alternative', 'option'],
  plant: ['ne ek', 'ne dik', 'hangi urun', 'oner', 'tavsiye', 'ekeyim', 'ekmeli', 'ekecegim', 'what should', 'what to plant', 'which crop', 'recommend', 'suggest'],
  data: ['veri', 'kaynak', 'nereden', 'nasil hesap', 'nasil calis', 'model', 'nasa', 'uydu', 'data', 'source', 'how does', 'how do you', 'satellite'],
  trust: ['dogru mu', 'guven', 'emin', 'yanlis', 'hata', 'accurate', 'trust', 'sure', 'reliable', 'wrong'],
  settings: ['basit', 'gelismis', 'ayar', 'mod', 'bolum', 'simple', 'advanced', 'setting', 'section'],
  account: ['giris', 'hesap', 'sifre', 'uye', 'profil', 'login', 'sign in', 'account', 'password', 'profile'],
  irrigation: ['sulu', 'sulama', 'sulan', 'irrigat'],
  fertilizer: ['gubre', 'fosfor', 'fertili', 'phosphor'],
  sowing: ['nasil ekil', 'tohum', 'ekim zaman', 'ne zaman ek', 'derinlik', 'sira arasi', 'sow', 'seed', 'when to plant'],
  field: ['tarla sec', 'parsel', 'ada ', 'konum', 'harita', 'baska tarla', 'my field', 'map', 'parcel', 'location'],
  weather: ['yagmur', 'yagis', 'kurak', 'iklim', 'kuraklik', 'rain', 'drought', 'climate', 'dry year'],
  hello: ['merhaba', 'selam', 'gunaydin', 'iyi gunler', 'hello', 'hi', 'hey'],
  thanks: ['tesekkur', 'sagol', 'sag ol', 'eyvallah', 'thank', 'thanks'],
};

export const GLOSSARY: Record<string, string[]> = {
  et: ['evapotranspirasyon', 'evapotranspiration', 'et', 'et0', 'terleme', 'transpiration'],
  water_balance: ['su dengesi', 'water balance'],
  available_water: ['yarayisli', 'available water', 'awc'],
  field_capacity_vs_saturation: ['tarla kapasitesi', 'doygunluk', 'field capacity', 'saturation'],
  soil_moisture_anomaly: ['toprak nemi', 'nem sapma', 'anomali', 'soil moisture', 'anomaly'],
  ph: ['ph', 'asidik', 'bazik', 'alkali', 'acidic'],
  organic_carbon: ['organik karbon', 'organik madde', 'organic carbon', 'organic matter'],
  cec: ['kdk', 'cec', 'katyon', 'cation'],
  p10_p50_p90: ['p10', 'p50', 'p90', 'ortanca', 'median', 'percentile', 'yuzdelik'],
  fallow_storage_efficiency: ['saklama verimi', 'su saklama', 'storage efficiency'],
  nitrogen_fixation: ['azot bagla', 'nitrogen fix', 'rhizobium', 'nodul', 'azot', 'nitrogen'],
  wind_exposure: ['ruzgar', 'erozyon', 'wind', 'erosion'],
};

const CROPS: Record<Exclude<CropId, never>, string[]> = {
  fallow: ['nadas', 'fallow'],
  chickpea: ['nohut', 'chickpea'],
  lentil: ['mercimek', 'lentil'],
  wheat: ['bugday', 'wheat'],
} as Record<CropId, string[]>;

const score = (text: string, kws: string[]) => kws.reduce((s, k) => (has(text, k) ? s + k.trim().length : s), 0);

export const SUGGESTIONS: Key[] = ['askQ_plant', 'askQ_why', 'askQ_alt', 'askQ_data', 'askQ_p10'];

const cropNote = (c: CropId): Key => (c === 'fallow' ? 'cropNote_fallow' : c === 'wheat' ? 'cropNote_wheat' : 'cropNote_legume');

export function answer(question: string, ctx: FieldContext | null, t: T): Reply {
  const q = normalize(question);
  const crop = (c: CropId) => t(`crop_${c}` as Key);

  // A named crop is the most specific thing a question can be about.
  const named = (Object.keys(CROPS) as CropId[]).filter((c) => CROPS[c].some((k) => has(q, k)));
  const topics = (Object.keys(TOPICS) as Topic[]).map((k) => [k, score(q, TOPICS[k])] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const gloss = Object.entries(GLOSSARY).map(([k, kws]) => [k, score(q, kws)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const top = topics[0]?.[0];

  // "What is X?" goes to the glossary unless the question is plainly about something else.
  if (gloss.length && (!top || gloss[0][1] >= topics[0][1])) {
    const id = gloss[0][0];
    return { text: t('as_gloss', { term: t(`gl_${id}_t` as Key), def: t(`gl_${id}` as Key) }) };
  }

  if (named.length && ctx && top !== 'sowing' && top !== 'fertilizer') {
    const c = named.find((x) => x !== 'wheat') ?? named[0];
    if (c === 'wheat') return { text: t('as_crop_wheat') };
    const alt = ctx.alternatives.find((a) => a.crop === c);
    const blocked = ctx.blocked.find((b) => b.crop === c);
    const firstChoice = ctx.wheatNow ? ctx.then : ctx.crop;
    // "Neden nohut?" about the suggested crop asks for the reason, not the name again.
    if (c === firstChoice && top === 'why') {
      return { text: `${t('as_crop_rec', { crop: crop(c) })} ${t('as_why', { why: t(`why_${ctx.driver}` as Key), driver: t(`crit_${ctx.driver}` as Key) })}`, action: { kind: 'section', id: 'options' } };
    }
    if (c === firstChoice) return { text: `${t('as_crop_rec', { crop: crop(c) })} ${t(cropNote(c))}`, action: { kind: 'section', id: 'summary' } };
    if (alt) return { text: `${t('as_crop_alt', { crop: crop(c), tag: t(alt.close ? 'altClose' : 'altLess').toLocaleLowerCase() })} ${t(cropNote(c))}`, action: { kind: 'section', id: 'options' } };
    if (blocked) return { text: t('as_crop_blocked', { crop: crop(c), reason: blocked.reasons.join(' ') }), action: { kind: 'section', id: 'options' } };
  }

  switch (top) {
    case 'hello': return { text: t('as_hello'), suggest: true };
    case 'thanks': return { text: t('as_thanks') };
    case 'account': return { text: t('as_account'), action: { kind: 'settings' } };
    case 'settings': return { text: t('as_settings'), action: { kind: 'settings' } };
    case 'irrigation': return { text: t('as_irrigation') };
    case 'data': return { text: t('as_data'), action: { kind: 'section', id: 'details' } };
    case 'trust': return { text: t('as_trust') };
    case 'fertilizer': return { text: t('as_fert'), action: { kind: 'section', id: 'fertilizer' } };
    case 'sowing': return { text: t('as_sow'), action: { kind: 'section', id: 'sowing' } };
    case 'field': return { text: t('as_field'), action: { kind: 'find' } };
    case 'weather': return { text: t('as_weather'), action: { kind: 'section', id: 'whatIf' } };
    default: break;
  }

  if (top === 'plant' || top === 'why' || top === 'alternatives') {
    if (!ctx) return { text: t('as_noField'), action: { kind: 'find' } };
    if (top === 'why') {
      return { text: t('as_why', { why: t(`why_${ctx.driver}` as Key), driver: t(`crit_${ctx.driver}` as Key) }), action: { kind: 'section', id: 'options' } };
    }
    if (top === 'alternatives') {
      const alts = ctx.alternatives.length ? t('as_alt', { list: ctx.alternatives.map((a) => crop(a.crop)).join(', ') }) : t('as_altNone');
      const out = ctx.blocked.length ? ` ${t('as_blocked', { list: ctx.blocked.map((b) => crop(b.crop)).join(', ') })}` : '';
      return { text: alts + out, action: { kind: 'section', id: 'summary' } };
    }
    const then = ctx.wheatNow ? t('heroThenChoice', { crop: crop(ctx.then).toLocaleLowerCase() }) : t('heroThenWheat');
    return { text: t('as_plant', { y: ctx.harvestYear, crop: crop(ctx.crop), then, why: t(`why_${ctx.driver}` as Key) }), action: { kind: 'section', id: 'summary' } };
  }

  return { text: t('as_unknown'), suggest: true };
}
