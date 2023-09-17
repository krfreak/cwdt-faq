<template>
  <div class="flex flex-1 flex-col m-1">
    <div class="text-center">
      <h1 class="mb-2">Choose one or more tags to learn about stuff</h1>
      <FilterList :tags="tags" />
      <h1 class="mt-2">Topics</h1>
    </div>
    <div
      class="entry-list transition ease-in-out delay-75 text-center sm:text-left"
    >
      <TransitionGroup>
        <EntryButton
          v-for="entry in visibleEntries"
          :key="entry.id"
          :id="entry.id"
          :title="entry.title"
          :tags="entry.tags"
          @activate-entry="activateEntry"
        />
      </TransitionGroup>
    </div>
    <div>
      <EntryModal
        v-if="filterStore.activeEntry"
        :path="filterStore.findById(filterStore.activeEntry)?.path || ''"
        :title="filterStore.findById(filterStore.activeEntry)?.title || ''"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFilterStore } from "~/stores/filters";
const filterStore = useFilterStore();

const entries = filterStore.entries;
const visibleEntries = computed(() =>
  filterStore.activeTags.length !== 0
    ? entries.filter((entry) =>
        filterStore.activeTags.some((item) => entry.tags.includes(item))
      )
    : entries
);
console.log(visibleEntries);
const tags = filterStore.getAllTags().sort();
function activateEntry(id: string) {
  filterStore.activeEntry = id;
  filterStore.openModal();
}
</script>

<style></style>
