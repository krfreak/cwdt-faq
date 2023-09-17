import { defineStore } from "pinia";
import { Entry } from "~/server/models/entry.model";

export const useFilterStore = defineStore("filters", {
  state: () => ({
    activeTags: [] as string[],
    activeEntry: null as Entry | null,
    modalOpen: false,
    entries: [] as Entry[],
  }),
  actions: {
    async loadEntries() {
      const { data: entryData } = await useAsyncData("faq", () => {
        return queryContent()
          .where({ _dir: "faq" })
          .only(["title", "description", "_id", "tags", "_path"])
          .find();
      });
      this.entries = entryData.value as Entry[];
    },
    addActiveTag(tag: string) {
      this.activeTags.push(tag);
      this.activeTags = [...new Set(this.activeTags)];
    },
    removeActiveTag(tag: string) {
      this.activeTags = this.activeTags.filter((a) => a !== tag);
    },
    removeAllActiveTags() {
      this.activeTags = [];
    },
    getAllTags() {
      if (this.entries)
        return [...new Set(this.entries.map((a) => a.tags).flat())];
      else return [];
    },
    findById(id: string): Entry | undefined {
      return this.entries.find((a) => a._id === id);
    },
    closeModal() {
      this.modalOpen = false;
      this.activeEntry = null;
    },
    openModal() {
      this.modalOpen = true;
    },
    setActiveEntry(entry: Entry | null) {
      this.activeEntry = entry;
    },
  },
});
