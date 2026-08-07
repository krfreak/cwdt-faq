<template>
  <div class="content m-2 mr-6 sm:m-5 sm:min-w-fit">
    <h1>Crafting Cookbook</h1>
    <p class="italic">If you happen to find better ways to craft these items please do tell us in the discord!</p>
    <div v-if="!pending">
      <button
        v-for="craft in crafts"
        :key="craft.title"
        class="rounded bg-zinc-700 p-2 m-1 sm:mr-2 hover:bg-red-600 focus:bg-zinc-700"
        @click="scrollToTarget(craft.title)"
      >
        {{ craft.title }}
      </button>
      <CraftPanel v-for="craft in crafts" :key="craft.id" :title="craft.title" :path="craft.path"></CraftPanel>
    </div>
    <div v-else>Loading content...</div>
  </div>
</template>
<script setup lang="ts">
function scrollToTarget(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth' });
}
const { data: crafts, pending } = await useLazyAsyncData('crafts', () => {
  return queryCollection('crafts').select('id', 'title', 'description', 'path', 'tags').all();
});
</script>
