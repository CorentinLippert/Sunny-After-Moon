// Band facts in one place. Edit here to update every page.

export const links = {
  bandcamp: 'https://sunnyaftermoon.bandcamp.com/',
  spotify: 'https://open.spotify.com/artist/1yGE90VdkyNc89dT02jpP0',
  instagram: 'https://www.instagram.com/sunny_after_moon/',
  facebook: 'https://www.facebook.com/sunnyaftermoon/',
  youtube: 'https://www.youtube.com/channel/UC5ghtEDXX_WP8H4SjOMR8Xw',
  vibe: 'https://vi.be/platform/sunnyaftermoon',
  email: 'sunnyaftermoon@outlook.com',
};

export const spotifyEmbed = 'https://open.spotify.com/embed/artist/1yGE90VdkyNc89dT02jpP0?utm_source=generator&theme=0';
// "UU" + channel id without "UC" = the channel's uploads playlist.
export const youtubeEmbed = 'https://www.youtube-nocookie.com/embed/videoseries?list=UU5ghtEDXX_WP8H4SjOMR8Xw';

export type Instrument = 'sax' | 'keys' | 'guitar1' | 'guitar2' | 'drums' | 'bass' | 'percussion' | 'vocals';

export interface Member {
  name: string;
  instrument: Instrument;
  color: string; // card colour, also used later for the game character
  head?: string; // rotating-head animation in public/images/heads/<head>.webp (+ <head>-still.webp)
}

export const members: Member[] = [
  // stage-plan order (Monia, 2026-11-13); colours run sun (yellow) to moon (teal) in this order
  { name: 'Sam De Wandel', instrument: 'guitar1', color: '#ffec00', head: 'sam' },
  { name: 'Yorick Musschoot', instrument: 'vocals', color: '#fcc400', head: 'yorick' },
  { name: 'Corentin Lippert', instrument: 'sax', color: '#f39a1e', head: 'corentin' },
  { name: 'Hans De Roey', instrument: 'guitar2', color: '#e2622a', head: 'hans' },
  { name: 'Tijl Lippert', instrument: 'keys', color: '#b2cc3c', head: 'tijl' },
  { name: 'Wim Smeyers', instrument: 'drums', color: '#6cbc92', head: 'wim' },
  { name: 'Simon Fonteyn', instrument: 'bass', color: '#4fa37e', head: 'simon' },
  { name: 'Tomas Boulanger', instrument: 'percussion', color: '#3f8f86', head: 'tomas' },
];

export interface Album {
  title: string;
  year: number;
  url: string;
  tracks?: string[];
  colors: [string, string];
}

export const albums: Album[] = [
  {
    title: 'For the People',
    year: 2024,
    url: 'https://sunnyaftermoon.bandcamp.com/',
    colors: ['#ce460a', '#96261b'],
  },
  {
    title: 'Where do we go from here?',
    year: 2019,
    url: 'https://sunnyaftermoon.bandcamp.com/',
    colors: ['#6cbc92', '#0f2a26'],
  },
  {
    title: 'The Mental Mess',
    year: 2017,
    url: 'https://sunnyaftermoon.bandcamp.com/album/the-mental-mess',
    tracks: [
      'Never Fear', 'Think4Free', 'Another Way', 'Balkan Booby', 'Mental Mess', 'Petit Agneau',
      'Levensgenieter', 'Discorientation', 'Cup Up', 'Ska #', 'Sure&Sure',
    ],
    colors: ['#fcc400', '#ce460a'],
  },
];
