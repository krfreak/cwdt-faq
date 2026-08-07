<template>
  <div class="border-4 rounded border-zinc-700 bg-zinc-900 mt-2 p-2">
    <ContentRenderer v-if="page" :id="title" :value="page" class="markdown-body" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  path: string;
}>();

const { data: page } = await useAsyncData(`craft-${props.path}`, () => {
  return queryCollection('crafts').path(props.path).first();
});
</script>
