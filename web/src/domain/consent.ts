// Consent and the district record for the account sign-in (docs/legal/README.md). Owner: Gümüş.
// Pure logic, tested in consent.test.ts; services/cloud.ts talks to Supabase, state/cloud.ts holds the state.

import type { Parcel } from './field';
import type { CropId, Location, WaterRegime } from '@/lib/types';

/** Bump when docs/legal/aydinlatma-metni.md changes: the farmer sees the notice again. */
export const NOTICE_VERSION = 'aydinlatma-v1';
/** Bump when docs/legal/acik-riza-metni.md changes. */
export const CONSENT_VERSION = 'acik-riza-v1';
/**
 * The language-model consent stays closed until it is known who trains the model and where
 * (docs/legal/README.md, open items). Nothing is collected for it meanwhile.
 */
export const LLM_CONSENT_OPEN = false;

export type ConsentKind = 'notice_read' | 'district_stats' | 'llm_training';
export const CONSENT_KINDS: ConsentKind[] = ['notice_read', 'district_stats', 'llm_training'];

export interface ConsentRow { id?: number; kind: ConsentKind; version: string; granted: boolean; created_at: string }
export interface ConsentEntry { granted: boolean; version: string; at: string }
export type ConsentState = Record<ConsentKind, ConsentEntry | null>;

export const NO_CONSENTS: ConsentState = { notice_read: null, district_stats: null, llm_training: null };

/** The latest decision per kind (the log is append-only; newest wins, ties broken by id). */
export function latestConsents(rows: ConsentRow[]): ConsentState {
  const out: ConsentState = { ...NO_CONSENTS };
  const newer = (a: ConsentRow, b: ConsentRow) => a.created_at > b.created_at || (a.created_at === b.created_at && (a.id ?? 0) > (b.id ?? 0));
  const best: Partial<Record<ConsentKind, ConsentRow>> = {};
  for (const r of rows) if (CONSENT_KINDS.includes(r.kind) && (!best[r.kind] || newer(r, best[r.kind]!))) best[r.kind] = r;
  for (const k of CONSENT_KINDS) { const r = best[k]; if (r) out[k] = { granted: r.granted, version: r.version, at: r.created_at }; }
  return out;
}

/** The notice has to be read (again) when it was never acknowledged or its version changed. */
export const needsNotice = (s: ConsentState): boolean => !s.notice_read?.granted || s.notice_read.version !== NOTICE_VERSION;

/** A consent counts only for the version the farmer actually saw. */
export const hasConsent = (s: ConsentState, k: 'district_stats' | 'llm_training'): boolean =>
  !!s[k]?.granted && s[k]!.version === CONSENT_VERSION;

export interface District { il: string; ilce: string }

/**
 * Province and district of the field, never its shape: the registry's own names for a TKGM
 * parcel, otherwise the pilot district whose results stand for the field.
 */
export function districtOf(parcels: Parcel[], location: Location | undefined): District | null {
  const admin = parcels.find((p) => p.admin?.il && p.admin?.ilce)?.admin;
  if (admin) return { il: admin.il, ilce: admin.ilce };
  return location ? { il: location.province, ilce: location.name } : null;
}

/** Crops the database accepts (planting_intents.crop check); anything else is 'other'. */
export const INTENT_CROPS = ['wheat', 'barley', 'chickpea', 'lentil', 'fallow', 'sugar_beet', 'potato', 'onion', 'other'] as const;
export type IntentCrop = (typeof INTENT_CROPS)[number];
export const toIntentCrop = (c: CropId | string): IntentCrop => ((INTENT_CROPS as readonly string[]).includes(c) ? c as IntentCrop : 'other');

export interface Intent { harvest_year: number; il: string; ilce: string; crop: IntentCrop; irrigation: WaterRegime | null }
