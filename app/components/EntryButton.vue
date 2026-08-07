<template>
  <button class="bg-zinc-700 text-gray-200 sm:hover:bg-red-600 text-left rounded p-2 max-h-40" @click="emit('activateEntry', id)">
    <span class="text m-2 float-left relative">
      {{ title }}
    </span>
    <span class="text-xs tags uppercase p-2 float-right relative">
      {{ tags ? tags.join(' | ') : '' }}
    </span>
  </button>
</template>
<script setup lang="ts">
defineProps<{
  id: string;
  title: string;
  tags: string[];
}>();
const emit = defineEmits<{
  (event: 'activateEntry', id: string): void;
}>();
</script>
<style></style>
