<template>
  <button @click="">
    {{ $props.text }}
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  text: string;
}>();
</script>

<style>
button {
  border-radius: 4px;
  border-color: #790000;
  background-color: #020202;
  color: #aeaeae;
  padding: 0.5rem;
  margin: 4px 2px;
  outline: none;
}
</style>
