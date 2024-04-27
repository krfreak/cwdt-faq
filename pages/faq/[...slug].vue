<template>
  <div>
    <NuxtLink to="/faq/"><button class="bg-zinc-700 text-gray-200 sm:hover:bg-red-600 text-left rounded p-2 max-h-40">Back to FAQ</button></NuxtLink>
    <ContentDoc :path="entry?._path" class="markdown-body break-word hyphens-auto">
      <template #not-found>
        <p>No content found.</p>
      </template>
    </ContentDoc>
  </div>
</template>
<script setup lang="ts">
import type { Entry } from '../../server/models/entry.model';
const route = useRoute();
const { data: entryData, pending } = await useAsyncData(() => {
  return queryContent().where({ _dir: 'faq' }).only(['title', 'description', '_path']).find();
});
const entry = (entryData.value?.find((a) => a._path === route.params.slug) ?? null) as Entry | null;
useSeoMeta({
  title: entry?.title ?? '',
  description: entry?.description ?? '',
});
</script>
