// Scenario tests for the CWDT loop simulation (shared/utils/pobAnalysis.ts simulateLoop).
// Each case mirrors a real setup or a way the loop breaks.
//
//   pnpm pob:test
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { simulateLoop } = await import(path.join(here, '../shared/utils/pobAnalysis.ts'));

const skeletons = (o = {}) => ({ key: 'skel', durationTicks: 6, hitsPerSummon: 3, hitDamage: 840, ...o });
const spirits = (o = {}) => ({ key: 'srs', durationTicks: 40, hitsPerSummon: 1, hitDamage: 735, ...o });
const loop = (summons, o = {}) => ({ key: 'loop', threshold: 725, cooldownTicks: 6, summons, castsFR: true, ...o });
const body = (o = {}) => ({ key: 'body', threshold: 2944.8, cooldownTicks: 6, summons: [], castsFR: false, ...o });
const fr = (o = {}) => ({ key: 'fr', threshold: 1635, cooldownTicks: 6, summons: [], castsFR: true, ...o });

const cases = [];
const t = (name, params, check) => {
  const r = simulateLoop(params);
  try {
    check(r);
    cases.push(`ok   ${name}`);
  } catch (e) {
    cases.push(`FAIL ${name}: ${e.message}\n     ${JSON.stringify(r)}`);
  }
};

// Standard 2-ring helm setup (SS11 + FR1 + CWDT5): 3 skeletons x 840, FR 1000, matched 6/6 ticks
t('matched ticks, FR linked: sustained, Ice Spear every cycle', { cwdts: [loop([skeletons()]), body()], frDamage: 1000 }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 6);
  assert.equal(r.firesPerCycle.body, 1);
  assert.equal(r.frHitsPerCycle, 1);
});
t('duration shorter than cooldown: stops after 1 cycle (cooldown)', { cwdts: [loop([skeletons({ durationTicks: 5 })]), body()], frDamage: 1000 }, (r) => {
  assert.equal(r.sustained, false);
  assert.equal(r.stopReason.kind, 'cooldown');
  assert.equal(r.stopReason.cycle, 1);
});
t('duration longer than cooldown: sustained at duration pace', { cwdts: [loop([skeletons({ durationTicks: 7 })]), body()], frDamage: 1000 }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 7);
  assert.equal(r.firesPerCycle.body, 1);
});
t('FR-linked CWDT short of Skeleton damage: stops (damage), FR damage not counted', { cwdts: [loop([skeletons()], { threshold: 2600 }), body()], frDamage: 5000 }, (r) => {
  assert.equal(r.sustained, false);
  assert.equal(r.stopReason.kind, 'damage');
});
t('body short but over half: half speed, loop sustained', { cwdts: [loop([skeletons()]), body({ threshold: 4000 })], frDamage: 1000 }, (r) => {
  assert.equal(r.sustained, true);
  assert.ok(Math.abs(r.firesPerCycle.body - 0.5) < 0.01, `body ${r.firesPerCycle.body}`);
});
// Rare ring (one Heartbound): helm SS21 + CWDT20 (2912), gloves FR + CWDT12 (1635); 4 x 420 = 1680
const rare = (frCd, frThr = 1635) => ({
  cwdts: [loop([skeletons({ hitsPerSummon: 4, hitDamage: 420 })], { threshold: 2912.08, castsFR: false }), fr({ cooldownTicks: frCd, threshold: frThr }), body()],
  frDamage: 1330,
});
t('rare ring setup: sustained, FR every cycle', rare(6), (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.firesPerCycle.fr, 1);
  assert.equal(r.firesPerCycle.loop, 1);
  assert.equal(r.firesPerCycle.body, 1);
});
t('rare ring, FR CWDT on a slower cooldown: loop stops when FR misses', rare(7), (r) => {
  assert.equal(r.sustained, false);
  assert.equal(r.stopReason.kind, 'damage');
});
t('rare ring, FR CWDT above Skeleton damage: FR never fires, loop stops', rare(6, 1700), (r) => assert.equal(r.sustained, false));
t('no FR at all but Skeletons alone enough: sustained', { cwdts: [loop([skeletons()], { castsFR: false, threshold: 2000 }), body({ threshold: 2500 })], frDamage: 0 }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.firesPerCycle.body, 1);
});
t('Triggerbots: double skeleton deaths count', { cwdts: [loop([skeletons({ hitsPerSummon: 8, hitDamage: 420 })], { castsFR: false, threshold: 3000 })], frDamage: 0 }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.hitsPerCycle.skel, 8);
});
// Summon Raging Spirit setups (FAQ rzofsrs): minions outlive the cooldown
t('SRS only, fresh start: one chain, loop runs at the spirit duration', { cwdts: [loop([spirits()], { castsFR: false, threshold: 448.8 })], frDamage: 0 }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 40);
});
t('SRS only, pipeline full: triggers fall back to the cooldown breakpoint', { cwdts: [loop([spirits()], { castsFR: false, threshold: 448.8 })], frDamage: 0, start: 'saturated' }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 6);
});
t('SRS duration a multiple of the cooldown: pipeline reaches the cooldown rate', { cwdts: [loop([spirits({ durationTicks: 42 })], { castsFR: false, threshold: 448.8 })], frDamage: 0, start: 'saturated' }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 6);
});
const faqSetup = { cwdts: [loop([skeletons({ durationTicks: 158, hitDamage: 735 }), spirits()], { castsFR: false, threshold: 690.2 }), body({ threshold: 2748.48 })], frDamage: 0 };
t('Skeletons + SRS (FAQ setup), fresh start: sustained on one chain', faqSetup, (r) => {
  assert.equal(r.sustained, true);
  assert.ok(r.periodTicks > 30, `period ${r.periodTicks}`);
});
t('Skeletons + SRS (FAQ setup), pipeline full: cooldown rate, Ice Spear every cycle', { ...faqSetup, start: 'saturated' }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 6);
  assert.equal(r.firesPerCycle.body, 1);
});
t('Skeletons + SRS, pipeline full, body short of one cycle: every 2 cycles', { ...faqSetup, cwdts: [faqSetup.cwdts[0], body({ threshold: 3000 })], start: 'saturated' }, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.firesPerCycle.body, 0.5);
});
t('duration one tick over the cooldown (one chain only): no pipeline, loop at duration pace', { cwdts: [loop([skeletons({ durationTicks: 7 })]), body()], frDamage: 1000, start: 'saturated' }, (r) => {
  assert.equal(r.periodTicks, 7);
});
t('minions that die during the cooldown are lost, but others keep the loop going', {
  cwdts: [loop([skeletons({ durationTicks: 3, hitDamage: 735 }), spirits()], { castsFR: false, threshold: 690.2 })],
  frDamage: 0,
}, (r) => {
  assert.equal(r.sustained, true);
  assert.equal(r.periodTicks, 40);
});

console.log(cases.join('\n'));
if (cases.some((c) => c.startsWith('FAIL'))) process.exit(1);
