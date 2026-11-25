<template>
  <div class="content m-2 mr-6 sm:m-5 sm:min-w-fit text-left">
    <h2 class="text-2xl font-semibold mb-2">PoB Checker (experimental)</h2>
    <p class="mb-3 max-w-3xl">
      Paste your Path of Building code or build link to check your CWDT looper. The build is calculated by Path of Building itself, then checked like the
      <NuxtLink to="/calculator" class="underline">calculator</NuxtLink> does: loop damage against every CWDT threshold, cooldown and Skeleton duration
      breakpoints, ward, flask sustain, gem levels and the usual build breakers.
    </p>
    <p class="mb-3 max-w-3xl text-sm text-gray-400">
      Paste the code from <i>Import/Export Build &gt; Generate</i> in Path of Building, or a build link ({{ supportedLinkSites }}). The active item set, skill
      set and tree are checked, with all flasks active. The check runs in your browser; for a link, this site downloads the build code for you. The first check
      downloads Path of Building (about 6 MB) and needs a few seconds to start; a desktop browser is recommended.
    </p>
    <p>If you happen to find anything wrong with it hit me up on the discord @kreedzfreak</p>

    <form class="flex flex-col max-w-3xl" @submit.prevent="runCheck">
      <label for="pob-code" class="sr-only">PoB code</label>
      <textarea
        id="pob-code"
        v-model="code"
        rows="6"
        class="text-white bg-zinc-700 p-2 font-mono text-sm"
        placeholder="Paste a PoB code or build link"
        spellcheck="false"
        autocomplete="off"
        @focus="warmup"
        @paste="warmup"
      ></textarea>
      <div class="flex gap-2 mt-2 items-center">
        <button
          type="submit"
          class="rounded-md bg-amber-600 hover:bg-amber-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
          :disabled="busy || !code.trim()"
        >
          {{ busy ? 'Checking...' : 'Check PoB' }}
        </button>
        <button type="button" class="rounded-md bg-zinc-700 hover:bg-zinc-600 px-4 py-2" @click="reset">Clear</button>
        <span v-if="busy" class="text-sm text-gray-400" aria-live="polite">{{ progressText }}</span>
      </div>
    </form>

    <p v-if="error" class="mt-4 max-w-3xl text-red-400" role="alert">{{ error }}</p>

    <div v-if="result" class="mt-6 max-w-3xl">
      <div :class="['rounded-md p-3 mb-4 font-semibold', verdictClass]">{{ result.verdict.text }}</div>

      <ul v-if="result.issues.length" class="mb-6 space-y-1">
        <li v-for="(issue, i) in result.issues" :key="i" class="flex gap-2">
          <span :class="['font-mono shrink-0 w-4', severityClass[issue.severity]]" aria-hidden="true">{{ severityMark[issue.severity] }}</span>
          <span class="sr-only">{{ issue.severity }}:</span>
          <span :class="issue.severity === 'info' ? 'text-gray-400' : ''">
            {{ issue.text }}
            <NuxtLink v-if="issue.link" :to="issue.link" class="underline text-sm text-gray-400 ml-1">more</NuxtLink>
          </span>
        </li>
      </ul>

      <section v-for="section in result.sections" :key="section.title" class="mb-6">
        <h3 class="text-xl font-semibold mb-2">{{ section.title }}</h3>
        <div class="divide-y divide-zinc-700">
          <div v-for="m in section.margins" :key="m.label" class="py-1 sm:flex sm:justify-between sm:gap-4">
            <span class="text-gray-400">{{ m.label }}</span>
            <span class="sm:text-right">
              <span :class="marginClass[m.state]">{{ m.value }}</span>
              <span v-if="m.detail" class="block text-xs text-gray-500">{{ m.detail }}</span>
            </span>
          </div>
        </div>
      </section>

      <h3 class="text-xl font-semibold mb-2">Gems</h3>
      <p class="text-sm text-gray-400 mb-2">Effective level and quality as Path of Building calculates them, including +levels from items and supports.</p>
      <div class="overflow-x-auto mb-6">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-gray-400">
              <th class="py-1 pr-4 font-normal">Slot</th>
              <th class="py-1 pr-4 font-normal">Gem</th>
              <th class="py-1 font-normal">Level / Quality</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(g, i) in result.gems" :key="i" class="border-b border-zinc-700">
              <td class="py-1 pr-4">{{ g.slot }}</td>
              <td class="py-1 pr-4">{{ g.name }}</td>
              <td class="py-1">
                {{ g.level }}/{{ g.quality }}
                <span v-if="g.baseLevel !== undefined" class="text-gray-500">(gem {{ g.baseLevel }}/{{ g.baseQuality }})</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-gray-500">
        Path of Building {{ result.meta.pobVersion }} · tree {{ result.meta.treeVersion.replace('_', '.') }} · {{ result.meta.className }} /
        {{ result.meta.ascendClassName }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MarginState, PobCheckResult, Severity } from '#shared/types/pobCheck';
