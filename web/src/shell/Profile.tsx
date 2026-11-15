import { useEffect, useRef, useState } from 'react';
import { LogOut, Trash2, UserRound, X } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { currentAccount, deleteAccount, login, MIN_PASSWORD, register, type AuthError } from '@/domain/auth';
import { ADVANCED_ONLY, ALWAYS, isCustom, SECTION_IDS, showFor, type Mode, type SectionId } from '@/domain/sections';
import { Button, Choice, Note, cn } from '@/ui/kit';
import { cloudEnabled } from '@/state/cloud';
import { CloudAccount } from './CloudAccount';

const SECTION_KEY: Record<SectionId, Key> = {
  summary: 'secSummary', options: 'secOptions', climates: 'secClimates', twoYears: 'secTwoYears', calendar: 'secCalendar',
  whatIf: 'secWhatIf', terrain: 'secTerrain', now: 'secNow', fertilizer: 'secFertilizer', sowing: 'secSowing', soilHealth: 'secSoilHealth',
  greenness: 'secGreenness', ai: 'secAi', details: 'secDetails',
};

/** Profile and settings: a trial sign-in kept on this device, and how much of the result to show. */
export function Profile() {
  const { t } = useT();
  const setOpen = useStore((s) => s.setProfileOpen);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button, input')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [setOpen]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1f17]/55 p-2 backdrop-blur-[2px] md:p-6" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="profile-title"
        className="thin-scroll grid max-h-[calc(100dvh-1rem)] w-full max-w-xl animate-rise gap-5 overflow-y-auto rounded-[1.5rem] bg-paper p-4 shadow-panel md:max-h-[calc(100dvh-3rem)] md:p-6">
        <header className="flex items-center justify-between gap-3">
          <h2 id="profile-title" className="text-2xl font-black">{t('profileTitle')}</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-canvas"><X size={22} /></button>
        </header>
        {/* Supabase account (email + password) when configured; otherwise the device-only trial. */}
        {cloudEnabled ? <CloudAccount /> : <AccountBox />}
        <SettingsBox />
      </div>
    </div>
  );
}

function AccountBox() {
  const { t, lang } = useT();
  const user = useStore((s) => s.user);
  const signedIn = useStore((s) => s.signedIn);
  const signOut = useStore((s) => s.signOut);
  const prefs = useStore((s) => s.prefs);
  const locationId = useStore((s) => s.locationId);
  const site = useStore((s) => s.core?.site);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (user) {
    const account = currentAccount();
    const field = site?.locations.find((l) => l.id === locationId);
    const since = account ? new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'long' }).format(new Date(account.createdAt)) : null;
    return (
      <section className="grid gap-3 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-black uppercase text-white">{user[0]}</span>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{user}</p>
            {since && <p className="text-sm text-muted">{t('memberSince', { d: since })}</p>}
          </div>
        </div>
        <p className="text-[15px]">{field ? t('profileField', { name: `${field.name}, ${field.province}` }) : t('profileNoField')}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={signOut} icon={<LogOut size={18} />}>{t('signOut')}</Button>
          {confirmDelete ? (
            <Button variant="primary" className="bg-bad hover:bg-bad" onClick={() => { deleteAccount(user); signOut(); setConfirmDelete(false); }} icon={<Trash2 size={18} />}>{t('deleteConfirm')}</Button>
          ) : (
            <Button onClick={() => setConfirmDelete(true)} icon={<Trash2 size={18} />}>{t('deleteAccount')}</Button>
          )}
        </div>
        <p className="text-sm text-muted">{t('accountLocalNote')}</p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = tab === 'login' ? await login(name, pass) : await register(name, pass, prefs);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPass('');
    // A new account starts from the settings already chosen on this device.
    signedIn(r.value);
  };

  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
      <div className="flex items-center gap-2 text-lg font-extrabold"><UserRound size={22} className="text-primary" aria-hidden="true" /> {t('accountTitle')}</div>
      <div role="tablist" className="flex rounded-2xl bg-canvas p-1">
        {(['login', 'register'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); }}
            className={cn('min-h-10 flex-1 rounded-xl text-[15px] font-extrabold', tab === k ? 'bg-white text-primary shadow-sm' : 'text-muted')}>
            {t(k === 'login' ? 'signIn' : 'signUp')}
          </button>
        ))}
      </div>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('username')}
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required
            className="min-h-12 rounded-2xl border-2 border-line bg-white px-3 text-base font-normal focus:border-primary focus:outline-none" />
          {tab === 'register' && <span className="text-sm font-normal text-muted">{t('usernameHelp')}</span>}
        </label>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('password')}
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required
            className="min-h-12 rounded-2xl border-2 border-line bg-white px-3 text-base font-normal focus:border-primary focus:outline-none" />
          {tab === 'register' && <span className="text-sm font-normal text-muted">{t('passwordHelp', { n: MIN_PASSWORD })}</span>}
        </label>
        {error && <p role="alert" className="text-[15px] font-semibold text-bad">{t(`authErr_${error}` as Key)}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={busy || !name || !pass}>{t(tab === 'login' ? 'signIn' : 'signUp')}</Button>
      </form>
      <Note tone="info">{t('accountLocalNote')}</Note>
    </section>
  );
}

function SettingsBox() {
  const { t } = useT();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const user = useStore((s) => s.user);
  const pick = (mode: Mode) => setPrefs({ mode, show: showFor(mode) });
  const toggle = (id: SectionId) => setPrefs({ ...prefs, show: { ...prefs.show, [id]: !prefs.show[id] } });

  return (
    <section className="grid gap-3" aria-labelledby="settings-title">
      <h3 id="settings-title" className="text-xl font-extrabold">{t('settings')}</h3>
      <div role="radiogroup" aria-label={t('modeLabel')} className="grid gap-2">
        <Choice selected={prefs.mode === 'simple'} onSelect={() => pick('simple')} title={t('modeSimple')} help={t('modeSimpleHelp')} />
        <Choice selected={prefs.mode === 'advanced'} onSelect={() => pick('advanced')} title={t('modeAdvanced')} help={t('modeAdvancedHelp')} />
      </div>
      <fieldset className="grid gap-1 rounded-2xl border border-line bg-white p-3">
        <legend className="px-1 text-base font-extrabold">{t('sectionsTitle')}</legend>
        <p className="px-1 pb-1 text-sm text-muted">{t('sectionsHelp')}</p>
        {SECTION_IDS.map((id) => {
          const always = ALWAYS.includes(id);
          return (
            <label key={id} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-2', !always && 'cursor-pointer hover:bg-canvas')}>
              <input type="checkbox" checked={always || prefs.show[id]} disabled={always} onChange={() => toggle(id)} className="h-5 w-5 accent-[var(--color-primary)]" />
              <span className="flex-1 text-[15px] font-semibold">{t(SECTION_KEY[id])}</span>
              {ADVANCED_ONLY.includes(id) && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-bold text-muted">{t('modeAdvanced')}</span>}
            </label>
          );
        })}
        {isCustom(prefs) && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-sm text-muted">{t('sectionsCustom')}</span>
            <Button onClick={() => pick(prefs.mode)}>{t('sectionsReset')}</Button>
          </div>
        )}
      </fieldset>
      <p className="text-sm text-muted">{t(user ? 'settingsSavedAccount' : 'settingsSavedDevice')}</p>
    </section>
  );
}
