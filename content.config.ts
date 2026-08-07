import { defineCollection, defineContentConfig, z } from '@nuxt/content';

const tagged = {
  tags: z.array(z.string()).default([]),
};

export default defineContentConfig({
  collections: {
    faq: defineCollection({
      type: 'page',
      source: 'faq/*.md',
      schema: z.object(tagged),
    }),
    crafts: defineCollection({
      type: 'page',
      source: 'crafts/*.md',
      schema: z.object(tagged),
    }),
    pobs: defineCollection({
      type: 'page',
      source: 'pobs/*.md',
    }),
  },
});
