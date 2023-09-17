<template>
  <div v-if="modalOpen" class="modal-overlay" @click="closeModal">
    <dialog
      :open="modalOpen"
      @close="closeModal"
      class="rounded bg-zinc-700 p-2 text-gray-200 m-5 text-left modal-body"
    >
      <ContentRenderer
        :value="data"
        class="markdown-body bg-zinc-900 p-2 m-2 overflow-y-auto max-h-96 break-all hyphens-auto"
      />
      <button
        @click="closeModal"
        class="rounded text-gray-200 hover:bg-red-400 p-2 ml-1 mt-2 sm:float-right bg-red-600"
      >
        Close
      </button>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { useFilterStore } from "~/stores/filters";
const props = defineProps<{
  title: string;
  path: string;
}>();

const { data } = await useAsyncData("faq", () =>
  queryContent(props.path).findOne()
);

const filterStore = useFilterStore();
const modalOpen = computed(() => filterStore.modalOpen);
const closeModal = () => filterStore.closeModal();
</script>
