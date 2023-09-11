import { defineStore } from "pinia";
import { Entry } from "~/server/models/entry.model";

export const useFilterStore = defineStore("filters", {
  state: () => ({
    activeTags: [] as string[],
    activeEntry: "",
    modalOpen: false,
    entries: [] as Entry[],
    visibleEntries: [] as Entry[],
  }),
  actions: {
    async loadEntries() {
      const { data: entryData } = await useFetch("/api/entries");
      this.entries = entryData;
    },
    addTag(tag: string) {
      this.activeTags.push(tag);
      this.activeTags = [...new Set(this.activeTags)];
    },
    removeTag(tag: string) {
      this.activeTags = this.activeTags.filter((a) => a !== tag);
    },
    getAllTags() {
      return [...new Set(this.entries.map((a) => a.tags).flat())];
    },
    findById(id: string): Entry | undefined {
      return this.entries.find((a) => a.id === id);
    },
    closeModal() {
      this.modalOpen = false;
    },
    openModal() {
      this.modalOpen = true;
    },
  },
});
