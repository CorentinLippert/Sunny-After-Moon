import { getCollection } from 'astro:content';

/** Gigs split into upcoming (soonest first) and past (latest first). */
export async function getGigs() {
  const all = await getCollection('gigs');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = all.filter((g) => g.data.date >= today).sort((a, b) => +a.data.date - +b.data.date);
  const past = all.filter((g) => g.data.date < today).sort((a, b) => +b.data.date - +a.data.date);
  return { upcoming, past };
}
