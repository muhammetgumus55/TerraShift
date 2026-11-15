import { UserRound } from 'lucide-react';
import { cloudEnabled, useCloud } from '@/state/cloud';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { cn } from '@/ui/kit';

/** Brand on the left; profile and language on the right. Nothing else competes with the map. */
export function TopBar() {
  const { t, lang } = useT();
  const setLang = useStore((s) => s.setLang);
  const go = useStore((s) => s.go);
  // With Supabase configured its account is the account; otherwise the device-only trial.
  const trialUser = useStore((s) => s.user);
  const cloudUser = useCloud((s) => s.user);
  const user = cloudEnabled ? (cloudUser ? cloudUser.name || cloudUser.email : null) : trialUser;
  const setProfileOpen = useStore((s) => s.setProfileOpen);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-3 md:p-4">
      <button type="button" onClick={() => go('welcome')} aria-label={t('appName')}
        className="pointer-events-auto flex min-h-12 items-center gap-2.5 rounded-2xl bg-[#0f1e16]/80 py-1.5 pl-2 pr-3.5 text-white shadow-float backdrop-blur">
        <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="#1f5b3f" />
          <path d="M5 22c4-1 7-6 11-6s7 5 11 6" fill="none" stroke="#f2c14e" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 5.5c3 4 4.2 6.2 4.2 8.3a4.2 4.2 0 01-8.4 0c0-2.1 1.2-4.3 4.2-8.3z" fill="#bfe3f5" />
        </svg>
        <span className="text-xl font-black tracking-tight">{t('appName')}</span>
      </button>
      <div className="pointer-events-auto flex items-center gap-2">
      <button type="button" onClick={() => setProfileOpen(true)} aria-label={user ? t('profileOf', { u: user }) : t('profileTitle')} title={user ?? t('profileTitle')}
        className="flex min-h-12 items-center gap-2 rounded-2xl bg-[#0f1e16]/80 px-2 text-white shadow-float backdrop-blur hover:bg-[#0f1e16]">
        {user
          ? <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-lg font-black uppercase text-primary-strong">{user[0]}</span>
          : <UserRound size={22} aria-hidden="true" className="mx-1" />}
        <span className="hidden max-w-32 truncate pr-1.5 text-base font-bold md:inline">{user ?? t('signIn')}</span>
      </button>
      <div role="group" aria-label={t('language')} className="pointer-events-auto flex rounded-2xl bg-[#0f1e16]/80 p-1 shadow-float backdrop-blur">
        {(['tr', 'en'] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
            className={cn('min-h-10 min-w-12 rounded-xl px-2.5 text-base font-extrabold uppercase', lang === l ? 'bg-gold text-primary-strong' : 'text-white/85')}>
            {l}
          </button>
        ))}
      </div>
      </div>
    </header>
  );
}
