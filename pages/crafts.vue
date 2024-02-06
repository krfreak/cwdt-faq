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
      <CraftPanel v-for="craft in crafts" :key="craft._id" :title="craft.title" :path="craft._path"></CraftPanel>
    </div>
    <div v-else>Loading content...</div>
  </div>
</template>
<script setup lang="ts">
function scrollToTarget(id: string) {
  const { navBottomLink, navKeyFromPath } = useContentHelpers();
  const yOffset = 0;
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth' });
  // if (el) {
  //   const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
  //   window.scrollTo({ top: y, behavior: 'smooth' });
  // }
  // #window.location.hash = el.
}
const { data: crafts, pending } = await useLazyAsyncData('crafts', () => {
  return queryContent().where({ _dir: 'crafts' }).only(['title', 'description', '_id', 'tags', '_path']).find();
});
</script>
