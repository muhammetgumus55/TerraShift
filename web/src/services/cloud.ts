// Supabase: email + password sign-in, consent log, the farmer's own saved answers, district planting intent.
// Tables and access rules: supabase/migrations/20261115_consent_profiles_intents.sql (owner: Gümüş).
// What may be stored is fixed by docs/legal/: il + ilçe only, never the field's shape or GPS.
// Without VITE_SUPABASE_* (tests, a fork) `cloud` is null and the site keeps its device-only trial sign-in.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CONSENT_VERSION, NOTICE_VERSION, type ConsentKind, type ConsentRow, type Intent } from '@/domain/consent';
import type { TotalRow } from '@/domain/districtPlan';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloud: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } })
  : null;

export interface CloudUser { id: string; name: string; email: string }

export const toCloudUser = (u: User): CloudUser => ({
  id: u.id,
  name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? ''),
  email: u.email ?? '',
});

const need = () => { if (!cloud) throw new Error('cloud off'); return cloud; };

export type AuthFail = 'invalid_credentials' | 'user_exists' | 'weak_password' | 'not_confirmed' | 'rate_limit' | 'other';

/** Supabase error codes → the few cases the page explains in words. */
export function authFail(e: { code?: string; message?: string } | null | undefined): AuthFail {
  const c = e?.code ?? '';
  if (c === 'invalid_credentials') return 'invalid_credentials';
  if (c === 'user_already_exists' || c === 'email_exists') return 'user_exists';
  if (c === 'weak_password') return 'weak_password';
  if (c === 'email_not_confirmed') return 'not_confirmed';
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit') return 'rate_limit';
  return 'other';
}

export async function signUpEmail(email: string, password: string): Promise<{ confirmed: boolean }> {
  const { data, error } = await need().auth.signUp({ email, password });
  if (error) throw error;
  // Supabase answers an already used address with a user that has no identities (no error, by design).
  if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists' };
  return { confirmed: !!data.session };
}

export async function signInEmail(email: string, password: string): Promise<void> {
  const { error } = await need().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> { await need().auth.signOut(); }

export async function loadConsents(): Promise<ConsentRow[]> {
  const { data, error } = await need().from('consents').select('id, kind, version, granted, created_at');
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

/** Appends to the consent log (never edits it: the history is the proof). */
export async function recordConsents(items: { kind: ConsentKind; granted: boolean }[]): Promise<void> {
  if (!items.length) return;
  const rows = items.map((x) => ({ kind: x.kind, granted: x.granted, version: x.kind === 'notice_read' ? NOTICE_VERSION : CONSENT_VERSION }));
  const { error } = await need().from('consents').insert(rows);
  if (error) throw error;
}

export interface SavedProfile { answers: unknown; prefs: unknown; location_id: string | null; il: string | null; ilce: string | null }

export async function loadProfile(): Promise<SavedProfile | null> {
  const { data, error } = await need().from('profiles').select('answers, prefs, location_id, il, ilce').maybeSingle();
  if (error) throw error;
  return (data as SavedProfile | null) ?? null;
}

export async function saveProfile(userId: string, p: SavedProfile): Promise<void> {
  const { error } = await need().from('profiles').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadIntent(year: number): Promise<Intent | null> {
  const { data, error } = await need().from('planting_intents').select('harvest_year, il, ilce, crop, irrigation').eq('harvest_year', year).maybeSingle();
  if (error) throw error;
  return (data as Intent | null) ?? null;
}

/** One record per farmer and harvest year; the database refuses it without district_stats consent. */
export async function saveIntent(userId: string, i: Intent): Promise<void> {
  const { error } = await need().from('planting_intents').upsert({ user_id: userId, ...i, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Public district totals for a harvest year: only districts with >= 5 records, no user ids (works signed out). */
export async function loadDistrictTotals(year: number): Promise<TotalRow[]> {
  const { data, error } = await need().rpc('district_totals', { year });
  if (error) throw error;
  return (data ?? []) as TotalRow[];
}

/** Deletes the account; every row above goes with it (on delete cascade). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await need().rpc('delete_my_account');
  if (error) throw error;
  await need().auth.signOut();
}
