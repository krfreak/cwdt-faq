<template>
  <div class="flex flex-1 flex-col m-1">
    <div v-if="pending">Loading content...</div>
    <div v-else>
      <div class="text-center">
        <h1 class="mb-2">Choose one or more tags to learn about stuff</h1>
        <FilterList :tags="tags" />
        <h1 class="mt-2">Topics</h1>
      </div>
      <div class="entry-list transition ease-in-out delay-75 text-center sm:text-left">
        <TransitionGroup>
          <EntryButton
            v-for="entry in visibleEntries"
            :id="entry._id"
            :key="entry._id"
            :title="entry.title"
            :tags="entry.tags"
            @activate-entry="activateEntry"
          />
        </TransitionGroup>
      </div>
    </div>
    <EntryModal v-if="filterStore.activeEntry" :path="filterStore.activeEntry._path || ''" :title="filterStore.activeEntry.title || ''" />
  </div>
</template>
s
<script setup lang="ts">
import { Entry } from '~/server/models/entry.model';
import { useFilterStore } from '~/stores/filters';
const filterStore = useFilterStore();

const { data: entryData, pending } = await useAsyncData(() => {
  return queryContent().where({ _dir: 'faq' }).only(['title', 'description', '_id', 'tags', '_path']).find();
});

const visibleEntries = computed(() =>
  filterStore.activeTags.length !== 0 ? entryData.value?.filter((entry) => filterStore.activeTags.some((item) => entry.tags.includes(item))) : entryData.value,
);

const tags = computed(() => {
  return [...new Set(entryData.value?.map((a) => a.tags).flat())];
});

function activateEntry(id: string) {
  const entry = (entryData.value?.find((a) => a._id === id) ?? null) as Entry | null;

  filterStore.setActiveEntry(entry);
  filterStore.openModal();
}
</script>

<style></style>
