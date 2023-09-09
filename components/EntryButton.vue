<template>
  <button @click="$emit('activateEntry', _id)">
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
<style>
button {
  border-radius: 4px;
  border: 2px solid #790000;
  background-color: #020202;
  color: #aeaeae;
  padding: 0.5rem;
  margin: 4px 2px;
}
button:hover {
  border-color: #aa0000;
}
.tags {
  margin-left: 1.5rem;
  font-size: smaller;
  font-weight: bold;
}
</style>
