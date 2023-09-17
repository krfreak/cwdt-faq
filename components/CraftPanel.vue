<template>
  <div class="border-4 rounded border-zinc-700 bg-zinc-900 mt-2 p-2">
    <ContentDoc :id="title" class="markdown-body" :path="path" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  path: string;
}>();
</script>
