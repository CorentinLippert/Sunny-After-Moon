import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One Markdown file per gig in src/content/gigs. Only the front matter is used.
const gigs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gigs' }),
  schema: z.object({
    date: z.coerce.date(),
    venue: z.string(),
    city: z.string().optional(),
    tickets: z.string().url().optional(),
  }),
});

export const collections = { gigs };
