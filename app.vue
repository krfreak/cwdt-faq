<template>
  <div class="main bg-zinc-900 text-gray-200">
    <header>
      <Navbar />
    </header>
    <section class="section">
      <div class="container m-5 flex flex-auto">
        <NuxtPage></NuxtPage>
      </div>
    </section>
    <footer class="mx-2 px-2 my-auto z-100">
      <div class="flex space-x-4">
        <a
          href="https://discord.gg/jp9vQeHgWY"
          class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-700 hover:bg-zinc-900"
          >Discord</a
        >
        <a
          href="https://returnx.github.io/cwdt/"
          class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-700 hover:bg-zinc-900"
          >Calculator</a
        >
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useFilterStore } from "./stores/filters";

const ready = await useFilterStore().loadEntries();
</script>

<style></style>
