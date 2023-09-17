<template>
  <div class="mr-3 sm:mr-0">
    <button
      v-for="tag in tags"
      @click="toggleFilter(tag)"
      :class="[
        filterStore.activeTags.includes(tag) ? 'bg-red-600' : 'bg-zinc-700',
        'text-gray-200 hover:bg-red-600 rounded p-2 m-1',
      ]"
    >
      {{ tag }}
    </button>
  </div>
  <button
    class="bg-zinc-700 border-amber-300 text-gray-200 sm:hover:bg-red-600 rounded p-2 mt-2"
    @click="clearFilters"
  >
    Clear all filters
  </button>
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
    filterStore.removeActiveTag(tag);
  } else {
    filterStore.addActiveTag(tag);
  }
  buttons.forEach((btn) => {
    if (btn.innerText === tag) btn.classList.toggle("active-filter");
  });
}

function clearFilters() {
  filterStore.removeAllActiveTags();
  const buttons = document.querySelectorAll("button");
  buttons.forEach((btn) => {
    btn.classList.remove("active-filter");
  });
}
</script>
<style></style>
