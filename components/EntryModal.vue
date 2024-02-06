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
      <button class="rounded text-gray-200 hover:bg-red-400 p-2 bg-zinc-900" @click="emit('close')">Close</button>
    </div>
  </dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  path: string;
  isOpen: boolean;
}>();
const emit = defineEmits(['close']);
const dialogElement = ref<HTMLDialogElement | null>(null);

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
