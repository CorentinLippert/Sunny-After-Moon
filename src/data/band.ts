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
}

export const members: Member[] = [
  { name: 'Yorick Musschoot', instrument: 'vocals', color: '#ff7a3d' },
  { name: 'Corentin Lippert', instrument: 'sax', color: '#ffc23d' },
  { name: 'Tijl Lippert', instrument: 'keys', color: '#ff5d73' },
  { name: 'Sam De Wandel', instrument: 'guitar1', color: '#7bd389' },
  { name: 'Hans De Roey', instrument: 'guitar2', color: '#5ec4e8' },
  { name: 'Simon Fonteyn', instrument: 'bass', color: '#a98bff' },
  { name: 'Wim Smeyers', instrument: 'drums', color: '#ff9f1c' },
  { name: 'Tomas Boulanger', instrument: 'percussion', color: '#2ec4b6' },
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
    colors: ['#ff7a3d', '#2b1d5c'],
  },
  {
    title: 'Where do we go from here?',
    year: 2019,
    url: 'https://sunnyaftermoon.bandcamp.com/',
    colors: ['#5ec4e8', '#1a1440'],
  },
  {
    title: 'The Mental Mess',
    year: 2017,
    url: 'https://sunnyaftermoon.bandcamp.com/album/the-mental-mess',
    tracks: [
      'Never Fear', 'Think4Free', 'Another Way', 'Balkan Booby', 'Mental Mess', 'Petit Agneau',
      'Levensgenieter', 'Discorientation', 'Cup Up', 'Ska #', 'Sure&Sure',
    ],
    colors: ['#ffc23d', '#ff5d73'],
  },
];
