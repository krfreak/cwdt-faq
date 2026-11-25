// Types for the PoB checker: the facts Path of Building's Lua side extracts (pob-wasm/extract.lua)
// and the result the analysis (shared/utils/pobAnalysis.ts) produces for the page.

// ---- Raw facts extracted from Path of Building ----

/**
 * Loop skills (Summon Skeletons, Forbidden Rite, the body armour skill) get a full PoB calculation.
 * Other CWDT-linked skills only carry cwdtThreshold and ownCooldown.
 */
export interface PobSkillCalc {
  /** Base cooldown of the skill itself, e.g. golems and sigils; only for non-loop skills. */
  ownCooldown?: number;
  /** Minion skills: Heartbound Loop damage taken when one of its minions dies (all rings, after mitigation). */
  heartboundHitDamage?: number;
  duration?: number;
  baseDuration?: number;
  durationMod?: number;
  cooldownRecoveryMod?: number;
  minionsPerCast?: number;
  selfHitDamage?: number;
  frDamageTaken?: number;
  cwdtThreshold?: number;
  triggerRateCap?: number;
  skillTriggerRate?: number;
}

export interface PobSkill {
  name: string;
  level: number;
  quality: number;
  supports: { name: string; level: number; quality: number }[];
  calc?: PobSkillCalc;
}

export interface PobGroup {
  index: number;
  slot?: string;
  label?: string;
  enabled: boolean;
  gems: { name: string; level: number; quality: number; enabled: boolean; support: boolean }[];
  skills: (PobSkill | null)[];
}

export interface PobItem {
  slot: string;
  name: string;
  baseName: string;
  type: string;
  rarity: string;
  /** Mod lines as PoB resolves them. For Kalandra's Touch this includes the reflected ring's lines. */
  lines: string[];
  /** Kalandra's Touch only: name of the opposite ring it reflects. */
  reflects?: string;
}

export interface PobFlask extends PobItem {
  utility: boolean;
  duration?: number;
  chargesMax?: number;
  chargesUsed?: number;
  gainMod?: number;
  /** Flask charges generated per second before the charges-gained modifier (Pathfinder, Greater Shaper's Head, ...). */
  chargesPerSecond?: number;
  /** Charges per second per empty flask slot before the gain modifier (The Traitor). */
  chargesPerSecondPerEmptySlot?: number;
}

export interface PobFacts {
  pobVersion: string;
  treeVersion: string;
  className: string;
  ascendClassName: string;
  characterLevel: number;
  pantheonMajor?: string;
  pantheonMinor?: string;
  flasksForced: string[];
  allocated: string[];
  masteryEffects: number[];
  /** Chosen pantheon gods with all their powers; `applied` = PoB could parse it into its numbers. */
  pantheon?: { slot: 'major' | 'minor'; id: string; name: string; powers: { soul: string; line: string; applied: boolean }[] }[];
  /** Allocated tattoos and Runegrafts, which replace passive tree nodes. */
  treeOverrides: { node: number; name: string; lines: string[] }[];
  groups: PobGroup[];
  items: PobItem[];
  flasks: PobFlask[];
  flaskSlotsEmpty: number;
  flaskChanceNotConsume: number;
  stats: {
    life?: number;
    energyShield?: number;
    mana?: number;
    ward?: number;
    chaosResist?: number;
    armour?: number;
    evasion?: number;
    physicalDamageReduction?: number;
    lifeRecoup?: number;
    manaRecoup?: number;
  };
}

// ---- Result returned by POST /api/pobcheck ----

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  severity: Severity;
  text: string;
  /** Site-relative link with more help, e.g. /faq/cdr_breakpoints */
  link?: string;
}

/** 'good' | 'warn' | 'bad' colour the value like the calculator does (lime / yellow / red). */
export type MarginState = 'good' | 'warn' | 'bad' | 'neutral';

export interface Margin {
  label: string;
  value: string;
  state: MarginState;
  detail?: string;
}

export interface MarginSection {
  title: string;
  margins: Margin[];
}

export interface GemRow {
  group: string;
  slot: string;
  name: string;
  level: number;
  quality: number;
  /** Level and quality as entered in PoB, when they differ from the effective values. */
  baseLevel?: number;
  baseQuality?: number;
}

export interface PobCheckResult {
  meta: {
    pobVersion: string;
    treeVersion: string;
    className: string;
    ascendClassName: string;
    variant: 'standard' | 'rzof-srs';
  };
  verdict: { state: MarginState; text: string };
  sections: MarginSection[];
  issues: Finding[];
  gems: GemRow[];
}
