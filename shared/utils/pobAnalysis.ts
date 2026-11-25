// CWDT looper analysis on top of the numbers Path of Building calculates (see pob-wasm/extract.lua).
//
// The loop is simulated tick by tick (simulateLoop), following the site's calculator
// (returnx.github.io/cwdt) and the FAQ:
// - a CWDT counts damage only while it is off cooldown; when its count reaches the threshold it
//   triggers, resets and goes on cooldown. Damage taken while on cooldown is lost, so the CWDT that
//   triggers Forbidden Rite never counts Forbidden Rite's own damage;
// - every Skeleton dies after the Skeleton duration and hits you with all Heartbound Loops combined;
// - Forbidden Rite hits you when it is cast;
// - cooldowns and durations are rounded up to 33ms server ticks (as PoB and the game do).
// The loop only keeps itself running if the Skeleton CWDT triggers again every time the Skeletons
// die; one miss and no new Skeletons are summoned until the next weapon swap.
import type {
  Finding,
  GemRow,
  Margin,
  MarginSection,
  MarginState,
  PobCheckResult,
  PobFacts,
  PobFlask,
  PobGroup,
  PobItem,
  PobSkill,
  PobSkillCalc,
} from '#shared/types/pobCheck';

export class PobCheckError extends Error {}

const TICK = 0.033;
/** Minion skills whose minions die on their own and set off Heartbound Loop */
const MINION_LOOP_SKILLS = new Set(['Summon Skeletons', 'Summon Raging Spirit', 'Raise Zombie of Falling']);
const CWDT_COOLDOWN = 0.25;

// Character level required by Summon Skeletons per gem level, and the highest level requirement a
// Cast when Damage Taken gem supports per gem level (PoB Data/Skills). PoB does not model this rule,
// so it is checked here on the gem levels as entered.
const SKELETON_LEVEL_REQUIREMENT = [10, 13, 17, 21, 25, 29, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 68, 70, 72, 74, 76, 78, 80];
const CWDT_MAX_SUPPORTED_REQUIREMENT = [
  38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 65, 66, 67, 68, 69, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  100,
];


const LINKS = {
  cdr: '/faq/cdr_breakpoints',
  toDust: '/faq/how_do_to_dust_jewels_work',
  loopSpeed: '/faq/loop_speed',
  gemLinks: '/faq/gem_links',
  mana: '/faq/mana_issues',
  rareRing: '/faq/rare_ring',
  pantheon: '/faq/pantheon',
  keepDying: '/faq/keep_dying',
  flasks: '/faq/four_flasks',
  startLoop: '/faq/start_the_loop',
  pobSetup: '/faq/pob_setup',
  clusters: '/faq/cluster_jewels',
  rzofsrs: '/faq/rzofsrs',
  calculator: '/calculator',
};

// ---- formatting ----

