# CWDT ward loop: mechanics reference

What the PoB checker (`/pobcheck`) is built on: how the build works, the numbers behind it, and
what Path of Building does and does not model. Each fact says where it comes from, so it can be
re-verified when the game or PoB changes. Last verified against Path of Building 2.69.0 (3.30 tree,
November 2026).

Sources used below:

- **PoB**: Path of Building Community source (`src/`), file named where relevant
- **Calc**: the site's calculator, returnx.github.io/cwdt (`calc.js`)
- **FAQ**: `content/faq/*.md` in this repo, including the CDR images `public/img/cdr1.png`, `cdr2.png`
- **Forum**: the build guide, pathofexile.com/forum/view-thread/3261066 ("[3.26] CWDT Ward Loop Scion")
- **Tested**: checked by running real builds through PoB (see `pnpm pob:check`)

## 1. How the loop works

1. A Cast when Damage Taken (CWDT) gem triggers **Summon Skeletons**, and **Forbidden Rite** (FR) if
   FR is linked to the same CWDT.
2. FR damages you when it is cast: `40% of life + 25% of energy shield` as chaos damage, reduced by
   chaos resistance (PoB `act_int.lua` ForbiddenRite, `soulfeast_take_%_maximum_*`).
3. The Skeletons die after their duration. Each death hits you once with **all Heartbound Loops
   combined** (PoB `CalcOffence.lua` "Heartbound Loop" self-hit handler; 350 base, 420 with a 20%
   catalyst).
4. Every CWDT counts the damage you take. At its threshold it triggers its skills, resets and goes on
   cooldown.
