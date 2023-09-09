<template>
  <div class="component">
    <div v-html="text"></div>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{
  text: string;
}>();
</script>
<style>
.component {
  border-radius: 4px;
  border: 2px solid #aa0000;
  background-color: #020202;
  color: #aeaeae;
  padding: 0.5rem;
  margin: 4px 2px;
}
</style>