import { supportedLinkSites } from '#shared/utils/pobLinks';
import type { WorkerMessage } from '~/workers/pobcheck.worker';

useHead({ title: 'PoB Checker' });

const code = ref('');
const busy = ref(false);
const error = ref('');
const result = ref<PobCheckResult | null>(null);

// Same colour language as the calculator: lime = works, yellow = careful, red = broken.
const marginClass: Record<MarginState, string> = {
  good: 'text-lime-400 font-bold',
  warn: 'text-yellow-300 font-bold',
  bad: 'text-red-400 font-bold',
  neutral: '',
};
const severityClass: Record<Severity, string> = { error: 'text-red-400', warning: 'text-yellow-300', info: 'text-gray-500' };
const severityMark: Record<Severity, string> = { error: '✗', warning: '!', info: 'i' };

const verdictClass = computed(() => {
  switch (result.value?.verdict.state) {
    case 'good':
      return 'bg-green-900 text-green-200';
    case 'bad':
      return 'bg-zinc-800 text-red-300 ring-1 ring-red-500';
    default:
      return 'bg-zinc-800 text-amber-300 ring-1 ring-amber-500';
  }
});

// Path of Building runs in a Web Worker (app/workers/pobcheck.worker.ts). It is created on first
// use and kept, so later checks skip the download and startup.
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: PobCheckResult) => void; reject: (e: Error) => void }>();
const progressText = ref('');

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/pobcheck.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      if (msg.stage === 'download') {
        progressText.value = msg.total
          ? `Downloading Path of Building… ${Math.round(((msg.loaded ?? 0) / msg.total) * 100)}%`
          : 'Downloading Path of Building…';
      } else if (msg.stage === 'link') {
        progressText.value = 'Downloading the build…';
      } else if (msg.stage === 'starting') {
        progressText.value = 'Starting Path of Building…';
      } else {
        progressText.value = 'Calculating your build…';
      }
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.type === 'result') entry.resolve(msg.result);
    else entry.reject(new Error(msg.message));
  };
  worker.onerror = () => {
    for (const [, entry] of pending) entry.reject(new Error('The PoB checker stopped unexpectedly. Reload the page and try again.'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Starts downloading and booting Path of Building while the user pastes their code. */
function warmup() {
  getWorker().postMessage({ type: 'warmup' });
}

function checkInWorker(pobCode: string): Promise<PobCheckResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'check', id, code: pobCode });
  });
}

async function runCheck() {
  busy.value = true;
  error.value = '';
  result.value = null;
  progressText.value = 'Calculating your build…';
  try {
    result.value = await checkInWorker(code.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'The check failed. Reload the page and try again.';
  } finally {
    busy.value = false;
  }
}

function reset() {
  code.value = '';
  result.value = null;
  error.value = '';
}

onBeforeUnmount(() => {
  worker?.terminate();
  worker = null;
});
</script>
