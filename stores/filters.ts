import { defineStore } from "pinia";

export const useFilterStore = defineStore("filters", {
  state: () => ({
    activeTags: [] as string[],
    activeEntry: "",
  }),
  actions: {
    addTag(tag: string) {
      this.activeTags.push(tag);
      this.activeTags = [...new Set(this.activeTags)];
    },
    removeTag(tag: string) {
      this.activeTags = this.activeTags.filter((a) => a !== tag);
    },
    setActiveEntry(id: string) {
      this.activeEntry = id;
    },
  },
});
