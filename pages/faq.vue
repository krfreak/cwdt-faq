<template>
  <div class="flex flex-1 flex-col">
    <h1 class="mb-2">Choose one or more tags to learn about stuff</h1>
    <FilterList :tags="tags"></FilterList>
    <h1 class="mt-2">Topics</h1>
    <div class="entry-list transition ease-in-out delay-75">
      <TransitionGroup>
        <EntryButton
          v-for="entry in visibleEntries"
          :key="entry.id"
          :id="entry.id"
          :text="entry.title"
          :tags="entry.tags"
          @activate-entry="activateEntry"
        />
      </TransitionGroup>
    </div>
    <div>
      <EntryModal
        v-if="filterStore.activeEntry"
        :text="filterStore.findById(filterStore.activeEntry)?.text || ''"
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
