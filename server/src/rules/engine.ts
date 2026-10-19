/**
 * Rules-engine computations over a validated SystemConfig (spec §3).
 * All functions are pure; unknown references raise EngineError.
 */
import { evaluate, parse } from "./expressions.js";
import type { SystemConfig } from "./schema.js";

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

/** Ability scores keyed by ability key, e.g. { str: 12, … }. */
export type AbilityScores = Record<string, number>;

function findAbility(config: SystemConfig, abilityKey: string) {
  const ability = config.abilities.find((a) => a.key === abilityKey);
  if (!ability) {
    throw new EngineError(`unknown ability: ${abilityKey}`);
  }
  return ability;
}

function findClass(config: SystemConfig, classKey: string) {
  const cls = config.classes.find((c) => c.key === classKey);
  if (!cls) {
    throw new EngineError(`unknown class: ${classKey}`);
  }
  return cls;
}

function runFormula(formula: string, context: Record<string, number>): number {
  return evaluate(parse(formula), context);
}

/**
 * Modifier for an ability score: the configured formula (evaluated with
 * `score`) plus the optional clamp. Unknown ability keys raise EngineError.
 */
export function abilityModifier(config: SystemConfig, abilityKey: string, score: number): number {
  findAbility(config, abilityKey);
  let value = runFormula(config.abilityModifier.formula, { score });
  if (config.abilityModifier.min !== undefined) {
    value = Math.max(value, config.abilityModifier.min);
  }
  if (config.abilityModifier.max !== undefined) {
    value = Math.min(value, config.abilityModifier.max);
  }
  return value;
}

/** Whitelisted identifier context shared by all derived-stat formulas. */
function formulaContext(config: SystemConfig, scores: AbilityScores): Record<string, number> {
  const context: Record<string, number> = {};
  for (const ability of config.abilities) {
    const score = scores[ability.key] ?? 0;
    context[`${ability.key}.score`] = score;
    context[`${ability.key}.mod`] = abilityModifier(config, ability.key, score);
  }
  return context;
}

/**
 * Proficiency bonus at a level, or null when the configuration declares no
 * proficiencyBonus formula.
 */
export function proficiencyBonus(config: SystemConfig, level: number): number | null {
  const formula = config.levels.proficiencyBonus?.formula;
  if (formula === undefined) return null;
  return runFormula(formula, { level });
}

/** HP at level 1 from derived.hitPointsAtFirstLevel; never below 1. */
export function hpAtFirstLevel(
  config: SystemConfig,
  classKey: string,
  abilities: AbilityScores,
): number {
  const formula = config.derived.hitPointsAtFirstLevel;
  if (formula === undefined) {
    throw new EngineError("derived.hitPointsAtFirstLevel is not configured");
  }
  const context = formulaContext(config, abilities);
  context["class.hitDie"] = findClass(config, classKey).hitDie;
  return Math.max(1, runFormula(formula, context));
}

/** HP gained per level beyond the first from derived.hitPointsPerLevel. */
export function hpPerLevel(
  config: SystemConfig,
  classKey: string,
  abilities: AbilityScores,
): number {
  const formula = config.derived.hitPointsPerLevel;
  if (formula === undefined) {
    throw new EngineError("derived.hitPointsPerLevel is not configured");
  }
  const context = formulaContext(config, abilities);
  context["class.hitDie"] = findClass(config, classKey).hitDie;
  return runFormula(formula, context);
}

/**
 * Armor class: unarmored is 10 + DEX modifier; armor is base + DEX handling
 * ("full" → full modifier, "none" → 0, integer → min(modifier, cap)). A
 * negative DEX modifier applies. A carried shield adds the configured bonus.
 */
export function armorClass(
  config: SystemConfig,
  armorKey: string | null,
  shield: boolean,
  abilities: AbilityScores,
): number {
  const dexMod = abilityModifier(config, "dex", abilities["dex"] ?? 0);
  let ac: number;
  if (armorKey === null) {
    ac = 10 + dexMod;
  } else {
    const armor = config.armor.find((a) => a.key === armorKey);
    if (!armor) {
      throw new EngineError(`unknown armor: ${armorKey}`);
    }
    const dexContribution =
      armor.dex === "full" ? dexMod : armor.dex === "none" ? 0 : Math.min(dexMod, armor.dex);
    ac = armor.base + dexContribution;
  }
  if (shield && config.shield) {
    ac += config.shield.bonus;
  }
  return ac;
}

/** Carry capacity from derived.carrySlots, or null when not configured. */
export function carrySlots(config: SystemConfig, abilities: AbilityScores): number | null {
  const formula = config.derived.carrySlots;
  if (formula === undefined) return null;
  return runFormula(formula, formulaContext(config, abilities));
}

/**
 * XP target for the next level: with "multiplier" advancement it is
 * level × xpMultiplier (the sheet layer handles resetOnAdvance bookkeeping);
 * with "thresholds" it is thresholds[level]. Null at max level.
 */
export function nextLevelXp(config: SystemConfig, level: number): number | null {
  const { max, advancement } = config.levels;
  if (level >= max) return null;
  if (advancement.mode === "multiplier") {
    return level * advancement.xpMultiplier;
  }
  return advancement.thresholds[level];
}
