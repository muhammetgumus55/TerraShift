// Account (Supabase email + password) state, apart from the main store so the device-only trial (domain/auth.ts) stays untouched.
// While signed in, the farmer's answers and settings are saved to their own profile row and restored
// on the next sign-in. The field's shape stays on the device: only il + ilçe leave it.

import { create } from 'zustand';
import {
  authFail, cloud, deleteMyAccount, loadConsents, loadProfile, recordConsents, saveProfile, signInEmail, signOutCloud,
  signUpEmail, toCloudUser, type AuthFail, type CloudUser,
} from '@/services/cloud';
import { districtOf, latestConsents, needsNotice, NO_CONSENTS, type ConsentKind, type ConsentState } from '@/domain/consent';
import { normalizePrefs } from '@/domain/sections';
import { EMPTY_ANSWERS, useStore, type Answers } from './store';

interface CloudState {
  /** False until Supabase has said whether a session exists. */
  ready: boolean;
  user: CloudUser | null;
  consents: ConsentState;
  /** True once the signed-in user's consent log has been read (the consent dialog waits for it). */
  consentsLoaded: boolean;
  error: string | null;
  /** null on success; otherwise why it failed. */
  signIn(email: string, password: string): Promise<AuthFail | null>;
  /**
   * Creates the account and records the two decisions taken on the form: the notice was read
   * (required) and the optional district consent. 'check_mail' when Supabase still asks for an
   * email confirmation (then the decisions are asked again after the first sign-in).
   */
  signUp(email: string, password: string, districtConsent: boolean): Promise<AuthFail | 'check_mail' | null>;
  /** True while sign-up is recording its consents: the consent dialog must not flash meanwhile. */
  signingUp: boolean;
  signOut(): Promise<void>;
  /** Appends decisions to the log and reloads the latest state. */
  decide(items: { kind: ConsentKind; granted: boolean }[]): Promise<void>;
  deleteAccount(): Promise<void>;
}

export const cloudEnabled = !!cloud;

export const useCloud = create<CloudState>((set, get) => ({
  ready: !cloud,
  user: null,
  consents: NO_CONSENTS,
  consentsLoaded: false,
  signingUp: false,
  error: null,
  signIn: async (email, password) => {
    set({ error: null });
    try { await signInEmail(email.trim(), password); return null; } catch (e) { return authFail(e as { code?: string }); }
  },
  signUp: async (email, password, districtConsent) => {
    set({ error: null, signingUp: true });
    try {
      if (!(await signUpEmail(email.trim(), password)).confirmed) return 'check_mail';
      await recordConsents([{ kind: 'notice_read', granted: true }, { kind: 'district_stats', granted: districtConsent }]);
      set({ consents: latestConsents(await loadConsents()), consentsLoaded: true });
      void syncProfile(true);
      return null;
    } catch (e) { return authFail(e as { code?: string }); }
    finally { set({ signingUp: false }); }
  },
  signOut: async () => { try { await signOutCloud(); } finally { set({ user: null, consents: NO_CONSENTS, consentsLoaded: false }); } },
  decide: async (items) => {
    await recordConsents(items);
    set({ consents: latestConsents(await loadConsents()) });
    if (!needsNotice(get().consents)) void syncProfile(true);
  },
  deleteAccount: async () => { await deleteMyAccount(); set({ user: null, consents: NO_CONSENTS, consentsLoaded: false }); },
}));

/** True when nothing has been answered on this device yet: then a saved profile may fill it in. */
const blank = (a: Answers) => a.water === null && a.depth === null && a.priority === null && a.hasSoilTest === null;

let restored = false;

/** First call after sign-in: restore a saved profile into an empty device, then save from here on. */
async function syncProfile(first = false) {
  const { user, consents } = useCloud.getState();
  if (!user || needsNotice(consents)) return;          // nothing is stored before the notice was read
  const st = useStore.getState();
  if (first && !restored) {
    restored = true;
    const saved = await loadProfile().catch(() => null);
    if (saved && blank(st.answers)) {
      useStore.setState({ answers: { ...EMPTY_ANSWERS, ...(saved.answers as Partial<Answers>) } });
      if (saved.prefs) useStore.setState({ prefs: normalizePrefs(saved.prefs) });
      return;
    }
  }
  const location = st.core?.site.locations.find((l) => l.id === st.locationId);
  const d = districtOf(st.parcels, location);
  await saveProfile(user.id, { answers: st.answers, prefs: st.prefs, location_id: st.locationId, il: d?.il ?? null, ilce: d?.ilce ?? null })
    .catch((e) => useCloud.setState({ error: (e as Error).message }));
}

if (cloud) {
  cloud.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ? toCloudUser(session.user) : null;
    const was = useCloud.getState().user?.id;
    useCloud.setState({ user: u, ready: true });
    if (!u) { restored = false; useCloud.setState({ consents: NO_CONSENTS, consentsLoaded: false }); return; }
    if (u.id !== was) {
      useCloud.setState({ consentsLoaded: false });
      // Supabase asks not to await other Supabase calls inside this callback.
      setTimeout(() => {
        if (useCloud.getState().signingUp) return;          // sign-up records and loads them itself
        loadConsents()
          .then((rows) => { useCloud.setState({ consents: latestConsents(rows), consentsLoaded: true }); return syncProfile(true); })
          .catch((e) => useCloud.setState({ error: (e as Error).message }));
      }, 0);
    }
  });

  // Save a moment after the farmer stops changing answers, settings or the field.
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (s.answers === prev.answers && s.prefs === prev.prefs && s.locationId === prev.locationId && s.parcels === prev.parcels) return;
    if (!useCloud.getState().user) return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncProfile(), 1500);
  });
}
