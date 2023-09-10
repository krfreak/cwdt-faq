<template>
  <button
    @click="$emit('activateEntry', _id)"
    class="bg-zinc-700 text-gray-200 hover:bg-red-600"
  >
    <span class="text">
      {{ text }}
    </span>
    <span class="tags">
      {{ tags.join(" | ") }}
    </span>
  </button>
</template>
<script setup lang="ts">
const props = defineProps<{
  _id: string;
  text: string;
  tags: [string];
}>();
</script>
<style></style>
