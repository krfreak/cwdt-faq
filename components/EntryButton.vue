<template>
  <button class="bg-zinc-700 text-gray-200 sm:hover:bg-red-600 rounded p-2 mr-3" @click="emit('activateEntry', id)">
    <span class="text -m-2">
      {{ title }}
    </span>
    <span class="tags">
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
