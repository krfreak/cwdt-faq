<template>
  <Disclosure v-slot="{ open }" as="nav" class="bg-zinc-700 drop-shadow">
    <div class="mx-auto px-2 sm:px-6 lg:px-8">
      <div class="relative flex h-16 items-center justify-between">
        <div class="absolute inset-y-0 left-0 flex items-center sm:hidden">
          <!-- Mobile menu button-->
          <DisclosureButton
            class="relative inline-flex items-center justify-center rounded-md p-2 text-gray-200 hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
          >
            <span class="absolute -inset-0.5" />
            <span class="sr-only">Open main menu</span>
            <Bars3Icon v-if="!open" class="block h-6 w-6" aria-hidden="true" />
            <XMarkIcon v-else class="block h-6 w-6" aria-hidden="true" />
          </DisclosureButton>
        </div>
        <div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
          <div class="flex flex-shrink-0 items-center">
            <NuxtLink to="/"><img class="h-8 w-auto" src="/img/cwdt.png" alt="CWDT" /></NuxtLink>
          </div>
          <div class="hidden sm:ml-6 sm:block">
            <div class="flex space-x-4 flex-1 space-y-0">
              <NuxtLink
                v-for="item in navigation"
                :key="item.name"
                :to="item.href"
                :class="['text-gray-200 hover:bg-zinc-900', 'rounded-md px-3 py-2 text-sm font-semibold uppercase']"
                >{{ item.name }}</NuxtLink
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <DisclosurePanel class="sm:hidden">
      <div class="space-y-1 px-2 pb-3 pt-2">
        <NuxtLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          as="a"
          :class="['text-gray-200 hover:bg-zinc-900 hover:text-white', 'block rounded-md px-3 py-1 text-base font-medium']"
          >{{ item.name }}
        </NuxtLink>
      </div>
    </DisclosurePanel>
  </Disclosure>
</template>
<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
const route = useRoute();
const navigation = [
  { name: 'Home', href: '/' },
  { name: 'FAQ', href: '/faq' },
  { name: 'Crafting', href: '/crafts' },
  { name: 'Example PoBs', href: '/pobs' },
  { name: 'Calculator', href: '/calculator' },
  { name: 'Tools', href: '/tools' },
  { name: 'Does it still work?', href: '/doesitwork' },
];
</script>
