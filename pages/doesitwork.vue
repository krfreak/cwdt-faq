<template>
  <div class="content min-h-screen flex flex-col justify-center items-center m-2 mr-6 sm:m-5 sm:min-w-fit">
    <h2 class="text-2xl font-semibold mb-2 text-center">Does the build work in 3.26?</h2>
    <div class="text-green-600 fomp font-extrabold text-center">YES</div>
  </div>
</template>
<script setup lang="ts"></script>

<style scoped>
.fomp {
  font-size: 12vw !important;
  /* Responsive font size for mobile */
}
@media (min-width: 640px) {
  .fomp {
    font-size: 6rem !important;
  }
}
</style>
