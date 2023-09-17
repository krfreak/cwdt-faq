<template>
  <div class="content m-2 mr-6 sm:m-5 sm:min-w-fit">
    <h1>Crafting Cookbook</h1>
    <div v-if="!pending">
      <button
        class="rounded bg-zinc-700 p-2 m-1 sm:mr-2 hover:bg-red-600 focus:bg-zinc-700"
        v-for="craft in crafts"
        :key="craft.title"
        @click="scrollToTarget(craft.title)"
      >
        {{ craft.title }}
      </button>
      <CraftPanel
        v-for="craft in crafts"
        :key="craft._id"
        :title="craft.title"
        :path="craft._path"
      ></CraftPanel>
    </div>
    <div v-else>Loading content...</div>
  </div>
</template>
<script setup lang="ts">
interface Craft {
  title: string;
  text: string;
}

function scrollToTarget(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView();
  }
}
const { data: crafts, pending } = await useLazyAsyncData("faq", () => {
  return queryContent()
    .where({ _dir: "crafts" })
    .only(["title", "description", "_id", "tags", "_path"])
    .find();
});
</script>
