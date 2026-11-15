import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONSENT_VERSION, districtOf, hasConsent, latestConsents, needsNotice, NO_CONSENTS, NOTICE_VERSION, toIntentCrop, type ConsentRow,
} from './consent';
import type { Parcel } from './field';
import type { Location } from '@/lib/types';

const row = (kind: ConsentRow['kind'], granted: boolean, at: string, version = kind === 'notice_read' ? NOTICE_VERSION : CONSENT_VERSION, id?: number): ConsentRow =>
  ({ kind, granted, created_at: at, version, id });

describe('consent log', () => {
  it('newest decision wins per kind; same time falls back to the id', () => {
    const s = latestConsents([
      row('district_stats', true, '2026-11-15T10:00:00Z', CONSENT_VERSION, 1),
      row('district_stats', false, '2026-11-15T11:00:00Z', CONSENT_VERSION, 2),
      row('notice_read', true, '2026-11-15T10:00:00Z', NOTICE_VERSION, 3),
      row('llm_training', true, '2026-11-15T12:00:00Z', CONSENT_VERSION, 5),
      row('llm_training', false, '2026-11-15T12:00:00Z', CONSENT_VERSION, 4),
    ]);
    expect(s.district_stats?.granted).toBe(false);
    expect(s.notice_read?.granted).toBe(true);
    expect(s.llm_training?.granted).toBe(true);
  });
  it('the notice is asked again when never read or when its version changed', () => {
    expect(needsNotice(NO_CONSENTS)).toBe(true);
    expect(needsNotice(latestConsents([row('notice_read', true, 't')]))).toBe(false);
    expect(needsNotice(latestConsents([row('notice_read', true, 't', 'aydinlatma-v0')]))).toBe(true);
  });
  it('a consent counts only for the version that was shown', () => {
    expect(hasConsent(latestConsents([row('district_stats', true, 't')]), 'district_stats')).toBe(true);
    expect(hasConsent(latestConsents([row('district_stats', true, 't', 'acik-riza-v0')]), 'district_stats')).toBe(false);
    expect(hasConsent(NO_CONSENTS, 'district_stats')).toBe(false);
  });
});

describe('district of the field (never its shape)', () => {
  const kaman = { id: 'kaman', name: 'Kaman', district: 'Kaman', province: 'Kırşehir' } as Location;
  it('a TKGM parcel gives the registry names', () => {
    const p = { admin: { il: 'Ankara', ilce: 'Polatlı' } } as Parcel;
    expect(districtOf([p], kaman)).toEqual({ il: 'Ankara', ilce: 'Polatlı' });
  });
  it('a drawn field or a pilot gives the pilot district', () => {
    expect(districtOf([{} as Parcel], kaman)).toEqual({ il: 'Kırşehir', ilce: 'Kaman' });
    expect(districtOf([], undefined)).toBeNull();
  });
  it('unknown crops are stored as other', () => {
    expect(toIntentCrop('chickpea')).toBe('chickpea');
    expect(toIntentCrop('sunflower')).toBe('other');
  });
});

describe('legal texts on the site are the reviewed ones', () => {
  for (const f of ['aydinlatma-metni.md', 'acik-riza-metni.md']) {
    it(`public/legal/${f} equals docs/legal/${f}`, () => {
      const norm = (s: string) => s.replace(/\r\n/g, '\n');
      const site = readFileSync(resolve(__dirname, '../../public/legal', f), 'utf-8');
      const doc = readFileSync(resolve(__dirname, '../../../docs/legal', f), 'utf-8');
      expect(norm(site)).toBe(norm(doc));
    });
  }
});
