import { lazy, Suspense, useEffect } from 'react';
import { loadCore } from '@/data/api';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { withMap } from '@/map/api';
import { pilotParcel } from '@/domain/field';
import { DEMO_ANSWERS, demoLocation } from '@/domain/demo';
import { MapControls } from '@/shell/MapControls';
import { Panel } from '@/shell/Panel';
import { TopBar } from '@/shell/TopBar';
import { Profile } from '@/shell/Profile';
import { ConsentDialog } from '@/shell/ConsentDialog';
import { Ask } from '@/shell/Ask';
import { Welcome } from '@/screens/Welcome';
import { FindField } from '@/screens/FindField';
import { Questions } from '@/screens/Questions';
import { Analyzing } from '@/screens/Analyzing';
import { Result } from '@/screens/Result';
import { SimHud } from '@/screens/result/SimHud';
import { Button, Note } from '@/ui/kit';

// MapLibre is most of the download; loading it apart lets the first words appear at once.
const MapCanvas = lazy(() => import('@/map/MapCanvas').then((m) => ({ default: m.MapCanvas })));

export default function App() {
  const { t, lang } = useT();
  const step = useStore((s) => s.step);
  const core = useStore((s) => s.core);
  const coreError = useStore((s) => s.coreError);
  const sim = useStore((s) => s.sim);
  const hasField = useStore((s) => s.parcels.length > 0 && !!s.locationId);
  const go = useStore((s) => s.go);
  const profileOpen = useStore((s) => s.profileOpen);

  useEffect(() => {
    loadCore().then((c) => {
      const st = useStore.getState();
      st.setCore(c);
      // ?demo=<location_id>: a clean result screen for recordings, whatever this browser remembered.
      const loc = demoLocation(c.site, location.search);
      if (loc) {
        st.reset();
        st.setField([pilotParcel(loc)], loc.id, 0);
        for (const [k, v] of Object.entries(DEMO_ANSWERS)) st.answer(k as keyof typeof DEMO_ANSWERS, v as never);
        st.go('result');
        const url = new URL(location.href);
        url.searchParams.delete('demo');
        history.replaceState(null, '', url);
      }
    }, useStore.getState().setCoreError);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `Arksus · ${t('heroTitle')}`;
  }, [lang, t]);
  // The opening view shows the whole country; a step that needs a field never runs without one.
  useEffect(() => {
    if (step === 'welcome') withMap((m) => { m.setField([]); m.setHere(null); m.home(); });
    else if (step !== 'find' && !hasField) go('find');
  }, [step, hasField, go]);

  const mock = !!core && (core.site.mock || core.defaults.mock || core.validation.mock);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0d1f17]">
      <Suspense fallback={null}><MapCanvas /></Suspense>
      {step === 'welcome' && <Welcome />}
      <TopBar />
      {mock && (
        <p role="status" className="absolute inset-x-0 top-0 z-40 bg-[#7a2e1d] px-3 py-1 text-center text-sm font-bold text-white">{t('mockBanner')}</p>
      )}
      {step !== 'welcome' && (
        <Panel>
          {coreError ? (
            <Note tone="bad">{t('loadFailed')}<Button className="mt-2" onClick={() => location.reload()}>{t('retry')}</Button></Note>
          ) : !core ? (
            <p className="py-10 text-center text-lg text-muted" role="status">{t('loading')}</p>
          ) : (
            <>
              {step === 'find' && <FindField />}
              {step === 'questions' && hasField && <Questions />}
              {step === 'analyzing' && hasField && <Analyzing />}
              {step === 'result' && hasField && <Result />}
            </>
          )}
        </Panel>
      )}
      {sim && core && step === 'result' && <SimHud />}
      <MapControls />
      {/* The farmer stays in the corner on every screen. */}
      <Ask />
      {profileOpen && <Profile />}
      <ConsentDialog />
    </div>
  );
}
