<template>
  <div class="buttons">
    <button
      v-for="tag in tags"
      @click="toggleFilter(tag)"
      :class="[
        filterStore.activeTags.includes(tag) ? 'bg-red-600' : 'bg-zinc-700',
        'text-gray-200 hover:bg-red-600',
      ]"
    >
      {{ tag }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useFilterStore } from "~/stores/filters";
const filterStore = useFilterStore();
const props = defineProps<{
  tags: string[];
}>();

function toggleFilter(tag: string) {
  const buttons = document.querySelectorAll("button");
  const tagIncluded = filterStore.activeTags.includes(tag);
  if (tagIncluded) {
    filterStore.removeTag(tag);
  } else {
    filterStore.addTag(tag);
  }
  buttons.forEach((btn) => {
    if (btn.innerText === tag) btn.classList.toggle("active-filter");
  });
}
</script>

<style></style>
