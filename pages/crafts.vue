<template>
  <div class="content m-2 mr-6 sm:m-5 sm:min-w-fit">
    <h1>Crafting Cookbook</h1>
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
      :key="craft.title"
      :id="craft.title"
      :title="craft.title"
      :text="craft.text"
    ></CraftPanel>
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

const crafts: Craft[] = [
  {
    title: "Boots",
    text: "/crafts/boots",
  },
  {
    title: "Crown and Gauntlets",
    text: "/crafts/crown_and_gauntlet",
  },
  {
    title: "27 CDR Belt",
    text: "/crafts/27_cdr_belt",
  },
  {
    title: "Endgame CDR Belt",
    text: "/crafts/endgame_cdr_belt",
  },
  {
    title: "+2 Amulet",
    text: "/crafts/+2_amulet",
  },
  {
    title: "Omni Rare Ring",
    text: "/crafts/omni_rare_ring",
  },
];
</script>
