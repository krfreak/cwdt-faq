<template>
  <div class="content m-2 mr-6 sm:m-5 sm:min-w-fit">
    <ContentRenderer v-if="page" :value="page" class="markdown-body"></ContentRenderer>
  </div>
</template>
<script setup lang="ts">
const { data: page } = await useAsyncData('pobs-example', () => {
  return queryCollection('pobs').path('/pobs/example_pobs').first();
});
</script>
