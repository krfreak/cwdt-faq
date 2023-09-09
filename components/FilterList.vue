<template>
  <div class="filter-list">
    <FilterButton v-for="filter in filters" :text="`${filter}`"></FilterButton>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  filters: String[];
}>();
</script>

<style></style>
