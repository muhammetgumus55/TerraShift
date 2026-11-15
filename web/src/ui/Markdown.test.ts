import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMd, sectionOf, withoutTickLines } from './Markdown';

const notice = readFileSync(resolve(__dirname, '../../public/legal/aydinlatma-metni.md'), 'utf-8');
const consent = readFileSync(resolve(__dirname, '../../public/legal/acik-riza-metni.md'), 'utf-8');

describe('legal Markdown', () => {
  it('reads headings, lists, tables, quotes and rules', () => {
    const b = parseMd('# T\n\n> q1\n> q2\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n---\n\npara\nline');
    expect(b.map((x) => x.kind)).toEqual(['h', 'quote', 'ul', 'table', 'hr', 'p']);
    expect(b[3]).toEqual({ kind: 'table', head: ['x', 'y'], rows: [['1', '2']] });
    expect(b[5]).toEqual({ kind: 'p', text: 'para line' });
  });
  it('the notice has its seven numbered sections and the purpose table', () => {
    const heads = parseMd(notice).filter((x) => x.kind === 'h' && x.level === 2).map((x) => (x as { text: string }).text);
    expect(heads.filter((h) => /^\d\./.test(h))).toHaveLength(7);
    expect(parseMd(notice).some((x) => x.kind === 'table' && x.head.includes('Hukuki sebep (Kanun md. 5)'))).toBe(true);
  });
  it('cuts one consent out of the consent text, without the paper tick lines', () => {
    const one = withoutTickLines(sectionOf(consent, '## İzin 1 — İlçe bazında ekim istatistiği'));
    expect(one).toContain('Neden istiyoruz?');
    expect(one).not.toContain('İzin 2');
    expect(one).not.toContain('☐');
  });
});
