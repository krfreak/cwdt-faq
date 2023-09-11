<template>
  <div v-if="modalOpen" class="modal-overlay" @click="closeModal">
    <dialog
      :open="modalOpen"
      @close="closeModal"
      class="rounded bg-zinc-700 p-2 text-gray-200"
    >
      <h1 class="font-bold text-xl mb-2 border-b-2 border-gray-200">
        {{ title }}
      </h1>
      <p v-html="text" />
      <button
        @click="closeModal"
        class="rounded text-gray-200 hover:bg-red-400 rounded p-2 ml-1 mt-2 float-right bg-red-600"
      >
        Close
      </button>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { useFilterStore } from "~/stores/filters";

const props = defineProps<{
  title: string;
  text: string;
}>();
const filterStore = useFilterStore();
const modalOpen = computed(() => filterStore.modalOpen);
const closeModal = () => filterStore.closeModal();
</script>
