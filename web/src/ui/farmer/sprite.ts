// The Arksus farmer, the face of the site's guide. Pixel art kept as text:
// one letter per pixel, '.' is transparent, PALETTE gives the colours. Every
// frame is the base picture with a few rows patched, so changing the look
// means changing letters here.

export const PALETTE: Record<string, string> = {
  K: '#1b1410', // outline
  H: '#e8b54a', h: '#b8862a', B: '#7a2e1d', // straw hat, its shade, band
  S: '#e9a77b', s: '#c7835a', c: '#e07a5f', // skin, shade, cheeks / tongue
  E: '#1b1410', M: '#3a2617', // eyes, moustache
  G: '#2f7a52', g: '#1f5b3f', // shirt
  O: '#2c5d8a', o: '#1f4466', Y: '#f2c14e', // overalls, buttons
  W: '#f2c14e', w: '#c99a2e', // wheat
  N: '#4a2f1d', // boots
};

const BODY = [
  '........KKKKKKKK........',
  '.......KHHHHHHHHK.......',
  '.......KHHHhHHHHK.......',
  '.......KBBBBBBBBK.......',
  '..KKKKKKHHHHHHHHKKKKKK..',
  '.KHHHHHHHHHHHHHHHHHHHHK.',
  '..KKKhhhhhhhhhhhhhhKKK..',
  '.....KSSSSSSSSSSSSK.....',
  '.....KSSSESSSSESSSK.....',
  '.....KScSSSSSSSScSK.....',
  '.....KSSSMMMMMMSSSK.....',
  '.....KsSMMSSSSMMSsK.....',
  '......KsSSSSSSSSsK......',
  '.......KKssssssKK.......',
  '......KGGGKssssKGGGK....',
  '....KKGGGGGKKKKGGGGGKK..',
  '...KGGGOOGGGGGGGGOOGGGK.',
  '...KGGgOOGGGGGGGGOOgGGK.',
  '...KGGgOOOOOOOOOOOOgGGK.',
  '...KGGgOOYOOOOOOYOOgGGK.',
  '...KSSKOOOOOOOOOOOOKSSK.',
  '...KKKKOOOOOOOOOOOOKKKK.',
  '.......KOOOOOOOOOOK.....',
  '.......KOOOOKKOOOOK.....',
  '.......KOOOOKKOOOOK.....',
  '.......KooooKKooooK.....',
  '......KNNNNNKKNNNNNK....',
  '......KKKKKKKKKKKKKK....',
];

export const WIDTH = 26;
export const HEIGHT = BODY.length;

type Grid = string[][];
/** Patch: row → [first column, letters]; '.' in the letters clears a pixel. */
type Patch = Record<number, [number, string]>;

function apply(g: Grid, patch: Patch): Grid {
  const out = g.map((r) => [...r]);
  for (const [row, [col, letters]] of Object.entries(patch)) {
    [...letters].forEach((ch, i) => { out[Number(row)][col + i] = ch; });
  }
  return out;
}

// The wheat ear in his hand (on the viewer's right).
const WHEAT: Patch = {
  0: [23, 'w.w'], 1: [23, 'w.w'], 2: [23, '.W.'], 3: [23, 'Ww.'], 4: [23, '.wW'], 5: [23, 'Ww.'],
  6: [23, '.wW'], 7: [23, 'Ww.'], 8: [23, '.wW'], 9: [23, '.W.'],
  ...Object.fromEntries(Array.from({ length: 13 }, (_, i) => [10 + i, [24, 'w']])),
  19: [22, 'KKw'], 20: [22, 'SSw'], 21: [22, 'KKw'],
};

const base = apply(BODY.map((r) => [...(r + '..')]), WHEAT);

// Closed eyes: a short dark line where each eye was.
const BLINK: Patch = { 8: [6, 'SSMMSSSSMMSS'] };

const TALK_OPEN: Patch = { 11: [10, 'KKKK'], 12: [10, 'KccK'] };
const TALK_HALF: Patch = { 11: [10, 'SKKS'] };

// The arm on the viewer's left goes up; the torso side gets its own outline.
const ARM_SIDE: Patch = {
  16: [0, '....KGg'], 17: [0, '....KGg'], 18: [0, '....KGg'], 19: [0, '....KGg'], 20: [0, '....KGG'], 21: [0, '....KKK'],
};
const WAVE_A: Patch = {
  ...ARM_SIDE,
  7: [0, '.KK..'], 8: [0, 'KSSK.'], 9: [0, 'KSSK.'], 10: [0, '.KSK.'], 11: [0, '.KGGK'], 12: [0, '..KGGK'], 13: [0, '..KGGK'],
  14: [0, '...KGGK'], 15: [0, '...KGGG'],
};
const WAVE_B: Patch = {
  ...WAVE_A,
  7: [0, '..KK.'], 8: [0, '.KSSK'], 9: [0, '.KSSK'], 10: [0, '..KSK'],
};

export type Frame = 'idle' | 'blink' | 'talkOpen' | 'talkHalf' | 'waveA' | 'waveB';

export const FRAMES: Record<Frame, Grid> = {
  idle: base,
  blink: apply(base, BLINK),
  talkOpen: apply(base, TALK_OPEN),
  talkHalf: apply(base, TALK_HALF),
  waveA: apply(base, WAVE_A),
  waveB: apply(base, WAVE_B),
};

/** Runs of one colour per row, so a frame is a few dozen rectangles rather than 700. */
export function runs(g: Grid): { x: number; y: number; w: number; fill: string }[] {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let e = x;
      while (e < row.length && row[e] === ch) e++;
      out.push({ x, y, w: e - x, fill: PALETTE[ch] });
      x = e;
    }
  });
  return out;
}
