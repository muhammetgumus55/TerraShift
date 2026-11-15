// A small Markdown reader for the legal texts (docs/legal/*.md, copied to public/legal/).
// Only what those texts use: headings, paragraphs, bullet lists, tables, quotes, rules,
// **bold** and *italic*. No HTML is ever injected: every piece becomes a React text node.

import type { ReactNode } from 'react';

export type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'hr' };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function parseMd(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push({ kind: 'h', level: h[1].length as 1 | 2 | 3, text: h[2] }); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push({ kind: 'hr' }); i++; continue; }
    if (l.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push({ kind: 'quote', lines: q.filter((x) => x.trim()) });
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push({ kind: 'ul', items });
      continue;
    }
    if (l.trim().startsWith('|')) {
      const t: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) t.push(lines[i++]);
      const [head, , ...rows] = t;          // second line is the |---|---| separator
      out.push({ kind: 'table', head: cells(head), rows: rows.map(cells) });
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|---+\s*$|\s*[-*]\s+|\s*\|)/.test(lines[i])) p.push(lines[i++].trim());
    out.push({ kind: 'p', text: p.join(' ') });
  }
  return out;
}

/** **bold** and *italic*, as React nodes. */
export function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((s, k) =>
    s.startsWith('**') ? <b key={k}>{s.slice(2, -2).replace(/`/g, '')}</b>
      : s.startsWith('*') && s.length > 2 ? <i key={k}>{s.slice(1, -1).replace(/`/g, '')}</i> : s.replace(/`/g, ''));
}

/** The part of a text from a heading to the next rule (---) or the end; '' when the heading is missing. */
export function sectionOf(src: string, heading: string): string {
  const text = src.replace(/\r\n/g, '\n');
  const start = text.indexOf(`\n${heading}\n`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const end = rest.search(/\n---+\s*\n/);
  return end < 0 ? rest : rest.slice(0, end);
}

/** Drops the paper-form tick lines (☐ …): on the site real checkboxes take their place. */
export const withoutTickLines = (src: string) => src.split(/\r?\n/).filter((l) => !l.trim().startsWith('☐')).join('\n');

export function Markdown({ src }: { src: string }) {
  return (
    <div className="grid gap-3 text-[15px] leading-relaxed">
      {parseMd(src).map((b, k) => {
        switch (b.kind) {
          case 'h': return b.level === 1
            ? <h3 key={k} className="text-xl font-black leading-tight">{inline(b.text)}</h3>
            : <h4 key={k} className={b.level === 2 ? 'pt-1 text-lg font-extrabold' : 'font-extrabold'}>{inline(b.text)}</h4>;
          case 'p': return <p key={k}>{inline(b.text)}</p>;
          case 'ul': return <ul key={k} className="grid list-disc gap-1 pl-5">{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>;
          case 'quote': return <div key={k} className="rounded-xl border-l-4 border-gold bg-canvas px-3 py-2 text-sm">{b.lines.map((x, j) => <p key={j}>{inline(x)}</p>)}</div>;
          case 'hr': return <hr key={k} className="border-line" />;
          case 'table': return (
            <div key={k} className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead><tr>{b.head.map((c, j) => <th key={j} className="border-b-2 border-line px-2 py-1.5 font-extrabold">{inline(c)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j} className="align-top">{r.map((c, m) => <td key={m} className="border-b border-line px-2 py-1.5">{inline(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
      })}
    </div>
  );
}
