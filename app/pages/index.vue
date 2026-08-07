<template>
  <div class="content ml-1">
    <article>
      <section>
        <h1 class="text-3xl">Hello fellow CWDT enjoyer!</h1>
        <p>
          <NuxtLink to="/doesitwork" :class="['text-gray-200 hover:bg-zinc-900', 'rounded-md px-3 py-2 text-sm font-semibold uppercase']"
            >Does the build still work?</NuxtLink
          >
        </p>
        <p>Need to learn something about the build? Head over to the <NuxtLink class="text-blue-600 sm:hover:underline" to="/faq/">FAQ</NuxtLink>.</p>
        <p>
          Need a written guide? Head over to the
          <a href="https://www.pathofexile.com/forum/view-thread/3261066/page/1" class="text-blue-600 sm:hover:underline" target="_blank">forum</a>.
        </p>
        <p>Need crafting advice? Check out the <NuxtLink to="/crafts" class="text-blue-600 sm:hover:underline">Crafting section</NuxtLink>.</p>
        <p>
          Example PoBs for a plethora of build variations can be found at <NuxtLink to="/pobs" class="text-blue-600 sm:hover:underline">Example PoBs</NuxtLink>.
        </p>
        <p>Need to calculate your Flasks or Loop Setup check the <NuxtLink to="/calculator" class="text-blue-600 sm:hover:underline">Calculator</NuxtLink>.</p>
      </section>
    </article>
    <article>
      <section>
        <p>Or perhaps you like a video about it?</p>
        <iframe
          width="560"
          height="315"
          src="https://www.youtube-nocookie.com/embed/fC8LKqHDdmY?si=bMKd9abEtMbtAHDH"
          title="YouTube video player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </section>
    </article>
  </div>
</template>

<script setup></script>