const fmt = (n: number, digits = 0) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n: number, digits = 0) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), digits)}`;
const pct = (part: number, whole: number) => (whole > 0 ? ` (${signed((part / whole) * 100, 1)}%)` : '');
const seconds = (s: number) => `${fmt(s, 3)}s`;
const ticksOf = (s: number) => Math.round(s / TICK);

// ---- flask simulation, ported from the calculator (calc.js simulateFlask) ----

type FlaskSimResult = { kind: 'works' } | { kind: '30min' } | { kind: 'fails'; afterSeconds: number };

function simulateFlask(per3s: number, per5s: number, maxCharges: number, chargesUsed: number, durationTicks: number, useWhenFull: boolean): FlaskSimResult {
  // Server ticks, 30 per second
  const three = 3 * 30;
  const five = 5 * 30;
  if (chargesUsed > maxCharges) return { kind: 'fails', afterSeconds: 0 };
  let charges = maxCharges;
  let expiresOn = 0;
  let tick = 0;
  for (;;) {
    if (tick % three === 0) charges += per3s;
    if (tick % five === 0) charges += per5s;
    charges = Math.min(maxCharges, charges);
    // Back to full charges on a multiple of 15 seconds means the cycle repeats forever
    if (tick > 0 && tick % (3 * five) === 0 && charges === maxCharges) return { kind: 'works' };
    if (useWhenFull && charges === maxCharges) {
      charges -= chargesUsed;
      expiresOn = tick + durationTicks;
    }
    if (tick >= expiresOn) {
      if (!useWhenFull && charges >= chargesUsed) {
        charges -= chargesUsed;
        expiresOn = tick + durationTicks;
      } else {
        return { kind: 'fails', afterSeconds: tick / 30 };
      }
    }
    const next3 = Math.ceil((tick + 1) / three) * three;
    const next5 = Math.ceil((tick + 1) / five) * five;
    tick = Math.min(next3, next5, expiresOn > tick ? expiresOn : Infinity);
    if (tick >= 30 * 60 * 30) return { kind: '30min' };
  }
}

// ---- loop simulation ----

/** A minion type a CWDT summons; each minion dies after its duration and hits you through Heartbound Loop. */
export interface LoopMinion {
  key: string;
  durationTicks: number;
  /** Minions per trigger (Triggerbots double the casts) */
  hitsPerSummon: number;
  /** Damage of one death (all Heartbound Loops combined, after mitigation) */
  hitDamage: number;
}

export interface LoopCwdt {
  key: string;
  threshold: number;
  cooldownTicks: number;
  /** Minions this CWDT summons; the first CWDT with minions is the loop CWDT */
  summons: LoopMinion[];
  /** Triggers Forbidden Rite */
  castsFR: boolean;
}

export interface LoopParams {
  cwdts: LoopCwdt[];
  frDamage: number;
  /** Simulated time; long enough for pipelines (minions outliving the cooldown) to warm up */
  seconds?: number;
  /**
   * fresh: one trigger, as right after a weapon swap (one chain; the loop's lower bound).
   * saturated: as if the loop CWDT had triggered every cooldown for as long as its minions live,
   * i.e. the pipeline packed as full as collisions allow (upper bound in combat).
   */
  start?: 'fresh' | 'saturated';
}

export interface LoopSimResult {
  sustained: boolean;
  /** Why the loop stopped: minions died while the loop CWDT was on cooldown, or it counted too little damage */
  stopReason?: { kind: 'cooldown' | 'damage'; counted: number; cycle: number };
  /** Steady state: average ticks between triggers of the loop CWDT */
  periodTicks: number;
  /** Steady state: triggers per loop cycle, per CWDT key (1 = every cycle, 0.5 = every other cycle) */
  firesPerCycle: Record<string, number>;
  /** Steady state: minion deaths per loop cycle, per minion key */
  hitsPerCycle: Record<string, number>;
  frHitsPerCycle: number;
}

/**
 * Simulates the loop tick by tick from a fresh start (the loop CWDT just triggered, as after a
 * weapon swap). Within a tick, minion deaths are processed first, then the Forbidden Rite casts they
 * trigger; each damage event is offered to every CWDT that is off cooldown. Minions that outlive the
 * cooldown form a pipeline: deaths from earlier triggers keep arriving, so the loop can speed up
 * over the first seconds; the steady state is measured over the last quarter of the run.
 */
export function simulateLoop(p: LoopParams): LoopSimResult {
  const maxTicks = Math.round((p.seconds ?? 120) / TICK);
  const state = p.cwdts.map((c) => ({ ...c, counter: 0, readyAt: 0, fires: [] as number[] }));
  const deaths = new Map<number, { minion: LoopMinion; count: number }[]>();
  const hitTicks = new Map<string, number[]>();
  const frHitTicks: number[] = [];
  let lastDeath = 0;
  const loopCwdt = state.find((c) => c.summons.some((m) => m.hitsPerSummon > 0));
  const empty: LoopSimResult = { sustained: false, stopReason: { kind: 'damage', counted: 0, cycle: 1 }, periodTicks: 0, firesPerCycle: {}, hitsPerCycle: {}, frHitsPerCycle: 0 };
  if (!loopCwdt) return empty;

  const queue: { kind: 'hit' | 'fr'; damage: number; key: string }[] = [];
  const fire = (c: (typeof state)[number], tick: number) => {
    c.counter = 0;
    c.readyAt = tick + c.cooldownTicks;
    c.fires.push(tick);
    for (const m of c.summons) {
      const at = tick + Math.max(1, m.durationTicks);
      const list = deaths.get(at) ?? [];
      list.push({ minion: m, count: m.hitsPerSummon });
      deaths.set(at, list);
    }
    if (c.castsFR && p.frDamage > 0) queue.push({ kind: 'fr', damage: p.frDamage, key: 'fr' });
  };

  if (p.start === 'saturated') {
    // Minions from earlier triggers, one trigger per cooldown back through the longest duration
    const longest = loopCwdt.summons.reduce((a, m) => Math.max(a, m.durationTicks), 0);
    for (let at = -loopCwdt.cooldownTicks; at > -longest; at -= loopCwdt.cooldownTicks) {
      for (const m of loopCwdt.summons) {
        const death = at + Math.max(1, m.durationTicks);
        if (death <= 0) continue;
        const list = deaths.get(death) ?? [];
        list.push({ minion: m, count: m.hitsPerSummon });
        deaths.set(death, list);
      }
    }
  }
  // The loop starts with the loop CWDT just triggered
  fire(loopCwdt, 0);
  let tick = 0;
  let stopReason: LoopSimResult['stopReason'];
  for (;;) {
    while (queue.length) {
      const event = queue.shift()!;
      if (event.kind === 'fr') frHitTicks.push(tick);
      else (hitTicks.get(event.key) ?? hitTicks.set(event.key, []).get(event.key)!).push(tick);
      for (const c of state) {
        if (tick < c.readyAt) continue;
        c.counter += event.damage;
        if (c.counter >= c.threshold) fire(c, tick);
      }
    }
    let next = Infinity;
    for (const k of deaths.keys()) if (k < next) next = k;
    if (!Number.isFinite(next)) {
      // Nothing left to die: the loop CWDT missed its trigger on the last deaths, either because it
      // was still on cooldown or because the damage it counted stayed below its threshold
      stopReason =
        lastDeath < loopCwdt.readyAt
          ? { kind: 'cooldown', counted: 0, cycle: loopCwdt.fires.length }
          : { kind: 'damage', counted: loopCwdt.counter, cycle: loopCwdt.fires.length };
      break;
    }
    if (next > maxTicks) break;
    tick = next;
    lastDeath = next;
    for (const { minion, count } of deaths.get(next)!) {
      for (let i = 0; i < count; i++) queue.push({ kind: 'hit', damage: minion.hitDamage, key: minion.key });
    }
    deaths.delete(next);
  }

  const sustained = !stopReason;
  // Steady state: whole loop cycles in the last quarter of the run, from the first to the last
  // trigger of the loop CWDT inside it, so the window does not cut a cycle in half
  const windowFires = loopCwdt.fires.filter((t) => t >= Math.floor(maxTicks * 0.75));
  const from = windowFires[0] ?? 0;
  const to = windowFires[windowFires.length - 1] ?? 0;
  const cycles = sustained ? Math.max(0, windowFires.length - 1) : 0;
  const inWindow = (ticks: number[]) => ticks.filter((t) => t >= from && t < to).length;
  const per = (n: number) => (cycles ? n / cycles : 0);
  const firesPerCycle: Record<string, number> = {};
  for (const c of state) firesPerCycle[c.key] = per(inWindow(c.fires));
  const hitsPerCycle: Record<string, number> = {};
  for (const [key, ticks] of hitTicks) hitsPerCycle[key] = per(inWindow(ticks));
  return {
    sustained,
    stopReason,
    periodTicks: cycles ? (to - from) / cycles : 0,
    firesPerCycle,
    hitsPerCycle,
    frHitsPerCycle: per(inWindow(frHitTicks)),
  };
}

// ---- pantheon ----

interface SelfDamagePower {
  god: string;
  line: string;
  /** physical: Heartbound Loop hits; chaos: Forbidden Rite */
  kind: 'physical' | 'chaos';
  /** Reduction in percent at full strength */
  max: number;
  /** PoB parsed it, so it is already in PoB's numbers */
  applied: boolean;
}

/**
 * Pantheon powers that reduce the loop's self-damage: additional physical damage reduction and
 * reduced physical hit damage taken (Heartbound Loop), and reduced chaos damage taken (Forbidden
 * Rite). Damage-over-time powers do not touch the loop's hits.
 */
function selfDamagePantheonPowers(facts: PobFacts): SelfDamagePower[] {
  const out: SelfDamagePower[] = [];
  for (const god of facts.pantheon ?? []) {
    for (const power of god.powers) {
      const line = power.line;
      if (/over Time/i.test(line)) continue;
      const upTo = /up to (?:a maximum of )?(\d+)%/i.exec(line);
      const pdr = /(\d+)% additional Physical Damage Reduction/i.exec(line);
      const physTaken = /^(\d+)% reduced Physical Damage taken/i.exec(line);
      const chaosTaken = /^(\d+)% reduced Chaos Damage taken/i.exec(line);
      const allTaken = /^(\d+)% reduced Damage taken/i.exec(line);
      // PoB parses conditional powers too, but their conditions (enemies nearby, hit recently,
      // stationary) are off in its default configuration, so only unconditional ones are in its numbers
      const conditional = /for each|while|per second|recently|\bif\b|\bwhen\b|up to/i.test(line);
      const base = { god: god.name, line, applied: power.applied && !conditional };
      if (pdr || physTaken) out.push({ ...base, kind: 'physical', max: Number(upTo?.[1] ?? (pdr ?? physTaken)![1]) });
      if (chaosTaken) out.push({ ...base, kind: 'chaos', max: Number(chaosTaken[1]) });
      if (allTaken) {
        out.push({ ...base, kind: 'physical', max: Number(allTaken[1]) });
        out.push({ ...base, kind: 'chaos', max: Number(allTaken[1]) });
      }
    }
  }
  return out;
}

// ---- helpers over the facts ----

interface SkillRef {
  group: PobGroup;
  skill: PobSkill;
}

const hasCwdt = (skill: PobSkill) => skill.supports.some((s) => s.name === 'Cast when Damage Taken');
/** Text of everything equipped plus tattoos and Runegrafts on the tree. */
const allLines = (facts: PobFacts) => [...facts.items.flatMap((i) => i.lines), ...(facts.treeOverrides ?? []).flatMap((o) => o.lines)];
const anyLine = (facts: PobFacts, re: RegExp) => allLines(facts).some((l) => re.test(l));
const groupName = (g: PobGroup) => g.label || g.slot || `Group ${g.index}`;

function gemRows(group: PobGroup): GemRow[] {
  const effective = new Map<string, { level: number; quality: number }>();
  for (const skill of group.skills) {
    if (!skill) continue;
    effective.set(skill.name, { level: skill.level, quality: skill.quality });
    for (const s of skill.supports) if (!effective.has(s.name)) effective.set(s.name, { level: s.level, quality: s.quality });
  }
  return group.gems
    .filter((g) => g.enabled)
    .map((g) => {
      const eff = effective.get(g.name);
      const row: GemRow = { group: groupName(group), slot: group.slot ?? '', name: g.name, level: eff?.level ?? g.level, quality: eff?.quality ?? g.quality };
      if (eff && (eff.level !== g.level || eff.quality !== g.quality)) {
        row.baseLevel = g.level;
        row.baseQuality = g.quality;
      }
      return row;
    });
}

export function analyzePob(facts: PobFacts): PobCheckResult {
  const issues: Finding[] = [];
  const sections: MarginSection[] = [];
  const add = (severity: Finding['severity'], text: string, link?: string) => issues.push({ severity, text, link });

  const refs: SkillRef[] = facts.groups
    .filter((g) => g.enabled && !/Swap/.test(g.slot ?? ''))
    .flatMap((g) => g.skills.filter((s): s is PobSkill => !!s).map((skill) => ({ group: g, skill })));

  // ---- the loop's minions ----
  // Any minion skill under a CWDT drives the loop when its minions die and set off Heartbound Loop:
  // Summon Skeletons (standard), Summon Raging Spirit (+ Raise Zombie of Falling, FAQ rzofsrs).
  const minionName = (skill: string) =>
    skill === 'Summon Skeletons' ? 'Skeletons' : skill === 'Summon Raging Spirit' ? 'Raging Spirits' : skill === 'Raise Zombie of Falling' ? 'Zombies of Falling' : skill;
  const heartboundHitOf = (c: PobSkillCalc) =>
    c.heartboundHitDamage ?? (c.selfHitDamage !== undefined && c.minionsPerCast ? c.selfHitDamage / c.minionsPerCast : 0);
  const minionSkills = refs.filter((r) => hasCwdt(r.skill) && r.skill.calc && (r.skill.calc.minionsPerCast ?? 0) > 0 && MINION_LOOP_SKILLS.has(r.skill.name));
  if (!minionSkills.length) {
    throw new PobCheckError('No Summon Skeletons or Summon Raging Spirit linked to Cast when Damage Taken found. This does not look like a CWDT looper build.');
  }
  const skeleton = minionSkills.find((r) => r.skill.name === 'Summon Skeletons');
  // Raise Zombie of Falling's zombie dies on impact; PoB has no timing for the fall, so it is left out
  const zombies = minionSkills.filter((r) => r.skill.name === 'Raise Zombie of Falling');
  const loopMinions = minionSkills.filter((r) => r.skill.name !== 'Raise Zombie of Falling' && r.skill.calc!.duration !== undefined && heartboundHitOf(r.skill.calc!) > 0);
  const primary = loopMinions[0] ?? skeleton ?? minionSkills[0]!;
  const variant = minionSkills.some((r) => r.skill.name !== 'Summon Skeletons') ? 'rzof-srs' : 'standard';
  const loopNames = [...new Set(loopMinions.map((r) => minionName(r.skill.name)))];
  const minionLabel = loopNames.join(' and ') || minionName(primary.skill.name);

  const fr = refs.find((r) => r.skill.name === 'Forbidden Rite' && hasCwdt(r.skill) && r.skill.calc?.frDamageTaken !== undefined);
  const loopGroups = new Set(loopMinions.map((r) => r.group.index));
  const frLinked = !!fr && loopGroups.has(fr.group.index);
  const body =
    refs.find((r) => r.group.slot === 'Body Armour' && hasCwdt(r.skill) && r.skill.calc?.cwdtThreshold) ??
    refs.find((r) => r.group.slot === 'Weapon 1' && hasCwdt(r.skill) && r.skill.calc?.cwdtThreshold);

  const allocated = new Set(facts.allocated);
  const stats = facts.stats;
  const ward = stats.ward ?? 0;
  // A Kalandra's Touch reflecting a Heartbound Loop counts as a second one (PoB copies its mods)
  const isHeartbound = (i: PobItem) => i.name.startsWith('Heartbound Loop') || !!i.reflects?.startsWith('Heartbound Loop');
  const heartbounds = facts.items.filter((i) => /^Ring \d/.test(i.slot) && isHeartbound(i)).length;
  const mindOverMatter = allocated.has('Mind Over Matter') || anyLine(facts, /^Mind Over Matter$/);
  const casts = allocated.has('Perfect Crime') ? 2 : 1; // Triggerbots trigger the summons a second time
  const frDamage = fr?.skill.calc?.frDamageTaken ?? 0;
  const frThreshold = fr?.skill.calc?.cwdtThreshold ?? 0;
  const bodyThreshold = body?.skill.calc?.cwdtThreshold ?? 0;
  const lifeRecoup = stats.lifeRecoup ?? 0;

  if (facts.flasksForced.length > 0) {
    add('info', `${facts.flasksForced.join(', ')} ${facts.flasksForced.length === 1 ? 'was' : 'were'} not ticked in PoB. Checked with all flasks active, as the loop keeps them up.`, LINKS.pobSetup);
  }
  if (variant === 'rzof-srs') {
    add('info', `Loop driven by ${minionSkills.map((r) => r.skill.name).join(' + ')}.`, LINKS.rzofsrs);
  }
  if (zombies.length) {
    add(
      'info',
      "Raise Zombie of Falling: the zombie dies on impact, and Path of Building has no timing for its fall, so the loop below is checked without it. It can only add triggers, so the real loop is at least this good.",
      LINKS.rzofsrs,
    );
  }
  for (const graft of (facts.treeOverrides ?? []).filter((o) => o.name.startsWith('Runegraft'))) {
    const effect = graft.lines.filter((l) => !/^Limited to/.test(l)).join('; ');
    add('info', `${graft.name}: ${effect}. Included in Path of Building's numbers.`);
  }
  for (const ring of facts.items.filter((i) => i.reflects)) {
    add('info', `Kalandra's Touch reflects your ${ring.reflects}; its modifiers are counted twice.`);
  }
  if (!body) add('warning', 'No Cast when Damage Taken gem found in the body armour or weapon.', LINKS.gemLinks);
  if (heartbounds === 0 || !loopMinions.length) {
    add('error', `No Heartbound Loop self-damage: PoB calculates no damage taken when your ${minionName(primary.skill.name)} die.`, LINKS.gemLinks);
  } else if (heartbounds === 1 && skeleton) {
    add('info', 'One Heartbound Loop: rare ring setup.', LINKS.rareRing);
    const n = skeleton.skill.calc!.minionsPerCast ?? 0;
    if (n < 4 && casts === 1 && loopMinions.length === 1) add('warning', `Summon Skeletons summons ${n} Skeletons. With one Heartbound Loop you need level 21 (4 Skeletons).`, LINKS.rareRing);
  }

  // The loop keeps itself running and the main skill triggers every cycle
  let loopHealthy = false;
  if (loopMinions.length) {
    // ---- simulate the loop ----
    const pc = primary.skill.calc!;
    const cdrMod = pc.cooldownRecoveryMod ?? 1;
    const cooldownTicksFromMod = (mod: number) => Math.ceil(CWDT_COOLDOWN / mod / TICK - 1e-9);
    // PoB's trigger rate cap is 1 / the CWDT cooldown of that particular skill, already rounded to ticks
    const cooldownTicksOf = (calc: { triggerRateCap?: number; cooldownRecoveryMod?: number } | undefined) =>
      calc?.triggerRateCap ? Math.round(1 / calc.triggerRateCap / TICK) : cooldownTicksFromMod(calc?.cooldownRecoveryMod ?? cdrMod);

    const minionOf = (r: SkillRef, scale = 1): LoopMinion => ({
      key: `${r.group.index}:${r.skill.name}`,
      durationTicks: ticksOf(r.skill.calc!.duration!),
      hitsPerSummon: (r.skill.calc!.minionsPerCast ?? 0) * casts,
      hitDamage: heartboundHitOf(r.skill.calc!) * scale,
    });

    type Row = { key: string; label: string; ref: SkillRef; cwdt: LoopCwdt; isLoop: boolean };
    const rows: Row[] = [];
    for (const groupIndex of loopGroups) {
      const groupMinions = loopMinions.filter((r) => r.group.index === groupIndex);
      const ref = groupMinions[0]!;
      rows.push({
        key: `loop${groupIndex}`,
        label: loopGroups.size > 1 ? `${ref.group.slot} CWDT (${groupMinions.map((r) => minionName(r.skill.name)).join(', ')})` : `${minionLabel} CWDT`,
        ref,
        isLoop: true,
        cwdt: {
          key: `loop${groupIndex}`,
          threshold: ref.skill.calc!.cwdtThreshold ?? 0,
          cooldownTicks: cooldownTicksOf(ref.skill.calc),
          summons: groupMinions.map((r) => minionOf(r)),
          castsFR: !!fr && fr.group.index === groupIndex,
        },
      });
    }
    const loopKey = rows[0]!.key;
    if (fr && !frLinked) {
      rows.push({ key: 'fr', label: 'Forbidden Rite CWDT', ref: fr, isLoop: false, cwdt: { key: 'fr', threshold: frThreshold, cooldownTicks: cooldownTicksOf(fr.skill.calc), summons: [], castsFR: true } });
    }
    const seen = new Set([...loopGroups, fr?.group.index]);
    if (body && !seen.has(body.group.index)) {
      seen.add(body.group.index);
      rows.push({ key: 'body', label: `${body.group.slot} CWDT`, ref: body, isLoop: false, cwdt: { key: 'body', threshold: bodyThreshold, cooldownTicks: cooldownTicksOf(body.skill.calc), summons: [], castsFR: false } });
    }
    for (const r of refs) {
      const c = r.skill.calc;
      // Skills with a long cooldown of their own (golems, sigils) are not part of the loop
      const ownCooldown = (c?.ownCooldown ?? 0) > 1 || (c?.triggerRateCap !== undefined && c.triggerRateCap < 1);
      if (seen.has(r.group.index) || !hasCwdt(r.skill) || !c?.cwdtThreshold || ownCooldown) continue;
      seen.add(r.group.index);
      // Only loop skills get a full PoB calculation; others are assumed to share the loop's cooldown recovery
      rows.push({ key: `g${r.group.index}`, label: `${r.group.slot} CWDT`, ref: r, isLoop: false, cwdt: { key: `g${r.group.index}`, threshold: c.cwdtThreshold, cooldownTicks: cooldownTicksOf(c), summons: [], castsFR: false } });
    }

    const params: LoopParams = { cwdts: rows.map((r) => r.cwdt), frDamage };
    const scaled = (phys: number, chaos: number): LoopParams => ({
      cwdts: params.cwdts.map((c) => ({ ...c, summons: c.summons.map((m) => ({ ...m, hitDamage: m.hitDamage * phys })) })),
      frDamage: frDamage * chaos,
    });
    // Does the loop keep itself running from a weapon swap (one chain)?
    const sim = simulateLoop(params);
    // If the loop only fails by a hair, PoB's numbers cannot decide it
    const lenientCwdts = params.cwdts.map((c) => ({ ...c, threshold: c.threshold - Math.max(2, c.threshold * 0.001) }));
    const lenient = simulateLoop({ ...params, cwdts: lenientCwdts });
    const borderline = (!sim.sustained && lenient.sustained) || (sim.firesPerCycle.body ?? 1) < (lenient.firesPerCycle.body ?? 1);
    const fresh = sim.sustained ? sim : lenient.sustained ? lenient : sim;
    // Minions that outlive the cooldown form a pipeline: in combat, more chains start (Raise Zombie of
    // Falling, enemy hits) and the loop speeds up to what the cooldown and minion durations allow
    const saturated = fresh.sustained ? simulateLoop({ ...params, cwdts: borderline ? lenientCwdts : params.cwdts, start: 'saturated' }) : fresh;
    const pipeline = fresh.sustained && saturated.sustained && saturated.periodTicks < fresh.periodTicks - 0.5;
    const run = pipeline ? saturated : fresh;
    const loopCdTicks = rows[0]!.cwdt.cooldownTicks;
    const period = run.periodTicks * TICK;
    const loopsPerSecond = period > 0 ? 1 / period : 0;
    const frPerCycle = fr ? (frLinked ? (run.firesPerCycle[`loop${fr.group.index}`] ?? 0) / (run.firesPerCycle[loopKey] || 1) : run.firesPerCycle.fr ?? 0) : 0;
    const allMinions = rows.flatMap((r) => r.cwdt.summons);
    const minionDamage = allMinions.reduce((a, m) => a + (run.hitsPerCycle[m.key] ?? 0) * m.hitDamage, 0);
    const minionHits = allMinions.reduce((a, m) => a + (run.hitsPerCycle[m.key] ?? 0), 0);
    const loopDamage = minionDamage + frPerCycle * frDamage;
    const bodyRate = run.firesPerCycle.body ?? 1;
    const everyNth = (rate: number) => (rate > 0 ? Math.round(1 / rate) : Infinity);
    const isEveryNth = (rate: number) => rate > 0 && Math.abs(1 / rate - Math.round(1 / rate)) < 0.05;
    const cadence = (rate: number) =>
      rate >= 0.999 ? 'every cycle' : rate <= 0 ? 'never' : isEveryNth(rate) ? `every ${everyNth(rate)} cycles` : `on ${fmt(rate * 100, 0)}% of cycles`;
    const fullSpeed = run.sustained && run.periodTicks <= loopCdTicks + 0.05;

    // ---- verdict ----
    let loopState: MarginState;
    let loopText: string;
    if (borderline) {
      loopState = 'warn';
      loopText = 'BORDERLINE';
      add('warning', 'Your self-damage is within rounding of a CWDT threshold. PoB cannot tell whether it triggers; check the loop in game or add a little life / lower chaos resistance.', LINKS.calculator);
    } else if (!sim.sustained) {
      loopState = 'bad';
      loopText = `LOOP STOPS after ${sim.stopReason?.cycle ?? 1} cycle${sim.stopReason?.cycle === 1 ? '' : 's'}`;
    } else if (bodyRate >= 0.999) {
      loopState = 'good';
      loopText = 'LOOP WORKS';
    } else if (pipeline || !isEveryNth(bodyRate)) {
      // The loop keeps itself running; the main skill just misses some of its triggers
      loopState = 'warn';
      loopText = 'LOOP WORKS';
    } else {
      loopState = everyNth(bodyRate) === 2 ? 'warn' : 'bad';
      loopText = everyNth(bodyRate) === 2 ? 'HALF SPEED' : `1/${everyNth(bodyRate)} SPEED`;
    }

    loopHealthy = sim.sustained && !borderline && bodyRate >= 0.999;

    // ---- pantheon powers that reduce self-damage ----
    // Most are conditional (enemies nearby, hit recently, stationary), so PoB leaves them out of its
    // numbers; in combat they are active. Rerun the loop with them at full strength.
    const pantheonPowers = selfDamagePantheonPowers(facts).filter((p) => p.kind === 'physical' || !!fr);
    if (pantheonPowers.length) {
      const extraPhys = Math.min(90, pantheonPowers.filter((p) => p.kind === 'physical' && !p.applied).reduce((a, p) => a + p.max, 0));
      const extraChaos = Math.min(90, pantheonPowers.filter((p) => p.kind === 'chaos' && !p.applied).reduce((a, p) => a + p.max, 0));
      const worst = simulateLoop(scaled(1 - extraPhys / 100, 1 - extraChaos / 100));
      const worstBody = worst.firesPerCycle.body ?? 1;
      const outcome = !worst.sustained
        ? 'the loop stops'
        : worstBody < 0.999
          ? `${body?.skill.name ?? 'your main skill'} only triggers every ${everyNth(worstBody)} cycles`
          : 'the loop still works';
      const reductions = [
        extraPhys > 0 ? `${extraPhys}% less damage from your ${minionLabel}` : null,
        extraChaos > 0 ? `${extraChaos}% less Forbidden Rite damage` : null,
      ].filter(Boolean);
      const described = pantheonPowers.map((p) => `${p.god}: "${p.line}"${p.applied ? ' (already in the numbers above)' : ''}`).join('; ');
      const affects = [
        pantheonPowers.some((p) => p.kind === 'physical') ? 'the physical damage your Heartbound Loops deal to you' : null,
        pantheonPowers.some((p) => p.kind === 'chaos') ? "Forbidden Rite's chaos damage to you" : null,
      ]
        .filter(Boolean)
        .join(' and ');
      const breaks = !worst.sustained || worstBody < 0.999;
      // How much physical damage reduction the loop tolerates before it stops or slows down
      let tolerance: number | null = null;
      if (breaks && extraPhys > 0 && sim.sustained) {
        for (let pdr = 1; pdr <= extraPhys; pdr++) {
          const r = simulateLoop(scaled(1 - pdr / 100, 1));
          if (!r.sustained || (r.firesPerCycle.body ?? 1) < 0.999) {
            tolerance = pdr - 1;
            break;
          }
        }
      }
      const worstText = reductions.length
        ? ` With them fully active in combat (${reductions.join(', ')}), ${outcome}${tolerance !== null ? `; it only tolerates ${tolerance}% physical damage reduction` : ''}.`
        : '';
      add(breaks && sim.sustained ? 'error' : 'warning', `Pantheon reduces ${affects}. ${described}.${worstText} Pick a pantheon without these powers.`, LINKS.pantheon);
    }

    // ---- why the loop stops ----
    const loopRow = rows[0]!;
    const loopThreshold = loopRow.cwdt.threshold;
    const minionHitPerTrigger = loopRow.cwdt.summons.reduce((a, m) => a + m.hitsPerSummon * m.hitDamage, 0);
    if (!sim.sustained && !borderline && sim.stopReason) {
      const frRow = rows.find((r) => r.key === 'fr');
      const shortest = loopRow.cwdt.summons.reduce((a, m) => Math.min(a, m.durationTicks), Infinity);
      if (sim.stopReason.kind === 'cooldown') {
        add(
          'error',
          `The loop stops: your ${minionLabel} die after ${seconds(shortest * TICK)} (${shortest} ticks), before the CWDT comes off its ${seconds(loopCdTicks * TICK)} cooldown (${loopCdTicks} ticks). Their damage is lost and nothing new is summoned. The minions must live at least as long as the cooldown: reach the next cooldown breakpoint or remove duration reduction.`,
          LINKS.cdr,
        );
      } else if (frLinked && minionHitPerTrigger < loopThreshold) {
        add(
          'error',
          `The loop stops: the CWDT linked to ${minionLabel} and Forbidden Rite needs ${fmt(loopThreshold, 1)} damage from the ${minionLabel} alone (it is on cooldown when Forbidden Rite hits), but they deal ${fmt(minionHitPerTrigger)}. Lower that CWDT's level.`,
          LINKS.gemLinks,
        );
      } else if (frRow && minionHitPerTrigger < frThreshold) {
        add(
          'error',
          `The loop stops: Forbidden Rite's CWDT needs ${fmt(frThreshold, 1)} damage from the ${minionLabel} alone (it is on cooldown when Forbidden Rite hits), but they deal ${fmt(minionHitPerTrigger)}, so Forbidden Rite never fires and the loop CWDT stays short. Lower that CWDT's level.`,
          LINKS.rareRing,
        );
      } else if (frRow && frRow.cwdt.cooldownTicks > loopCdTicks) {
        add(
          'error',
          `The loop stops: Forbidden Rite's CWDT has a ${seconds(frRow.cwdt.cooldownTicks * TICK)} cooldown, longer than the loop's ${seconds(loopCdTicks * TICK)}, so it misses cycles and the loop CWDT does not get enough damage without it.`,
          LINKS.cdr,
        );
      } else {
        add(
          'error',
          `The loop stops: the ${minionLabel} CWDT needs ${fmt(loopThreshold, 1)} damage per cycle but counts ${fmt(sim.stopReason.counted)}.${fr ? ' Increase life or lower chaos resistance (more Forbidden Rite damage), or lower the CWDT level.' : ' Lower the CWDT level, or add Forbidden Rite for more self-damage.'}`,
          LINKS.gemLinks,
        );
      }
    }
    if (sim.sustained && fr && frPerCycle < 0.999) {
      add('warning', `Forbidden Rite only fires ${cadence(frPerCycle)}: its CWDT is still on cooldown or short of minion damage when the ${minionLabel} die.`, LINKS.gemLinks);
    }
    if (sim.sustained && body && bodyRate < 0.999 && !borderline) {
      add(
        loopState === 'warn' ? 'warning' : 'error',
        `${body.skill.name} only triggers ${cadence(bodyRate)}${pipeline ? ` (${fmt(loopsPerSecond * bodyRate, 2)}/s)` : ''}: the ${body.group.slot} CWDT needs ${fmt(bodyThreshold, 1)} damage per cycle and gets ${fmt(loopDamage)} (${signed(loopDamage - bodyThreshold)})${pipeline ? ', and damage arriving while it is on cooldown is lost' : ''}. ${fr ? 'Increase life or lower chaos resistance, or lower the CWDT level.' : 'Lower the CWDT level, or add Forbidden Rite for more self-damage.'}`,
        LINKS.loopSpeed,
      );
    }

    // ---- loop margins ----
    const counted = (row: Row) => (row.isLoop ? (row.cwdt.castsFR ? minionDamage : loopDamage) : row.key === 'fr' ? minionDamage : loopDamage);
    const minionBreakdown = allMinions
      .map((m) => {
        const n = run.hitsPerCycle[m.key] ?? 0;
        return n > 0 ? `${fmt(n, n % 1 ? 1 : 0)} × ${fmt(m.hitDamage)} ${minionName(m.key.split(':')[1]!)}` : null;
      })
      .filter(Boolean)
      .join(' + ');
    const loop: Margin[] = [
      {
        label: 'Loop status',
        value: loopText,
        state: loopState,
        detail: borderline
          ? "a CWDT misses its threshold by less than the rounding of PoB's numbers; shown below as if it triggers"
          : !sim.sustained
            ? 'the loop CWDT missed a trigger, so nothing new is summoned'
            : pipeline
              ? 'keeps itself running from a weapon swap; numbers below are for the pipeline in combat'
              : 'simulated two minutes from a fresh start',
      },
      {
        label: `Damage per cycle from ${minionLabel}`,
        value: fmt(minionDamage),
        state: 'neutral',
        detail: `${minionBreakdown || `${fmt(minionHits)} deaths`} (Heartbound Loop, after mitigation)`,
      },
      {
        label: 'Forbidden Rite damage',
        value: fr ? fmt(frDamage) : 'none',
        state: fr && frPerCycle < 0.999 ? 'bad' : 'neutral',
        detail: fr ? cadence(frPerCycle) : undefined,
      },
    ];
    for (const row of rows) {
      const rate = (run.firesPerCycle[row.key] ?? 0) / (run.firesPerCycle[loopKey] || 1);
      const have = counted(row);
      const required = row.cwdt.threshold;
      const critical = row.isLoop || row.key === 'fr' || row.key === 'body';
      loop.push({
        label: row.label,
        value: `${fmt(have)} / ${fmt(required, 1)} required`,
        state: borderline && have < required ? 'warn' : rate >= 0.999 ? 'good' : critical ? 'bad' : 'warn',
        detail: `${signed(have - required, 1)}${pct(have - required, required)} · ${row.ref.skill.name} ${cadence(rate)} · ${row.cwdt.cooldownTicks}-tick cooldown${
          row.isLoop && row.cwdt.castsFR ? ` · ${minionLabel} damage only (linked with Forbidden Rite)` : row.key === 'fr' ? ` · ${minionLabel} damage only` : ''
        }`,
      });
    }
    sections.push({ title: 'Loop', margins: loop });

    // ---- loop timing ----
    const minModForTicks = (t: number) => CWDT_COOLDOWN / (t * TICK);
    // Cooldown recovery only comes in whole percents ("x% increased Cooldown Recovery Rate"), so the
    // breakpoints are hard integers: the smallest whole percent that reaches each tick count, i.e.
    // 9%, 27%, 52%, 90%, 153%
    const cdrPercent = Math.round((cdrMod - 1) * 10000) / 100;
    const breakpointPercent = (t: number) => Math.max(0, Math.ceil((minModForTicks(t) - 1) * 100 - 1e-9));
    const currentBreakpoint = breakpointPercent(loopCdTicks);
    const nextBreakpoint = loopCdTicks > 1 ? breakpointPercent(loopCdTicks - 1) : null;
    const cdrText = (n: number) => fmt(n, Number.isInteger(n) ? 0 : 1);
    const above = cdrPercent - currentBreakpoint;
    const timing: Margin[] = [
      {
        label: 'Loop cooldown recovery',
        // A surplus above the breakpoint is harmless: between two breakpoints the lower one applies
        value: `${cdrPercent >= 0 ? '+' : '−'}${cdrText(Math.abs(cdrPercent))}%${currentBreakpoint > 0 && above >= 0.005 ? ` (${cdrText(above)}% spare)` : ''}`,
        // Green when the loop actually runs at this cooldown, yellow when part of the CDR is wasted
        state: !run.sustained ? 'neutral' : fullSpeed ? 'good' : 'warn',
        detail: `${currentBreakpoint > 0 ? `${currentBreakpoint}% breakpoint` : 'base cooldown'} (${seconds(loopCdTicks * TICK)})${
          currentBreakpoint > 0
            ? above < 0.005
              ? ' · exactly at the breakpoint'
              : ` · ${cdrText(above)}% more than it needs: harmless, anything between two breakpoints counts as the lower one`
            : ''
        }${nextBreakpoint !== null ? ` · next: ${nextBreakpoint}% breakpoint (${seconds((loopCdTicks - 1) * TICK)}), ${cdrText(nextBreakpoint - cdrPercent)}% more` : ''}${
          run.sustained && !fullSpeed ? ' · the loop does not run this fast, see below' : ''
        }`,
      },
      {
        label: 'Loop CWDT cooldown',
        value: `${seconds(loopCdTicks * TICK)} (${loopCdTicks} ticks)`,
        state: 'neutral',
        detail: `0.25s base ÷ ${fmt(cdrMod, 2)}, rounded up to 33ms server ticks`,
      },
    ];
    const singleChain = loopMinions.length === 1;
    for (const r of loopMinions) {
      const c = r.skill.calc!;
      const t = ticksOf(c.duration!);
      timing.push({
        label: `${minionName(r.skill.name)} duration`,
        value: `${seconds(c.duration!)} (${t} ticks)`,
        state: !singleChain || pipeline ? 'neutral' : t === loopCdTicks ? 'good' : t > loopCdTicks ? 'warn' : 'bad',
        detail: `duration ×${fmt(c.durationMod ?? 1, 4)} of ${fmt(c.baseDuration ?? 0, 0)}s · ${
          t === loopCdTicks
            ? 'matches the cooldown'
            : t < loopCdTicks
              ? 'shorter than the cooldown, they die while CWDT is on cooldown'
              : singleChain && !pipeline
                ? 'longer than the cooldown, the loop waits for them'
                : 'outlives the cooldown; deaths from earlier triggers keep the loop going'
        }`,
      });
    }
    const freshPerSecond = fresh.periodTicks > 0 ? 1 / (fresh.periodTicks * TICK) : 0;
    timing.push({
      label: 'Loop speed',
      value: run.sustained ? (pipeline ? `${fmt(freshPerSecond, 2)} – ${fmt(loopsPerSecond, 2)} loops/s` : `${fmt(loopsPerSecond, 2)} loops/s`) : '–',
      state: !run.sustained ? 'bad' : borderline || !fullSpeed ? 'warn' : 'neutral',
      detail: run.sustained
        ? `${pipeline ? `one chain right after a weapon swap (every ${seconds(fresh.periodTicks * TICK)}) up to a full pipeline in combat: ` : ''}every ${seconds(period)}${fullSpeed ? ' (as fast as the cooldown allows)' : ` · the cooldown would allow every ${seconds(loopCdTicks * TICK)}`}${body ? ` · ${body.skill.name} ${fmt(loopsPerSecond * bodyRate, 2)}/s` : ''}${borderline ? ' · if the borderline CWDT triggers' : ''}`
        : undefined,
    });
    sections.push({ title: 'Loop timing', margins: timing });
    if (sim.sustained && !fullSpeed) {
      const only = singleChain ? loopMinions[0]! : null;
      const t = only ? ticksOf(only.skill.calc!.duration!) : 0;
      let hint: string;
      if (only && t > loopCdTicks && !pipeline) {
        const durMod = only.skill.calc!.durationMod ?? 1;
        const needed = (loopCdTicks * TICK) / (only.skill.calc!.baseDuration ?? 20);
        hint = `Get the ${minionName(only.skill.name)} duration multiplier from ×${fmt(durMod, 4)} to ×${fmt(needed, 4)} or lower (${fmt((1 - needed / durMod) * 100, 0)}% less) with To Dust, Window of Opportunity, the duration mastery or Less Duration / Swift Affliction.`;
      } else if (pipeline) {
        const multiples = loopMinions
          .map((r) => {
            const t = ticksOf(r.skill.calc!.duration!);
            if (t % loopCdTicks === 0) return null;
            const lower = Math.floor(t / loopCdTicks) * loopCdTicks;
            return `${minionName(r.skill.name)} ${t} ticks → ${lower} or ${lower + loopCdTicks} ticks (${seconds(lower * TICK)} / ${seconds((lower + loopCdTicks) * TICK)})`;
          })
          .filter(Boolean);
        hint = multiples.length
          ? `Minion deaths only line up with the cooldown when their duration is a whole multiple of it: ${multiples.join('; ')}.`
          : 'The minion durations already line up with the cooldown; more chains start from Raise Zombie of Falling and other damage.';
      } else {
        hint = zombies.length
          ? 'Raise Zombie of Falling may close the gap in game (not modelled), otherwise add another minion skill to the loop link (FAQ setup: Summon Skeletons + Summon Raging Spirit).'
          : 'Add another minion skill to the loop link so more deaths arrive per cycle (FAQ setup: Summon Skeletons + Summon Raging Spirit), or shorten the minion duration.';
      }
      add('warning', `The loop triggers every ${seconds(period)}${pipeline ? ' even with the pipeline full' : ''} although the CWDT cooldown allows every ${seconds(loopCdTicks * TICK)}: part of your cooldown recovery is wasted. ${hint}`, singleChain ? LINKS.toDust : LINKS.rzofsrs);
    }

    // ---- ward and life sustain, from the damage events of one steady cycle ----
    const maxHit = allMinions.reduce((a, m) => Math.max(a, m.hitDamage), 0);
    const lostByMinions = allMinions.reduce((a, m) => a + (run.hitsPerCycle[m.key] ?? 0) * Math.max(0, m.hitDamage - ward), 0);
    const healthLost = lostByMinions + Math.max(0, frDamage - ward) * run.frHitsPerCycle;
    const lostPerSecond = healthLost * loopsPerSecond;
    const safeRatio = Math.min(maxHit > 0 ? ward / maxHit : Infinity, fr && frDamage > 0 ? ward / frDamage : Infinity) - 1;
    const wardMargins: Margin[] = [
      { label: 'Ward (flasks active)', value: fmt(ward), state: 'neutral' },
      { label: `Ward vs ${minionName(primary.skill.name).replace(/s$/, '')} hit`, value: `${fmt(ward)} / ${fmt(maxHit)}`, state: ward >= maxHit ? 'good' : 'warn', detail: signed(ward - maxHit) },
    ];
    if (fr) wardMargins.push({ label: 'Ward vs Forbidden Rite', value: `${fmt(ward)} / ${fmt(frDamage)}`, state: ward >= frDamage ? 'good' : 'warn', detail: signed(ward - frDamage) });
    wardMargins.push(
      { label: 'Health lost per loop', value: healthLost > 0 ? fmt(healthLost) : 'NONE', state: healthLost > 500 ? 'bad' : healthLost > 0 ? 'warn' : 'good' },
      {
        label: 'Health lost per second',
        value: lostPerSecond > 0 ? fmt(lostPerSecond) : 'NONE',
        state: lostPerSecond > 0 ? (healthLost > 500 ? 'bad' : 'warn') : 'good',
        detail: lostPerSecond > 0 ? `${fmt(loopsPerSecond, 2)} loops/s · about ${fmt(lostPerSecond * (1 - Math.min(lifeRecoup, 100) / 100))}/s after ${lifeRecoup}% life recoup` : undefined,
      },
      {
        label: 'Safe % increased damage taken',
        value: safeRatio >= 0 && Number.isFinite(safeRatio) ? `${Math.floor(safeRatio * 100)}%` : 'none',
        state: safeRatio >= 0 ? 'neutral' : 'warn',
        detail: 'how much increased damage taken (shock, curses) before self-damage reaches your life',
      },
    );
    sections.push({ title: 'Ward', margins: wardMargins });
    if (healthLost > 0) {
      // Life recoup gives most of it back over the next seconds; a drain that recoup covers is not fatal
      const netPerSecond = lostPerSecond * (1 - Math.min(lifeRecoup, 100) / 100);
      const severe = healthLost > 500 && netPerSecond > (stats.life ?? 0) * 0.02;
      add(
        severe ? 'error' : 'warning',
        `You lose ${fmt(healthLost)} life per loop, ${fmt(lostPerSecond)} per second while looping (about ${fmt(netPerSecond)}/s after ${lifeRecoup}% life recoup), ${ward > 0 ? 'because self-damage exceeds your ward. Increase ward or chaos resistance, or reduce your life pool.' : 'because you have no ward. Keep enough life recoup and recovery to cover it.'}`,
        LINKS.calculator,
      );
      if (mindOverMatter) add('warning', 'Part of your self-damage is higher than your ward: with Mind Over Matter you will run out of mana. Remove it.', LINKS.mana);
    }
  }

  // ---- flasks ----
  const flaskMargins: Margin[] = [];
  const olroth = facts.flasks.find((f) => f.name.startsWith("Olroth's Resolve"));
  if (!olroth) {
    if (ward > 0) add('error', "Olroth's Resolve is not equipped.", LINKS.keepDying);
    else add('info', 'This build has no ward: its self-damage goes to life and is recovered by recoup, so the ward and Olroth\'s Resolve checks of the ward loop do not apply.');
  }
  for (const flask of facts.flasks) {
    if (!flask.utility) continue;
    flaskMargins.push(flaskMargin(flask, facts, flask === olroth, add));
  }
  if (flaskMargins.length) {
    const sources = [
      allocated.has('Pathfinder') ? 'Pathfinder' : null,
      anyLine(facts, /Utility Flasks gain \d+ Charges? every/) ? "Greater Shaper's Head" : null,
      allocated.has('The Traitor') ? `The Traitor (${facts.flaskSlotsEmpty} empty slot${facts.flaskSlotsEmpty === 1 ? '' : 's'})` : null,
    ].filter(Boolean);
    sections.push({ title: 'Flasks', margins: flaskMargins });
    if (sources.length) add('info', `Flask charge sources: ${sources.join(', ')}.`);
    if (facts.flaskChanceNotConsume > 0) add('info', `${facts.flaskChanceNotConsume}% chance to not consume flask charges is not counted in the flask checks (extra safety).`);
  }
  if (!allocated.has('The Traitor')) add('warning', 'The Traitor is not allocated (Brutal Restraint, Balbala). Your flasks lose their main charge source.', LINKS.flasks);
  if (!anyLine(facts, /Balbala/)) add('warning', 'Your Brutal Restraint is not Balbala. Are you sure about that?');
  if (olroth && !olroth.lines.some((l) => /Reused at the end of this Flask's effect/.test(l))) {
    add('warning', "Olroth's Resolve should have the 'Reused at the end of this Flask's effect' enchantment.", LINKS.keepDying);
  }

  // ---- defences that reduce self-damage ----
  // These lower the Heartbound Loop damage you take. PoB already includes them in the numbers above,
  // so they only matter when the loop is short; otherwise they are worth knowing, not fixing.
  const reducers: string[] = [];
  if ((stats.armour ?? 0) > 0) reducers.push(`${fmt(stats.armour ?? 0)} armour`);
  if ((stats.physicalDamageReduction ?? 0) > 0) reducers.push(`${fmt(stats.physicalDamageReduction ?? 0)}% physical damage reduction`);
  if (anyLine(facts, /Physical Damage (from Hits )?taken as (Cold|Fire|Lightning) Damage/)) reducers.push('physical damage taken as elemental damage (your resistances then apply)');
  if (reducers.length) {
    add(
      loopHealthy ? 'info' : (stats.armour ?? 0) > 0 ? 'error' : 'warning',
      loopHealthy
        ? `Your ${reducers.join(', ')} lower the Heartbound Loop damage you take. That is included in the numbers above and the loop still clears its thresholds.`
        : `Your ${reducers.join(', ')} lower the Heartbound Loop damage you take, and the loop is short on damage. The ward loop guide wants 0 armour and no physical damage reduction.`,
    );
  }
  if (olroth && anyLine(facts, /Flasks applied to you have \d+% increased Effect/)) {
    add('info', "Increased effect of flasks also strengthens Olroth's 'less Ward during Effect'. It is already included in the ward above.");
  }

  // ---- recoup ----
  const manaRecoup = stats.manaRecoup ?? 0;
  if (manaRecoup === 0) add('error', 'You have no mana recoup on tree or items.', LINKS.mana);
  else if (manaRecoup < 20) add('warning', `Mana recoup is ${manaRecoup}%. You want 20% or more.`, LINKS.mana);
  if (lifeRecoup === 0) add('warning', 'You have no life recoup on tree or items.');

  // ---- gems ----
  const skeletonGem = skeleton?.group.gems.find((g) => g.name === 'Summon Skeletons');
  const skeletonCwdtGem = skeleton?.group.gems.find((g) => g.name === 'Cast when Damage Taken');
  if (skeleton && skeletonGem && skeletonCwdtGem) {
    // The CWDT's effective level counts (+levels to support gems, e.g. Runegraft of Gemcraft, raise
    // what it supports); Summon Skeletons counts at the level of the gem itself (rare ring setups
    // run a level 20 gem +1 from the amulet under a level 20 CWDT).
    const cwdtLevel = skeleton.skill.supports.find((s) => s.name === 'Cast when Damage Taken')?.level ?? skeletonCwdtGem.level;
    const req = SKELETON_LEVEL_REQUIREMENT[skeletonGem.level - 1];
    const max = CWDT_MAX_SUPPORTED_REQUIREMENT[cwdtLevel - 1];
    if (req !== undefined && max !== undefined && req > max) {
      const cwdtText = cwdtLevel === skeletonCwdtGem.level ? `CWDT level ${cwdtLevel}` : `CWDT level ${cwdtLevel} (gem level ${skeletonCwdtGem.level} + ${cwdtLevel - skeletonCwdtGem.level} from items and tree)`;
      add('error', `Summon Skeletons level ${skeletonGem.level} (requires level ${req}) is too high for ${cwdtText}, which supports up to level ${max}.`, LINKS.gemLinks);
    }
  }
  if (facts.groups.some((g) => g.enabled && g.gems.some((gem) => gem.enabled && gem.name === 'Vaal Summon Skeletons'))) {
    add('error', 'Vaal Summon Skeletons bricks the build, use the normal gem.');
  }
  const swapWands = facts.items.filter((i) => /Swap/.test(i.slot) && i.lines.some((l) => /Spectral Spirits when Equipped/.test(l))).length;
  if (swapWands === 0) add('error', 'No swap weapons with Spectral Spirits (Essence of Insanity) to start the loop.', LINKS.startLoop);
  else if (swapWands === 1) add('warning', 'Only one swap wand with Spectral Spirits. Use two.', LINKS.startLoop);

  // ---- tree and items ----
  if (!anyLine(facts, /Blessed Rebirth/) && !allocated.has('Blessed Rebirth')) {
    add('warning', 'No Blessed Rebirth cluster notable. Your Skeletons must not die early.', LINKS.gemLinks);
  }
  if (anyLine(facts, /Allocates Assassin if you have the matching/)) add('error', 'Assassin Forbidden Flesh/Flame breaks the build.');
  if (allocated.has('Ancestral Bond') || anyLine(facts, /^Ancestral Bond$/)) add('warning', 'You have Ancestral Bond, do you want to play Totems?');
  if (facts.items.some((i) => i.name.startsWith('Replica Pure Talent'))) add('error', 'Replica Pure Talent breaks the build.');
  if (allocated.has("Alchemist's Genius") || anyLine(facts, /Alchemist's Genius/)) {
    add('warning', "A source of Alchemist's Genius interferes with Olroth's Resolve.", LINKS.keepDying);
  }
  const weapon = facts.items.find((i) => i.slot === 'Weapon 1');
  if (weapon && /Staff/.test(weapon.baseName) && !facts.masteryEffects.includes(28589)) {
    add('warning', 'You are missing the Staff Mastery "30% increased Defences while wielding a Staff".');
  }
  if (allocated.has('Elementalist') && !anyLine(facts, /Adds \d+ to \d+ Lightning Damage|Added Spell Lightning Damage/)) {
    add('warning', 'Elementalist: no added lightning damage to spells, so you do not shock or generate power charges. Get it on a helmet implicit, ring or abyss jewel.', '/faq/how_to_generate_power_charges');
  }
  if (!allocated.has('Pathfinder')) {
    add('info', 'Pathfinder is not allocated. That is fine as long as the flask checks above work: they use your actual charge sources.');
  }

  // ---- summary ----
  sections.unshift({
    title: 'Character',
    margins: [
      { label: 'Life', value: fmt(stats.life ?? 0), state: 'neutral' },
      { label: 'Energy Shield', value: fmt(stats.energyShield ?? 0), state: 'neutral' },
      { label: 'Mana', value: fmt(stats.mana ?? 0), state: 'neutral' },
      { label: 'Chaos Resistance', value: `${fmt(stats.chaosResist ?? 0)}%`, state: 'neutral' },
      { label: 'Armour', value: fmt(stats.armour ?? 0), state: (stats.armour ?? 0) > 0 ? 'bad' : 'good' },
      { label: 'Life / Mana recoup', value: `${lifeRecoup}% / ${manaRecoup}%`, state: manaRecoup >= 20 && lifeRecoup > 0 ? 'good' : 'warn' },
    ],
  });

  const gemGroups = [primary.group, fr?.group, body?.group, ...refs.filter((r) => hasCwdt(r.skill)).map((r) => r.group)].filter((g): g is PobGroup => !!g);
  const gems = [...new Map(gemGroups.map((g) => [g.index, g])).values()].flatMap(gemRows);

  const order = { error: 0, warning: 1, info: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const verdict =
    errors > 0
      ? { state: 'bad' as const, text: `${errors} problem${errors === 1 ? '' : 's'}${warnings ? ` and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}` }
      : warnings > 0
        ? { state: 'warn' as const, text: `${warnings} thing${warnings === 1 ? '' : 's'} to look at` }
        : { state: 'good' as const, text: 'Looks good. If the build still breaks, check Pantheon, gem links and map mods.' };

  return {
    meta: { pobVersion: facts.pobVersion, treeVersion: facts.treeVersion, className: facts.className, ascendClassName: facts.ascendClassName, variant },
    verdict,
    sections,
    issues,
    gems,
  };
}

function flaskMargin(flask: PobFlask, facts: PobFacts, critical: boolean, add: (s: Finding['severity'], t: string, l?: string) => void): Margin {
  const duration = flask.duration ?? 0;
  const used = flask.chargesUsed ?? 0;
  const max = flask.chargesMax ?? 0;
  const gain = flask.gainMod ?? 1;
  const per3s = (flask.chargesPerSecond ?? 0) * 3 * gain;
  const per5s = (flask.chargesPerSecondPerEmptySlot ?? 0) * 5 * facts.flaskSlotsEmpty * gain;
  const reuse = flask.lines.some((l) => /Reused at the end of this Flask's effect/.test(l));
  const whenFull = flask.lines.some((l) => /Used when Charges reach full/.test(l));
  const result = simulateFlask(per3s, per5s, max, used, Math.floor(duration * 30), whenFull && !reuse);
  const gainedPerSecond = per3s / 3 + per5s / 5;
  const usedPerSecond = duration > 0 ? used / duration : Infinity;
  const uptime = Number.isFinite(usedPerSecond) && usedPerSecond > 0 ? (gainedPerSecond / usedPerSecond) * 100 : 0;

  // Like the calculator, the simulation ignores chances to not consume charges (Pathfinder). When that
  // chance would cover the shortfall on average, the flask is on a knife's edge rather than broken.
  const chance = Math.min(facts.flaskChanceNotConsume, 99) / 100;
  const uptimeWithChance = uptime / (1 - chance);
  const savedByChance = result.kind === 'fails' && chance > 0 && uptimeWithChance >= 100;

  const state: MarginState = result.kind === 'works' ? 'good' : result.kind === '30min' || savedByChance ? 'warn' : 'bad';
  const value = result.kind === 'works' ? 'FLASK WORKS' : result.kind === '30min' ? 'Stable for at least 30 min' : `Fails after ${fmt(result.afterSeconds, 1)}s`;
  if (savedByChance) {
    add(
      'warning',
      `${flask.name} runs out of charges after ${fmt(result.afterSeconds, 1)}s without luck: uptime ${fmt(uptime, 0)}%, about ${fmt(uptimeWithChance, 0)}% with your ${fmt(chance * 100)}% chance to not consume charges. More flask charges or duration would make it reliable.`,
      LINKS.flasks,
    );
  } else if (result.kind === 'fails') {
    add(
      critical ? 'error' : 'warning',
      `${flask.name} runs out of charges after ${fmt(result.afterSeconds, 1)}s (uptime ${fmt(uptime, 0)}%). Gain more flask charges or duration, or use fewer charges.`,
      LINKS.flasks,
    );
  }
  return {
    label: flask.name,
    value,
    state,
    detail: `uptime ${fmt(uptime, 1)}% · gains ${fmt(gainedPerSecond, 2)}/s vs uses ${fmt(usedPerSecond, 2)}/s · ${fmt(duration, 2)}s, ${fmt(used, 1)} of ${fmt(max)} charges${reuse ? '' : whenFull ? ' · used when full' : ' · no auto-use enchant'}`,
  };
}
