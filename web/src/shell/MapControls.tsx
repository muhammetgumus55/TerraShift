import { useState } from 'react';
import { Box, Compass, Layers, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { withMap, type BasemapId, type OverlayId } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { ROTATION_COLOR_ON_MAP } from '@/domain/sim';
import { cn } from '@/ui/kit';

const btn = 'grid h-12 w-12 place-items-center rounded-2xl bg-[#0f1e16]/85 text-white shadow-float backdrop-blur transition hover:bg-[#0f1e16] active:scale-95';
const OVERLAYS: { id: OverlayId; key: Key; note?: Key; on: boolean }[] = [
  { id: 'labels', key: 'lyrLabels', on: true },
  { id: 'pilots', key: 'lyrPilots', on: true },
  { id: 'ndvi', key: 'lyrNdvi', note: 'lyrNdviNote', on: false },
];

/** Zoom, tilt, north, "my field" and the layer list: the only map chrome. */
export function MapControls() {
  const { t, tx } = useT();
  const step = useStore((s) => s.step);
  // From the questions on the panel is a window over the map: the controls come back when it folds.
  const covered = useStore((s) => s.step !== 'find' && s.sheetOpen);
  const parcels = useStore((s) => s.parcels);
  const site = useStore((s) => s.core?.site);
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<BasemapId>('satellite');
  const [on, setOn] = useState<Record<OverlayId, boolean>>(() => Object.fromEntries(OVERLAYS.map((o) => [o.id, o.on])) as Record<OverlayId, boolean>);
  if (step === 'welcome' || covered) return null;

  const pickBase = (id: BasemapId) => { setBase(id); withMap((m) => m.setBasemap(id)); };
  const toggle = (id: OverlayId) => { const v = !on[id]; setOn({ ...on, [id]: v }); withMap((m) => m.setOverlay(id, v)); };

  return (
    <div className="absolute right-3 top-[4.75rem] z-10 flex flex-col items-end gap-2 md:bottom-28 md:right-5 md:top-auto">
      {open && (
        <div className="w-72 max-w-[calc(100vw-1.5rem)] animate-fade rounded-3xl bg-paper p-4 shadow-panel" role="dialog" aria-label={t('layers')}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{t('layers')}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-canvas"><X size={20} /></button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
            {([['satellite', 'baseSat', 'baseSatNote'], ['s2', 'baseS2', 'baseS2Note']] as const).map(([id, k, note]) => (
              <button key={id} type="button" role="radio" aria-checked={base === id} onClick={() => pickBase(id)}
                className={cn('rounded-2xl border-2 px-3 py-2 text-left', base === id ? 'border-primary bg-primary-soft' : 'border-line bg-white')}>
                <span className="block text-base font-bold">{t(k)}</span>
                <span className="block text-xs text-muted">{t(note)}</span>
              </button>
            ))}
          </div>
          <ul className="mt-3 grid gap-1">
            {OVERLAYS.map((o) => (
              <li key={o.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 text-base font-semibold">
                  <input type="checkbox" checked={on[o.id]} onChange={() => toggle(o.id)} className="h-5 w-5 accent-[var(--color-primary)]" />
                  {t(o.key)}
                </label>
                {o.note && on[o.id] && <p className="pb-1 pl-9 text-xs leading-snug text-muted">{t(o.note)}</p>}
              </li>
            ))}
          </ul>
          {site && on.pilots && (
            <div className="mt-2 border-t border-line pt-2">
              <p className="text-xs leading-snug text-muted">{t('pilotLegend')}</p>
              <ul className="mt-1 grid gap-0.5 text-sm font-semibold">
                {site.rotations.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ background: ROTATION_COLOR_ON_MAP[r.id] }} />{tx(r.label)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button type="button" className={btn} aria-label={t('layers')} aria-expanded={open} onClick={() => setOpen(!open)}><Layers size={22} /></button>
        {parcels.length > 0 && (
          <button type="button" className={btn} aria-label={t('toField')} onClick={() => withMap((m) => m.fitField(fieldPolygons(parcels)))}><LocateFixed size={22} /></button>
        )}
        <button type="button" className={btn} aria-label={t('tilt')} onClick={() => withMap((m) => m.toggleTilt())}><Box size={22} /></button>
        <button type="button" className={btn} aria-label={t('north')} onClick={() => withMap((m) => m.north())}><Compass size={22} /></button>
        <button type="button" className={cn(btn, 'hidden md:grid')} aria-label={t('zoomIn')} onClick={() => withMap((m) => m.zoomBy(1))}><Plus size={22} /></button>
        <button type="button" className={cn(btn, 'hidden md:grid')} aria-label={t('zoomOut')} onClick={() => withMap((m) => m.zoomBy(-1))}><Minus size={22} /></button>
      </div>
    </div>
  );
}
