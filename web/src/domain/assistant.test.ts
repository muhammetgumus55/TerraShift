import { describe, expect, it } from 'vitest';
import { translate } from '@/i18n';
import { answer, normalize, type FieldContext } from './assistant';

const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('tr', k, v);
const ctx: FieldContext = {
  location: 'Develi, Kayseri', harvestYear: 2027, crop: 'chickpea', then: 'wheat', wheatNow: false, driver: 'value',
  alternatives: [{ crop: 'lentil', close: false }, { crop: 'fallow', close: false }], blocked: [], irrigated: false,
};

describe('ask the farmer', () => {
  it('folds Turkish letters and punctuation', () => {
    expect(normalize('Neden BU öneri?')).toBe(' neden bu oneri ');
  });
  it('answers what to plant from the field', () => {
    const r = answer('Ne ekmeliyim?', ctx, t);
    expect(r.text).toContain('Nohut');
    expect(r.text).toContain('2027');
  });
  it('without a field, asks for one first', () => {
    expect(answer('ne ekeyim', null, t).action).toEqual({ kind: 'find' });
  });
  it('explains why, the alternatives and a named crop', () => {
    expect(answer('neden bu öneri', ctx, t).text).toContain('kazanç');
    expect(answer('başka ne ekebilirim', ctx, t).text).toContain('Mercimek');
    expect(answer('mercimek ekebilir miyim', ctx, t).text).toContain('daha az uygun');
    expect(answer('Neden nohut?', ctx, t).text).toContain('kazanç');
  });
  it('defines glossary terms, also in English', () => {
    expect(answer('P10 ne demek?', ctx, t).text).toMatch(/^P10/);
    expect(answer('pH nedir', ctx, t).text).toMatch(/^pH/);
    expect(answer('what is evapotranspiration', ctx, t).text).toContain('Evapotranspirasyon');
  });
  it('sends practical questions to the right section', () => {
    expect(answer('gübre ne kadar atayım', ctx, t).action).toEqual({ kind: 'section', id: 'fertilizer' });
    expect(answer('ne zaman ekim yapmalıyım, tohum', ctx, t).action).toEqual({ kind: 'section', id: 'sowing' });
    expect(answer('veriler nereden geliyor', ctx, t).action).toEqual({ kind: 'section', id: 'details' });
  });
  it('says so when it does not know', () => {
    const r = answer('traktörümün lastiği patladı', ctx, t);
    expect(r.suggest).toBe(true);
  });
});