5. **A CWDT on cooldown does not count damage** (Calc: "The CwDT gem linked to Forbidden Rite does not
   take damage from Forbidden Rite (it is on cooldown when the damage happens)"). So the CWDT that
   triggers FR never counts FR's own damage. _Not modelled by PoB; the checker relies on Calc for it._
6. The Skeleton CWDT triggers again when the Skeletons die → new Skeletons → the loop repeats.
   **The loop only survives if the Skeleton CWDT triggers on every Skeleton death.** One miss and no
   new Skeletons are summoned until the next weapon swap (Spectral Spirits wands start the loop, FAQ
   start_the_loop).
7. Ward absorbs the self-damage. Olroth's Resolve: "Ward does not Break during Effect" and "85% less
   Ward during Effect". Any hit larger than your ward reaches life (Calc "Health lost per loop").

### Setups

| Setup                         | Links                                                                                                                                                                                                                                                             | Notes                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard, 2 Heartbound Loops  | Helm: Summon Skeletons 11 + FR 1 + CWDT 5 (FAQ gem_links, Forum)                                                                                                                                                                                                  | FR shares the Skeleton CWDT, which must trigger on Skeleton damage alone (3 × 840 = 2520 ≫ 725)                                                   |
| Rare ring, 1 Heartbound Loop  | Helm: Skeletons 20 (+1 → 21 for 4 Skeletons) + CWDT 20; Gloves/Boots: FR 1 + CWDT 12 (FAQ rare_ring)                                                                                                                                                              | FR CWDT triggers on Skeleton damage alone (4 × 420 = 1680 vs 1635 at CWDT 12/0, **tight**); the Skeleton and body CWDTs need Skeleton + FR damage |
| Kalandra's Touch              | Reflects the opposite ring (PoB `CalcSetup.lua`: copies all its mods)                                                                                                                                                                                             | Heartbound + Kalandra's Touch = two Heartbound Loops                                                                                              |
| Saboteur                      | Perfect Crime (Triggerbots) double the triggered casts (PoB `CalcTriggers.lua`)                                                                                                                                                                                   | FR not required. _Whether bots also recast FR is unverified_                                                                                      |
| Summon Raging Spirit (+ RZoF) | FAQ rzofsrs: Skeletons 11 + SRS 1 + CWDT 5 + Swift Affliction + Less Duration (60% total) + Raise Zombie of Falling, 27% CDR, 2 Heartbound, no FR, no To Dust / Window of Opportunity. Variant: SRS + RZoF only (e.g. Occultist with 99% life recoup and no ward) | Minions outlive the cooldown: a pipeline (section 2a)                                                                                             |

## 2. Timing: server ticks and breakpoints

- Server tick = **0.033 s**. Durations and cooldowns are rounded **up** to whole ticks
  (PoB `Data.lua` `ServerTickTime = 0.033`; `CalcOffence.lua` `calcSkillCooldown`, duration rounding).
- CWDT base cooldown **0.25 s** (PoB `sup_str.lua`), divided by cooldown recovery, rounded up.
- Summon Skeletons base duration **20 s**; duration multiplier = (1 + increased − reduced) × more/less,
  floored at 0 (PoB `calcSkillDuration`).
- The loop period is `max(cooldown ticks, duration ticks)`:
  - **duration < cooldown → loop stops**: Skeletons die while the CWDT is still on cooldown, their
    damage is lost (rule 5).
  - duration > cooldown → loop runs at the Skeletons' pace, CDR wasted.
  - Ideal: equal tick counts.

| Ticks | Seconds | Cooldown recovery breakpoint | Skeleton duration multiplier ≤ | Typical setup (FAQ cdr images)                                            |
| ----- | ------- | ---------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| 7     | 0.231   | **9%** (exact: 8.23)         | 0.01155                        | To Dust 74% + tree 25% (Window of Opportunity 15 + 2 × 5)                 |
| 6     | 0.198   | **27%** (26.26)              | 0.00990                        | + Duration Mastery "10% less", or To Dust 98% + Less Duration 4/20        |
| 5     | 0.165   | **52%** (51.52)              | 0.00825                        | 99% reduced + Swift Affliction 1 (25% less), or 98% + Less Duration 20/20 |
| 4     | 0.132   | **90%** (89.39)              | 0.00660                        | 99% + Less Duration 1/0 (40% less); Saboteur territory                    |
| 3     | 0.099   | **153%** (152.53)            | 0.00495                        | 99% + Less Duration ≥ 51%                                                 |

Notes:

- Cooldown recovery only exists in whole percents ("x% increased Cooldown Recovery Rate", x an integer),
  so the breakpoints are hard: the smallest whole percent reaching each tick count. 26% is 7 ticks,
  27% is 6; anything above the breakpoint until the next one gains nothing.
- Less Duration support: `40% + 1% per 2 levels above 1 + 1% per 2% quality` (PoB `sup_str.lua`
  levels: 1–2 → 40, 3–4 → 41, …, 20 → 49, 21 → 50). The FAQ image's "1% per level" is wrong.
- Swift Affliction: flat 25% less skill effect duration at every level.
- Saboteur "Like Clockwork" (node 51462) is **50%** increased CDR on the 3.29/3.30 trees, not 30%.
- Each CWDT has its own cooldown: skill-specific CDR can make one CWDT slower than the loop, which
  then fires every 2nd cycle. In the rare ring setup that stops the loop when it is the FR CWDT.

## 2a. Pipelines: minions that outlive the cooldown

Any minion that dies on its own sets off Heartbound Loop, not only Skeletons. Summon Raging Spirit
(5 s base duration) and Raise Zombie of Falling (the zombie "cannot survive the impact", PoB
`act_int.lua`) are used this way (FAQ rzofsrs; build pobb.in/ZhO85B1UpgMz).

- When minions live longer than the CWDT cooldown, each trigger's minions die later, while the loop
  keeps triggering: deaths from earlier triggers keep arriving. Each such sequence is a **chain**
  (trigger → minion dies → trigger → ...).
- A **single chain** (one minion type, one trigger at the weapon swap) only loops at the minion's
  duration: SRS-only with a 41-tick spirit loops every 1.35 s right after the swap.
- More chains start from extra triggers (Raise Zombie of Falling impacts, enemy hits, a second minion
  type such as Skeletons whose deaths land between the spirits'). Chains **collide**: a death that
  lands while the CWDT is on cooldown from another chain is lost and ends that chain.
- **A full pipeline runs at the cooldown breakpoint** (Tim, 2026-11-26): triggers only happen on server
  ticks, so an average between two tick counts (e.g. 6.06 ticks) is not real and falls back to the
  breakpoint; PoB shows the same (Ice Spear 5.05/s at 27% CDR). The checker treats a sustained
  pipeline with at least two chains (longest duration ≥ 2 × cooldown) as one trigger per cooldown.
  Do not warn about "wasted CDR" or duration multiples there. With only one chain (duration between
  1× and 2× the cooldown) the loop really runs at the duration's tick count.
- The checker reports such loops as a range: one chain (lower bound, the loop keeps itself running
  from a weapon swap) up to the full pipeline.
- Raise Zombie of Falling's fall time is not in PoB, so its deaths are left out of the timing; it can
  only add chains.
- PoB only computes the Heartbound self-hit for Summon Skeletons (`SelfHitDamage`); for other minions
  `pob-wasm/extract.lua` applies PoB's `applyDmgTakenConversion` to the rings' combined damage (same
  number as for Skeletons in the same build).
- **Main-skill CWDTs only need a cycle's damage to reach their threshold** (Tim, 2026-11-26: "if it
  works it works", extra damage per cycle is not a problem). The checker gives CWDTs the loop does not
  depend on (body armour, curses) a per-cycle budget: every cycle when the cycle's damage reaches the
  threshold, else every n-th cycle (n cycles of damage, or a cooldown longer than a cycle). Do not
  model the phase of hits inside a cycle for them (that produced a false "66% of cycles" on
  maxroll.gg/poe/pob/8s8fb90g).

## 3. Thresholds and gem levels

- CWDT threshold by level (PoB `sup_str.lua`): 1: 528, 5: 812, 11: 1485, 12: 1635, 18: 2874,
  19: 3142, 20: 3272, 21: 3580, 22: 3950, 23: 4350 (full table in the data file).
- Quality: −0.5% threshold per 1% quality, **truncated** (`math.modf`, PoB `CalcTools.lua`):
  20% → −10%, 23% → −11%, 30% → −15%, 33% → −16%.
- Summon Skeletons per cast: level 1–10: 2, 11–20: 3, 21–30: 4, 31+: 5.
- Empower: level 1/2/3/4/5 → +0/+1/+2/+3/+4 to the supported gem.
- **Max supported level** (CWDT "supports skills up to level requirement X": 38, 40, …, 64 at 14,
  then 65–70 for 15–20, 72/74/76 for 21/22/23). _Not modelled by PoB._ Evidence from real builds:
  - the CWDT counts at its **effective** level: a Runegraft of Gemcraft (+1 to non-Exceptional support
    gems) makes a level 19 CWDT support level-20 Skeletons;
  - Summon Skeletons counts at the level of **the gem itself**: rare ring setups run a level 20 gem
    (+1 from the amulet) under a level 20 CWDT.
- Skeleton level requirement: 10, 13, 17, 21, 25, 29, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 68, 70, 72.
- Gem level sources PoB applies: "+N to Level of Socketed (Duration/Support/…) Gems", "+N to Level of
  all X Skill Gems", Empower, Skin of the Loyal (+1 socketed) / Lords (+2 socketed), Faithguard
  "+2 to Level of Socketed Duration Gems", Runegrafts on the tree.

## 4. Ward, life and mana

- Calc rule: every self-damage hit (each Skeleton death, FR) is compared to ward on its own; the
  excess reaches life. "Health lost per loop" > 500 is red. Health lost per second = per loop × loops/s.
- "Safe % increased damage taken" = `min(ward / Skeleton hit, ward / FR) − 1`: how much shock/curses
  you can take before self-damage reaches life.
- If any self-damage exceeds ward, Mind Over Matter drains mana (Calc, FAQ mana_issues).
- Not every looper uses ward: a recoup variant (no ward, ~99% life recoup) takes the self-damage on
  life and recoups it; the checker then rates life lost by the net drain after recoup.
- Things that reduce self-damage (and can stop the loop): armour (must be 0), physical damage reduction,
  physical damage taken as elemental (resistances then apply), pantheon powers (section 6).
- Increased flask effect also scales Olroth's "less Ward"; PoB includes it in its ward number.
- Mana: 20%+ mana recoup wanted (FAQ, bot rule); Skeletons first in the helmet's first socket and skill
  gems in later sockets (CWDT trigger order, FAQ mana_issues).

## 5. Flasks

- Olroth's Resolve must stay up permanently, enchanted "Reused at the end of this Flask's effect"
  (FAQ keep_dying, Forum).
- Charge sources: The Traitor (Brutal Restraint, Balbala) **4 charges per empty flask slot every 5 s**
  (0.8/s per slot); Pathfinder "Flasks gain 3 Charges every 3 seconds" (1/s) plus 25% chance to not
  consume charges; Wickerman **Greater Shaper's Head** "Utility Flasks gain (1–2) Charge every 3 seconds"
  (3.30 tree only; replaces Pathfinder's 1/s only partly, about −11% to −23% total gain).
- Increased flask charges gained multiplies every source.
- Charges come from killing monsters (not modelled: extra in maps) and from timed mods ("Flasks gain
  x charges every n seconds": Pathfinder, The Traitor, Wickerman items, the body armour enchant). PoB's
  numbers hold the timed ones.
- The two auto-use mods (Instilling Orb; mutually exclusive with Enkindling, which the build never uses):
  - **"Reused at the end of this Flask's effect"** (Olroth): fires only when its effect runs out, so less
    often; short on charges at that moment, it is not reused.
  - **"Used when Charges reach full"**: fires as soon as the flask fills up, regardless of its effect.
- **Use Calc's flask simulation as is** (ported in the checker): 30 ticks/s, gains every 3 s / 5 s,
  the two modes above, and it **ignores** the chance to not consume charges (cannot be relied on).
  Tim rejected extra modelling (random charge rolls, timer phases, uptime percentages): "the
  calculator already handles that by approximation".
- PoB's flask tooltip ("Effective flask stats", `ItemsTab.lua`) shows "Flask uptime: X% average, Y%
  minimum". Minimum = charges of whole 3 s / 5 s intervals inside one duration ÷ charges used (no
  luck). Average = all charges over a duration ÷ (charges used × (1 − chance to not consume)), capped
  at 100%. Cross-checked on 16 example builds (2026-11-26): every flask PoB shows at 100% passes the
  calculator simulation; with a minimum below 100% the simulation usually fails (Olroth 58–85%), but
  some pass (Olroth 93–97%, one Dying Sun at 84%: the cap at full charges and the 15 s cycle make it
  less strict than PoB's minimum). The checker shows PoB's line in each flask's detail; the verdict stays the calculator's.
- PoB only applies flask effects (ward, chaos resistance from Amethyst/Progenesis) when the flask is
  **ticked** in PoB. The checker ticks all equipped flasks, as the FAQ's PoB setup asks.

## 6. Pantheon

Problematic powers (PoB `Data/Pantheons.lua`):

| God              | Power                                                                    | Affects                         |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------- |
| Lunaris (major)  | 1% additional Physical Damage Reduction per enemy within 6 m, up to 8%   | Heartbound hits                 |
| Solaris (major)  | 6% additional Physical Damage Reduction while only one enemy within 6 m  | Heartbound hits                 |
| Gruthkul (minor) | 1% additional Physical Damage Reduction per hit taken recently, up to 5% | Heartbound hits                 |
| Tukohama (minor) | 3% additional Physical Damage Reduction per second stationary, up to 9%  | Heartbound hits                 |
| Shakari (minor)  | 5% reduced Chaos Damage taken                                            | Forbidden Rite (FR setups only) |

Harmless for the loop: Brine King, Arakaali (damage over time only), Abberath, Garukhan, Yugul,
Ralakesh (physical damage over time), Ryslatha.

PoB parses the conditional ones but their conditions are off in its default configuration, so its
numbers exclude them; Shakari's flat 5% is included. The checker reruns the loop with them at full
strength. Example: a rare ring build with +45 damage over its FR CWDT tolerates only 2% physical
damage reduction.

## 7. Path of Building as the source of truth

- Exported `PlayerStat`s (in the build XML) are display stats of the **main skill only**: Duration and
  Cooldown there belong to Ice Spear. FR self-damage, Heartbound self-hit and CWDT thresholds are not
  exported; they come from making each skill PoB's main skill and recalculating (`pob-wasm/extract.lua`).
- PoB output names used: `SelfHitDamage` (all Skeletons of one cast), `SummonedMinionsPerCast`,
  `FRDamageTaken`, `CWDTThreshold`, `TriggerRateCap` (= 1 / that skill's tick-rounded CWDT cooldown),
  `Duration`, `LifeRecoup`, `ManaRecoup`, `PhysicalDamageReduction`, `Ward`, `ChaosResist`.
- `ChaosResist` already includes active (ticked) Amethyst/Progenesis flasks; do not add +35 again.
- Item text in exports keeps lines of every unique variant (`{variant:N}`) and unresolved ranges
  (`{range:0.5}(10-20)%`); use PoB's resolved lines (`CheckModLineVariant`, `itemLib.applyRange`).
- Wickerman slots (Head/Body/Arm/Leg) only count on a 3.30 tree (PoB `CalcSetup.lua`).
- Tattoos and Runegrafts live in the tree's `hashOverrides`, not on items.
- Node ids (3.29/3.30 trees): Window of Opportunity 4207 (15%), reduced duration 52099 / 14090 (5%),
  Pathfinder 9327, Elementalist 8281, Mind Over Matter 34098, Perfect Crime 28535, Like Clockwork 51462,
  Saboteur (Ascendant) 58827. Mastery **effect** ids: Duration "10% less" 21730, Staff defences 28589,
  Mana recoup 59064. Effect ids and node ids overlap (2474 is a Life Recoup node _and_ a Spell
  Suppression mastery effect); keep them apart.
- A timeless jewel's lookup table follows from its conqueror name in the jewel text (PoB `ModParser.lua`
  `conquerorList` → `PassiveSpec.lua` `timelessJewelTypeByConqueror`). If the table is missing when a
  build loads, PoB errors and its UI state stays broken for later builds; fetch tables first.

## 8. Running PoB in the browser (pob-wasm)

PoB's LuaJIT code on Lua 5.2 (WebAssembly) needs (`pob-wasm/boot.lua`, `engine/`):

- `goto` → Lua 5.2 (not 5.1); `LUA_COMPAT_ALL` for `unpack`/`loadstring`/`math.pow`
- `bit` library with signed 32-bit results (on `bit32`), a `jit` stub, `arg = {}`
- `string.format("%d", inf)` must not throw (C patch) and `%d` must be 64-bit (`LUA_USELONGLONG`)
- `io.open` modes like `"wb+"` normalised to `"w+b"`
- `local _ENV = nil` in PoB's dkjson neutralised (on LuaJIT it is an unused local)
- PoB's LuaJIT fork syntax (`..=`, `?.`) only in `CompareBuySimilar.lua`; rewritten only when a file
  fails to parse
- a real synchronous zlib `Inflate` (headless PoB stubs it to return "", which silently disables
  timeless jewels)
- Files starting with `#@` need their first line skipped by a custom loader.

Measured (Ryzen 9 5900X, Chromium): ~5 MB core download, PoB start ~3.4 s, check 1.3–2.5 s, ~570 MB
memory; about 4× slower with a 4× CPU throttle. Results identical to LuaJIT PoB.

Build links: most build sites (pobb.in, poe.ninja, pastebin, maxroll, poedb) send no CORS headers, so
`server/api/pob-link.get.ts` downloads them from fixed templates (`shared/utils/pobLinks.ts`, mirrors
PoB `BuildSiteTools.lua`). Nitro serves `*.gz` files with `Content-Encoding: gzip`, hence `.pobpack`.

## 9. Open questions

- Damage taken while a CWDT is on cooldown is lost (rule 5): from the calculator, not verified in game
  or PoB. The "duration shorter than cooldown stops the loop" and FR-cadence checks depend on it.
- Triggerbots: do the bots also recast Forbidden Rite?
- Does ward-absorbed damage count for life/mana recoup?
- Sources disagree on the maximum body CWDT level (FAQ: "higher than 21 fails", Forum: "21 fails");
  real builds run 21/20 when damage suffices, so the threshold is what matters.
