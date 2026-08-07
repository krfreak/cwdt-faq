<template>
  <div class="main bg-zinc-900 text-gray-200 max-w-full max-h-full overflow-hidden text-center sm:text-left" lang="en-US">
    <header>
      <Navbar class="fixed top-0 left-0 right-0 mb-10 z-50" />
    </header>
    <section class="section mt-12 mb-12 -z-1">
      <div class="m-2 mt-8 sm:w-auto sm:h-auto">
        <NuxtPage></NuxtPage>
      </div>
    </section>
    <footer class="px-2 bottom-0 left-0 right-0 z-10 fixed h-10 bg-zinc-700">
      <div class="flex space-x-4">
        <a href="https://discord.gg/jp9vQeHgWY" class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-900 sm:hover:bg-zinc-700" target="_blank">Discord</a>
        <a
          href="https://docs.google.com/spreadsheets/d/1N0J7Zi3PpQoMOeY3jBTltNk4PpRhQDZWF2xUYxidXRk/edit#gid=0"
          class="rounded-t-lg ring-2 ring-amber-500 p-2 bg-zinc-900 sm:hover:bg-zinc-700"
          target="_blank"
          >Shopping List</a
        >
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// import { useFilterStore } from './stores/filters';

// const ready = useFilterStore().loadEntries();
</script>

<style></style>
