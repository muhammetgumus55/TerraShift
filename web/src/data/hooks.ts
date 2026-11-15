import { useEffect, useState } from 'react';
import type { AgentFile, ExplainFile, FertilizerFile, LedgerFile, ResultsFile, SmapFile, SoilHealthFile, SowingFile } from '@/lib/types';
import { loadAgent, loadExplain, loadFertilizer, loadLedger, loadResults, loadSmap, loadSoilHealth, loadSowing } from './api';

export type Async<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** Run an async loader whenever `key` changes; stale answers are dropped. */
export function useAsync<T>(key: string | null, load: () => Promise<T>): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    setState({ status: 'loading' });
    load().then((data) => alive && setState({ status: 'ready', data }), () => alive && setState({ status: 'error' }));
    return () => { alive = false; };
    // The loader is identified by its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export interface District { results: ResultsFile; baseline: ResultsFile; smap: SmapFile | null; agent: AgentFile | null }

/** A district's results for a climate scenario, with the baseline alongside for comparison. */
export function useDistrict(locationId: string | null, scenarioId = 'baseline'): Async<District> {
  return useAsync(locationId ? `${locationId}|${scenarioId}` : null, async () => {
    const [results, baseline, smap, agent] = await Promise.all([
      loadResults(locationId!, scenarioId), loadResults(locationId!), loadSmap(locationId!), loadAgent(locationId!),
    ]);
    return { results, baseline, smap, agent };
  });
}

export const useExplain = (locationId: string | null): Async<ExplainFile | null> =>
  useAsync(locationId ? `explain|${locationId}` : null, () => loadExplain(locationId!));

export const useLedger = (locationId: string | null, wanted: boolean): Async<LedgerFile> =>
  useAsync(locationId && wanted ? `ledger|${locationId}` : null, () => loadLedger(locationId!));

export const useFertilizer = (): Async<FertilizerFile> => useAsync('fertilizer', loadFertilizer);

export const useSowing = (): Async<SowingFile> => useAsync('sowing', loadSowing);
export const useSoilHealth = (): Async<SoilHealthFile> => useAsync('soil_health', loadSoilHealth);
