<template>
  <div>
    <NuxtLink to="/faq/"><button class="bg-zinc-700 text-gray-200 sm:hover:bg-red-600 text-left rounded p-2 max-h-40">Back to FAQ</button></NuxtLink>
    <ContentRenderer v-if="entry" :value="entry" class="markdown-body break-word hyphens-auto" />
    <p v-else>No content found.</p>
  </div>
</template>
<script setup lang="ts">
const route = useRoute();
const { data: entry } = await useAsyncData(route.path, () => {
  return queryCollection('faq').path(route.path).first();
});
useSeoMeta({
  title: entry.value?.title ?? '',
  description: entry.value?.description ?? '',
});
</script>
