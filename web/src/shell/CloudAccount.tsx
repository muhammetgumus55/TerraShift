import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, LogOut, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { useCloud } from '@/state/cloud';
import { hasConsent, LLM_CONSENT_OPEN } from '@/domain/consent';
import { Markdown, withoutTickLines } from '@/ui/Markdown';
import { Button, Note, cn } from '@/ui/kit';
import { noticeBody, useLegalText } from './ConsentDialog';

type Doc = 'notice' | 'consent';

/** The account part of the profile panel when Supabase is configured: email + password, and the farmer's permissions. */
export function CloudAccount() {
  const { t } = useT();
  const { ready, user, consents, error, signOut, decide, deleteAccount } = useCloud();
  const locationId = useStore((s) => s.locationId);
  const site = useStore((s) => s.core?.site);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setFailed(false);
    try { await f(); } catch { setFailed(true); } finally { setBusy(false); }
  };

  if (!ready) return <p role="status" className="text-muted">{t('loading')}</p>;

  if (!user) {
    return (
      <section className="grid gap-3 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
        <div className="flex items-center gap-2 text-lg font-extrabold"><UserRound size={22} className="text-primary" aria-hidden="true" /> {t('accountTitle')}</div>
        <EmailForm openDoc={setDoc} />
        <p className="text-sm text-muted">{t('gSignInNote')}</p>
        <LegalLinks openDoc={setDoc} />
        {doc && <LegalModal doc={doc} onClose={() => setDoc(null)} />}
      </section>
    );
  }

  const field = site?.locations.find((l) => l.id === locationId);
  const district = hasConsent(consents, 'district_stats');
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-black uppercase text-white">{(user.name || user.email)[0]}</span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{user.name || user.email}</p>
          {user.name && <p className="truncate text-sm text-muted">{user.email}</p>}
        </div>
      </div>
      <p className="text-[15px]">{field ? t('profileField', { name: `${field.name}, ${field.province}` }) : t('profileNoField')}</p>

      <fieldset className="grid gap-2 rounded-2xl border border-line p-3">
        <legend className="flex items-center gap-1.5 px-1 text-base font-extrabold"><ShieldCheck size={18} className="text-primary" aria-hidden="true" /> {t('gConsentsTitle')}</legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-1 hover:bg-canvas">
          <input type="checkbox" checked={district} disabled={busy} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
            onChange={(e) => void run(() => decide([{ kind: 'district_stats', granted: e.target.checked }]))} />
          <span>
            <span className="block text-[15px] font-bold">{t('gDistrictConsent')}</span>
            <span className="block text-sm text-muted">{t('gDistrictConsentHelp')}</span>
          </span>
        </label>
        {!LLM_CONSENT_OPEN && <p className="px-1 text-sm text-muted">{t('gLlmClosed')}</p>}
      </fieldset>

      <LegalLinks openDoc={setDoc} />
      {doc && <LegalModal doc={doc} onClose={() => setDoc(null)} />}
      {(failed || error) && <Note tone="warn">{t('gError')}</Note>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void signOut()} icon={<LogOut size={18} />}>{t('gSignOut')}</Button>
        {confirmDelete ? (
          <Button variant="primary" className="bg-bad hover:bg-bad" disabled={busy} onClick={() => void run(deleteAccount)} icon={<Trash2 size={18} />}>{t('gDeleteConfirm')}</Button>
        ) : (
          <Button onClick={() => setConfirmDelete(true)} icon={<Trash2 size={18} />}>{t('gDelete')}</Button>
        )}
      </div>
      {confirmDelete && <p className="text-sm text-muted">{t('gDeleteNote')}</p>}
    </section>
  );
}

const MIN_PASSWORD = 8;

/** A sentence with one underlined document name in it: "{link}" in the string marks where it goes. */
function DocSentence({ k, link, onOpen }: { k: Key; link: Key; onOpen: () => void }) {
  const { t } = useT();
  const [before, after = ''] = t(k).split('{link}');
  return (
    <span>
      {before}
      <button type="button" onClick={(e) => { e.preventDefault(); onOpen(); }}
        className="font-bold text-primary underline underline-offset-2 hover:text-primary-strong">{t(link)}</button>
      {after}
    </span>
  );
}

/** Left-hand checkbox with its sentence; the whole row toggles it except the document link. */
function Tick({ checked, onChange, children, required }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
      <input type="checkbox" checked={checked} required={required} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[var(--color-primary)]" />
      {children}
    </label>
  );
}

