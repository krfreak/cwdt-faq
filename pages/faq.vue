<template>
  <h1>Choose one or more tags to learn about stuff</h1>
  <p v-if="tagPending">Loading data</p>
  <FilterList v-else :filters="tags[0].tags.sort()"></FilterList>
  <h1>Topics</h1>
  <div v-if="!entryPending" v-for="entry in entries?.entries">
    <EntryButton
      :_id="entry._id"
      :text="entry.title"
      :tags="entry.tags"
      @activate-entry="activateEntry"
    ></EntryButton>
  </div>
  <div>
    <EntryBody
      :text="
        entries?.entries.filter((a) => a._id === filterStore.activeEntry)[0]
          .text || ''
      "
    ></EntryBody>
  </div>
</template>

<script setup lang="ts">
import { useFilterStore } from "~/stores/filters";
const filterStore = useFilterStore();
const activeFilters = filterStore.activeTags;

const { data: entries, pending: entryPending } = await useLazyFetch(
  "/api/entries"
);
const { data: tags, pending: tagPending } = await useLazyFetch(
  "/api/entries/tags",
  {
    transform: (a) => {
      return a.data;
    },
  }
);
function activateEntry(id: string) {
  filterStore.setActiveEntry(id);
}
</script>

<style>
.filter-list {
  display: flex;
  flex: auto;
}
</style>
