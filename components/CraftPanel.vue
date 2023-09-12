<template>
  <div class="border-4 rounded border-zinc-700 bg-zinc-900 mt-2 p-2">
    <h1 class="font-bold text-2xl">{{ title }}</h1>
    <Markdown class="markdown-body" :source="text" />
    <img v-if="img" :src="img" />
  </div>
</template>

<script setup lang="ts">
import Markdown from "vue3-markdown-it";
const props = defineProps<{
  title: string;
  text: string;
  img: string;
}>();
</script>
