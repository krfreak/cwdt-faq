<template>
  <form class="flex flex-col flex-wrap p-2 justify-start maxform" @submit.prevent="">
    <h2 class="text-xl">Ward Calculator</h2>
    <label for="helmet">Helmet</label>
    <input id="helmet" v-model="helmet" type="number" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="gloves">Gloves</label>
    <input id="gloves" v-model="gloves" type="number" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="boots">Boots</label>
    <input id="boots" v-model="boots" type="number" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="flask">Flask increased ward %</label>
    <input id="flask" v-model="flask" type="number" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="flask_effect">Flask increased 25% increased effect?</label>
    <input id="flask_effect" v-model="flaskEffect" type="checkbox" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="armour">Armour Global Defences %</label>
    <input id="armour" v-model="armour" type="number" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="survival_secrets">Suvival Secrets?</label>
    <input id="survival_secrets" v-model="survivalSecrets" type="checkbox" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <label for="staff_mastery">Staff Mastery?</label>
    <input id="staff_mastery" v-model="staffMastery" type="checkbox" class="text-white bg-zinc-700 p-1" @input="calculateWard" />
    <b>Total Ward: {{ totalWard }}</b>
  </form>
</template>
<script setup lang="ts">
const gloves = ref(476);
const helmet = ref(694);
const boots = ref(491);
const flask = ref(0);
const flaskEffect = ref(false);
const armour = ref(100);
const totalWard = ref(0);
const survivalSecrets = ref(false);
const staffMastery = ref(true);

const survivalSecretsMod = 0.8;
const flaskEffectMod = 1.25;

const calculateWard = () => {
  const flaskValue = 200 * (flaskEffect.value === true ? (survivalSecrets.value === true ? 1.05 : flaskEffectMod) : 1);
  const ward = gloves.value + helmet.value + boots.value + flaskValue;
  const armourValue =
    Math.floor(
      100 *
        ((100 +
          armour.value +
          (staffMastery.value === true ? 30 : 0) +
          flask.value * (flaskEffect.value === true ? (survivalSecrets.value === true ? 1.05 : flaskEffectMod) : 1)) /
          100),
    ) / 100;
  totalWard.value = Math.round(Math.floor(ward * armourValue) * (survivalSecrets.value === true ? 0.44 : 0.3));
};
</script>
<style>
.maxform {
  max-width: 200px;
}
</style>
