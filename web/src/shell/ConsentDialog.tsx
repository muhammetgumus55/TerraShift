import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useT } from '@/i18n';
import { useCloud } from '@/state/cloud';
import { needsNotice } from '@/domain/consent';
import { Markdown, sectionOf, withoutTickLines } from '@/ui/Markdown';
import { Button, Choice, Note } from '@/ui/kit';

/** Loads a legal text from public/legal/ (copies of docs/legal/, kept equal by consent.test.ts). */
export function useLegalText(file: 'aydinlatma-metni.md' | 'acik-riza-metni.md'): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/legal/${file}`).then((r) => (r.ok ? r.text() : Promise.reject(r.status))).then((s) => alive && setText(s), () => alive && setText(''));
    return () => { alive = false; };
  }, [file]);
  return text;
}

/** The notice without its paper tick line (a real checkbox takes its place here). */
export const noticeBody = (md: string) => withoutTickLines(md.replace(/\n\*Bu kutu bir onay[^\n]*\n?/, '\n'));

/**
 * For an account whose notice is missing or out of date (the sign-up form asks both already): the notice, acknowledged with
 * "okudum ve anladım", and the one optional consent, each on its own (KVKK principle decision 2026/347).
 * Nothing about the farmer is saved before this is done.
 */
export function ConsentDialog() {
  const { t } = useT();
  const user = useCloud((s) => s.user);
  const consents = useCloud((s) => s.consents);
  const decide = useCloud((s) => s.decide);
  const signOut = useCloud((s) => s.signOut);
  const notice = useLegalText('aydinlatma-metni.md');
  const consent = useLegalText('acik-riza-metni.md');
  const [read, setRead] = useState(false);
  const [district, setDistrict] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const loaded = useCloud((s) => s.consentsLoaded);
  const signingUp = useCloud((s) => s.signingUp);

  // Shown once the consent log is loaded and the current notice has not been acknowledged.
  const open = !!user && loaded && !signingUp && needsNotice(consents);
  useEffect(() => { if (open) box.current?.focus(); }, [open]);
  if (!open) return null;

  const submit = async () => {
    if (!read || district === null) return;
    setBusy(true); setFailed(false);
    try { await decide([{ kind: 'notice_read', granted: true }, { kind: 'district_stats', granted: district }]); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0d1f17]/60 p-2 backdrop-blur-[2px] md:p-6">
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="consent-title"
        className="thin-scroll grid max-h-[calc(100dvh-1rem)] w-full max-w-2xl animate-rise gap-4 overflow-y-auto rounded-[1.5rem] bg-paper p-4 shadow-panel outline-none md:max-h-[calc(100dvh-3rem)] md:p-6">
        <header className="flex items-center gap-2">
          <ShieldCheck size={26} className="text-primary" aria-hidden="true" />
          <h2 id="consent-title" className="text-2xl font-black">{t('cdTitle')}</h2>
        </header>
        <p className="text-[15px] text-muted">{t('cdIntro')}</p>

        <section className="thin-scroll max-h-[45dvh] overflow-y-auto rounded-2xl border border-line bg-white p-4">
          {notice === null ? <p role="status" className="text-muted">{t('loading')}</p> : <Markdown src={noticeBody(notice)} />}
        </section>
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border-2 border-line bg-white px-3 text-base font-bold">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="h-6 w-6 accent-[var(--color-primary)]" />
          {t('cdNoticeCheck')}
        </label>

        <section className="grid gap-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="consent-1">
          <h3 id="consent-1" className="text-lg font-extrabold">{t('cdConsentTitle')}</h3>
          {consent === null ? <p role="status" className="text-muted">{t('loading')}</p>
            : <Markdown src={withoutTickLines(sectionOf(consent, '## İzin 1 — İlçe bazında ekim istatistiği'))} />}
          <p className="text-[15px] font-semibold">{t('cdConsentQ')}</p>
          <div role="radiogroup" aria-labelledby="consent-1" className="grid gap-2 sm:grid-cols-2">
            <Choice selected={district === true} onSelect={() => setDistrict(true)} title={t('cdGive')} />
            <Choice selected={district === false} onSelect={() => setDistrict(false)} title={t('cdRefuse')} />
          </div>
          <p className="text-sm text-muted">{t('cdOptionalNote')}</p>
        </section>

        {failed && <Note tone="warn">{t('gError')}</Note>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="lg" disabled={!read || district === null || busy} onClick={submit}>{t('cdContinue')}</Button>
          <Button onClick={() => void signOut()}>{t('cdCancel')}</Button>
        </div>
      </div>
    </div>
  );
}