function EmailForm({ openDoc }: { openDoc: (d: Doc) => void }) {
  const { t } = useT();
  const signIn = useCloud((s) => s.signIn);
  const signUp = useCloud((s) => s.signUp);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [noticeRead, setNoticeRead] = useState(false);
  const [district, setDistrict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'warn' | 'info'; key: Key } | null>(null);
  const register = tab === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (register && pass.length < MIN_PASSWORD) { setMsg({ tone: 'warn', key: 'eErr_weak_password' }); return; }
    if (register && !noticeRead) { setMsg({ tone: 'warn', key: 'regNeedNotice' }); return; }
    setBusy(true); setMsg(null);
    const r = register ? await signUp(email, pass, district) : await signIn(email, pass);
    setBusy(false);
    if (r === null) { setPass(''); return; }                       // signed in: the panel switches to the account
    setMsg(r === 'check_mail' ? { tone: 'info', key: 'eCheckMail' } : { tone: 'warn', key: `eErr_${r}` as Key });
  };

  const input = 'min-h-12 rounded-2xl border-2 border-line bg-white px-3 text-base font-normal focus:border-primary focus:outline-none';
  return (
    <>
      <div role="tablist" className="flex rounded-2xl bg-canvas p-1">
        {(['login', 'register'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setMsg(null); }}
            className={cn('min-h-10 flex-1 rounded-xl text-[15px] font-extrabold', tab === k ? 'bg-white text-primary shadow-sm' : 'text-muted')}>
            {t(k === 'login' ? 'signIn' : 'signUp')}
          </button>
        ))}
      </div>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('eEmail')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required className={input} />
        </label>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('password')}
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required className={input} />
          {register && <span className="text-sm font-normal text-muted">{t('passwordHelp', { n: MIN_PASSWORD })}</span>}
        </label>

        {register && (
          // Two separate statements (KVKK principle decision 2026/347): reading the notice is required
          // to open an account; the consent is optional and starts unticked.
          <div className="grid gap-3 rounded-2xl border border-line bg-canvas/60 p-3">
            <Tick checked={noticeRead} onChange={setNoticeRead} required>
              <DocSentence k="regNotice" link="regNoticeLink" onOpen={() => openDoc('notice')} />
            </Tick>
            <Tick checked={district} onChange={setDistrict}>
              <span>
                <DocSentence k="regConsent" link="regConsentLink" onOpen={() => openDoc('consent')} />{' '}
                <span className="text-muted">{t('regOptional')}</span>
              </span>
            </Tick>
          </div>
        )}

        {msg && <Note tone={msg.tone}>{t(msg.key)}</Note>}
        <Button type="submit" variant="primary" size="lg" disabled={busy || !email.includes('@') || !pass || (register && !noticeRead)}>
          {t(register ? 'signUp' : 'signIn')}
        </Button>
      </form>
    </>
  );
}

function LegalLinks({ openDoc }: { openDoc: (d: Doc) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {(['notice', 'consent'] as const).map((k) => (
        <button key={k} type="button" onClick={() => openDoc(k)}
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary underline underline-offset-4">
          <FileText size={18} aria-hidden="true" /> {t(k === 'notice' ? 'gReadNotice' : 'gReadConsent')}
        </button>
      ))}
    </div>
  );
}

/** The full text of one legal document in its own window over the panel. */
function LegalModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const { t } = useT();
  const notice = useLegalText('aydinlatma-metni.md');
  const consent = useLegalText('acik-riza-metni.md');
  // Paper-form tick lines are left out: on the site the real checkboxes are in the form.
  const src = doc === 'notice' ? (notice && noticeBody(notice)) : (consent && withoutTickLines(consent));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
    // Capture phase: Escape closes this window, not the profile panel under it.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const title = t(doc === 'notice' ? 'regNoticeLink' : 'regConsentLink');
  // A portal: the profile panel animates with a transform, which would trap a fixed window inside it.
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0d1f17]/60 p-2 backdrop-blur-[2px] md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className="grid max-h-[calc(100dvh-1rem)] w-full max-w-2xl animate-rise grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[1.5rem] bg-paper shadow-panel outline-none md:max-h-[calc(100dvh-3rem)]">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
          <h3 className="text-xl font-black">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-canvas"><X size={22} /></button>
        </header>
        <div className="thin-scroll overflow-y-auto px-4 py-4 md:px-6">
          {src === null ? <p role="status" className="text-muted">{t('loading')}</p> : <Markdown src={src} />}
        </div>
        <footer className="border-t border-line px-4 py-3 md:px-6">
          <Button variant="primary" onClick={onClose}>{t('close')}</Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
