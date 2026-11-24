// Technical rider: input list, stage plan, monitors and power.
// Edit here, then run `npm run build && npm run rider:pdf` to refresh the PDFs in public/downloads/.
// Merged from the band's tech sheet (June 2026), the channel list and the two stage plans (Nov 2026).

export type Stand = 'short' | 'tall' | 'clamp' | 'none';

export interface Channel {
  n: number;
  source: string;
  who: string;
  mic: string;
  stand: Stand;
  /** key in the tech dictionary for an extra note */
  note?: 'secondSnare' | 'clipOn' | 'ownDi' | 'shared';
}

export const channels: Channel[] = [
  { n: 1, source: 'Kick', who: 'Wim', mic: 'AKG D112 / Beta 52', stand: 'short' },
  { n: 2, source: 'Snare 1', who: 'Wim', mic: 'e906 / SM57', stand: 'short' },
  { n: 3, source: 'Snare 2', who: 'Wim', mic: 'e906 / SM57', stand: 'short', note: 'secondSnare' },
  { n: 4, source: 'Hi-hat', who: 'Wim', mic: 'C1000 / SM57', stand: 'short' },
  { n: 5, source: 'Tom 1', who: 'Wim', mic: 'e904 / PG56', stand: 'clamp' },
  { n: 6, source: 'Tom 2', who: 'Wim', mic: 'e904 / PG56', stand: 'clamp' },
  { n: 7, source: 'Floor tom', who: 'Wim', mic: 'e904 / PG56', stand: 'clamp' },
  { n: 8, source: 'OH L', who: 'Wim', mic: 'e614 / P170', stand: 'tall' },
  { n: 9, source: 'OH R', who: 'Wim', mic: 'e614 / P170', stand: 'tall' },
  { n: 10, source: 'Bass DI', who: 'Simon', mic: 'DI', stand: 'none' },
  { n: 11, source: 'Bass amp', who: 'Simon', mic: 'AKG D112 / Beta 52', stand: 'short' },
  { n: 12, source: 'Guitar (front)', who: 'Sam', mic: 'e906 / SM57', stand: 'short' },
  { n: 13, source: 'Guitar (back)', who: 'Hans', mic: 'e906 / SM57', stand: 'short' },
  { n: 14, source: 'Keys L', who: 'Tijl', mic: 'DI', stand: 'none' },
  { n: 15, source: 'Keys R', who: 'Tijl', mic: 'DI', stand: 'none' },
  { n: 16, source: 'Sax', who: 'Corentin', mic: 'XLR (clip-on) · alt. C1000 / SM57', stand: 'none', note: 'clipOn' },
  { n: 17, source: 'Acoustic guitar', who: 'Corentin', mic: 'DI (jack)', stand: 'none' },
  { n: 18, source: 'Percussion L', who: 'Tomas', mic: 'e614 / P170 · alt. SM57', stand: 'tall' },
  { n: 19, source: 'Percussion R', who: 'Tomas', mic: 'e614 / P170 · alt. SM57', stand: 'tall' },
  { n: 20, source: 'Kaossilator L', who: 'Tomas', mic: 'DI (XLR)', stand: 'none', note: 'ownDi' },
  { n: 21, source: 'Kaossilator R', who: 'Tomas', mic: 'DI (XLR)', stand: 'none', note: 'ownDi' },
  { n: 22, source: 'Space Echo (snare)', who: 'Tomas', mic: 'DI (jack)', stand: 'none' },
  { n: 23, source: 'Djembe', who: 'Yorick', mic: 'SM57', stand: 'short' },
  { n: 24, source: 'Vocals 1 (lead)', who: 'Yorick', mic: 'SM58', stand: 'tall' },
  { n: 25, source: 'Vocals 2 (lead)', who: 'Sam', mic: 'SM58', stand: 'tall' },
  { n: 26, source: 'Vocals 3 (lead)', who: 'Corentin', mic: 'SM58', stand: 'tall' },
  { n: 27, source: 'Vocals 4 (backing)', who: 'Tijl & Hans', mic: 'SM58', stand: 'tall', note: 'shared' },
];

/** Line-up as it stands on stage, with the role key from the tech dictionary. */
export const crew = [
  { name: 'Yorick Musschoot', role: 'yorick' },
  { name: 'Sam De Wandel', role: 'sam' },
  { name: 'Corentin Lippert', role: 'corentin' },
  { name: 'Wim Smeyers', role: 'wim' },
  { name: 'Simon Fonteyn', role: 'simon' },
  { name: 'Hans De Roey', role: 'hans' },
  { name: 'Tijl Lippert', role: 'tijl' },
  { name: 'Tomas Boulanger', role: 'tomas' },
] as const;

/** Six wedges: three upstage, three downstage. */
export const monitors = [
  { n: 1, who: 'Tomas', spot: 'back' },
  { n: 2, who: 'Wim & Simon', spot: 'back' },
  { n: 3, who: 'Tijl & Hans', spot: 'back' },
  { n: 4, who: 'Corentin', spot: 'front' },
  { n: 5, who: 'Yorick', spot: 'front' },
  { n: 6, who: 'Sam', spot: 'front' },
] as const;

/** 230 V sockets needed on stage. */
export const power = [
  { who: 'Simon', what: 'bass', count: 2 },
  { who: 'Sam', what: 'guitar', count: 1 },
  { who: 'Hans', what: 'guitar', count: 1 },
  { who: 'Tijl', what: 'keys', count: 1 },
  { who: 'Tomas', what: 'fx', count: 2 },
] as const;

export const pdfFile = (lang: string) => `/downloads/sunny-after-moon-tech-rider-${lang}.pdf`;
