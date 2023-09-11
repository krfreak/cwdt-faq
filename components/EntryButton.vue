<template>
  <button
    @click="$emit('activateEntry', id)"
    class="bg-zinc-700 text-gray-200 hover:bg-red-600 rounded p-2 ml-1"
  >
    <span class="text -m-2">
      {{ text }}
    </span>
    <span class="tags">
      {{ tags ? tags.join(" | ") : "" }}
    </span>
  </button>
</template>
<script setup lang="ts">
const props = defineProps<{
  id: string;
  text: string;
  tags: string[];
}>();
</script>
<style></style>
