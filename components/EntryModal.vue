<template>
  <dialog ref="dialogElement" class="modal bg-zinc-900 text-gray-200 text-left" @click="closeModal" @keyup.esc="emit('close')" @keydown.esc="emit('close')">
    <div class="modal__content overflow-y-auto">
      <ContentDoc :path="path" class="markdown-body break-word hyphens-auto">
        <template #not-found>
          <p>No content found.</p>
        </template>
      </ContentDoc>
    </div>
    <div class="modal__footer bg-zinc-700">
      <button class="rounded text-gray-200 hover:bg-green-400 p-2 bg-zinc-900 mr-2" @click="copyURL()">
        <span v-if="!copied">Link</span>
        <span v-else>Copied!</span>
      </button>
      <button class="rounded text-gray-200 hover:bg-red-400 p-2 bg-zinc-900" @click="emit('close')">Close</button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core';
const props = defineProps<{
  title: string;
  path: string;
  isOpen: boolean;
}>();
const emit = defineEmits(['close']);
const dialogElement = ref<HTMLDialogElement | null>(null);
const route = useRoute();

const input = ref(route.hash);

const { text, isSupported, copied, copy } = useClipboard({ source: input });

async function copyURL() {
  await copy(window.location.host + props.path);
}

function closeModal({ target }: MouseEvent): void {
  if (target !== dialogElement.value) return;
  emit('close');
}

effect(() => {
  const dialog = dialogElement.value;
  if (!dialog || dialog.open === props.isOpen) return;
  if (props.isOpen) {
    dialogElement.value?.showModal();
  } else {
    dialogElement.value?.close();
  }
});
</script>
