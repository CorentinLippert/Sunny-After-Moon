# Sunny After Moon website

The website of Sunny After Moon, an 8-piece band from Leuven. Built with [Astro](https://astro.build) and Tailwind CSS, hosted on Vercel. Available in English, Dutch and French.

## Run it locally

Needs Node.js 22.12 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Editing content

| What | Where |
| --- | --- |
| Gigs | `src/content/gigs/` — one `.md` file per gig (see below) |
| Members, albums, links | `src/data/band.ts` |
| All texts in EN / NL / FR | `src/i18n/ui.ts` |
| Colours and fonts | `src/styles/global.css` |

### Add a gig

Create `src/content/gigs/2025-06-21-some-festival.md`:

```md
---
date: 2025-06-21
venue: Some Festival
city: Leuven          # optional
tickets: https://...  # optional
---
```

Gigs move from "Upcoming" to "Past gigs" when the site is rebuilt after the date. Every push triggers a rebuild on Vercel.

## Pages

`/`, `/music/`, `/band/`, `/live/`, `/videos/`, `/booking/`, each also under `/nl/` and `/fr/`.

## Still to come

- Real photos, album covers and member drawings (placeholders for now)
- Press kit downloads
- The rhythm mini game at `/play/`
