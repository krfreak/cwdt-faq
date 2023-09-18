<template>
  <div class="main bg-zinc-900 text-gray-200 max-w-full max-h-full overflow-hidden text-center sm:text-left">
    <header>
      <Navbar />
    </header>
    <section class="section">
      <div class="m-2 sm:w-auto">
        <NuxtPage></NuxtPage>
      </div>
    </section>
    <footer class="mx-2 px-2 mt-auto z-100">
      <div class="flex space-x-4">
        <a href="https://discord.gg/jp9vQeHgWY" class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-700 hover:bg-zinc-900" target="_blank">Discord</a>
        <a href="https://returnx.github.io/cwdt/" class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-700 hover:bg-zinc-900" target="_blank">Calculator</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// import { useFilterStore } from './stores/filters';

// const ready = useFilterStore().loadEntries();
</script>

<style></style>
