/**
 * System configuration document: JSON Schema (draft 2020-12, enforced via
 * ajv) plus cross-field and formula-whitelist checks that a schema alone
 * cannot express. Spec: docs/specs/technical/03-rules-engine-and-sheets.md §2–§3.
 */
import Ajv2020, { type Ajv2020 as Ajv2020Class, type ErrorObject } from "ajv/dist/2020.js";
import { collectIdentifiers, EvalError, parse } from "./expressions.js";

// ajv/dist/2020 is CJS whose module.exports IS the class; at runtime the
// default import is constructable, but under NodeNext TS types it as the
// module namespace — cast it back to the class constructor.
const AjvCtor = Ajv2020 as unknown as typeof Ajv2020Class;

export interface AbilityConfig {
  key: string;
  name: string;
  abbreviation: string;
}

export interface AbilityScoreRange {
  min: number;
  max: number;
}

export interface AbilityModifierConfig {
  formula: string;
  min?: number;
  max?: number;
}

export type CreationMethod = "manual" | "roll3d6InOrder" | "roll4d6DropLowest" | "standardArray";

export interface CreationConfig {
  methods: CreationMethod[];
  mulliganIfAllBelow?: number;
  standardArray?: number[];
}

export interface MultiplierAdvancement {
  mode: "multiplier";
  xpMultiplier: number;
  resetOnAdvance: boolean;
}

export interface ThresholdsAdvancement {
  mode: "thresholds";
  thresholds: number[];
}

export type Advancement = MultiplierAdvancement | ThresholdsAdvancement;

export interface LevelsConfig {
  max: number;
  advancement: Advancement;
  proficiencyBonus?: { formula: string };
}

export interface SpellcastingConfig {
  ability: string;
  knownByLevel: number[];
}

export interface ClassConfig {
  key: string;
  name: string;
  hitDie: number;
  spellcasting?: SpellcastingConfig;
}

export interface OptionConfig {
  key: string;
  name: string;
}

export interface ArmorConfig {
  key: string;
  name: string;
  base: number;
  dex: "full" | "none" | number;
  slots?: number;
}

export interface ShieldConfig {
  bonus: number;
}

export interface DerivedConfig {
  hitPointsAtFirstLevel?: string;
  hitPointsPerLevel?: string;
  initiative?: string;
  carrySlots?: string;
}

export interface CurrencyConfig {
  units: string[];
}

export interface ExtrasConfig {
  talents?: boolean;
  spells?: boolean;
  notes?: boolean;
}

export interface SystemConfig {
  key: string;
  name: string;
  version: string;
  attribution: string;
  abilities: AbilityConfig[];
  abilityScoreRange: AbilityScoreRange;
  abilityModifier: AbilityModifierConfig;
  creation: CreationConfig;
  levels: LevelsConfig;
  classes: ClassConfig[];
  ancestries: OptionConfig[];
  backgrounds: OptionConfig[];
  armor: ArmorConfig[];
  shield?: ShieldConfig;
  derived: DerivedConfig;
  currency: CurrencyConfig;
  extras: ExtrasConfig;
}

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; config: SystemConfig }
  | { ok: false; errors: ValidationError[] };

const SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{0,39}$";
const CREATION_METHODS = ["manual", "roll3d6InOrder", "roll4d6DropLowest", "standardArray"] as const;

const optionListSchema = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["key", "name"],
    properties: {
      key: { type: "string", pattern: SLUG_PATTERN },
      name: { type: "string", minLength: 1, maxLength: 80 },
    },
  },
} as const;

export const systemConfigJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "key",
    "name",
    "version",
    "attribution",
    "abilities",
    "abilityScoreRange",
    "abilityModifier",
    "creation",
    "levels",
    "classes",
    "ancestries",
    "backgrounds",
    "armor",
    "derived",
    "currency",
    "extras",
  ],
  properties: {
    key: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{1,39}$" },
    name: { type: "string", minLength: 2, maxLength: 80 },
    version: { type: "string", minLength: 1, maxLength: 20 },
    attribution: { type: "string", minLength: 10, maxLength: 500 },
    abilities: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name", "abbreviation"],
        properties: {
          key: { type: "string", pattern: SLUG_PATTERN },
          name: { type: "string", minLength: 1, maxLength: 60 },
          abbreviation: { type: "string", minLength: 1, maxLength: 10 },
        },
      },
    },
    abilityScoreRange: {
      type: "object",
      additionalProperties: false,
      required: ["min", "max"],
      properties: {
        min: { type: "integer" },
        max: { type: "integer" },
      },
    },
    abilityModifier: {
      type: "object",
      additionalProperties: false,
      required: ["formula"],
      properties: {
        formula: { type: "string", minLength: 1 },
        min: { type: "integer" },
        max: { type: "integer" },
      },
    },
    creation: {
      type: "object",
      additionalProperties: false,
      required: ["methods"],
      properties: {
        methods: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: { enum: CREATION_METHODS },
        },
        mulliganIfAllBelow: { type: "integer" },
        standardArray: {
          type: "array",
          minItems: 1,
          items: { type: "integer" },
        },
      },
      if: {
        properties: { methods: { type: "array", contains: { const: "standardArray" } } },
        required: ["methods"],
      },
      then: {
        properties: { methods: true, standardArray: true },
        required: ["methods", "standardArray"],
      },
    },
    levels: {
      type: "object",
      additionalProperties: false,
      required: ["max", "advancement"],
      properties: {
        max: { type: "integer", minimum: 1, maximum: 100 },
        advancement: {
          type: "object",
          additionalProperties: false,
          required: ["mode"],
          properties: {
            mode: { enum: ["multiplier", "thresholds"] },
            xpMultiplier: { type: "number", exclusiveMinimum: 0 },
            resetOnAdvance: { type: "boolean" },
            thresholds: {
              type: "array",
              minItems: 1,
              items: { type: "integer" },
            },
          },
          if: {
            properties: { mode: { const: "multiplier" } },
            required: ["mode"],
          },
          then: {
            properties: { mode: true, xpMultiplier: true, resetOnAdvance: true },
            required: ["mode", "xpMultiplier", "resetOnAdvance"],
          },
          else: {
            properties: { mode: true, thresholds: true },
            required: ["mode", "thresholds"],
          },
        },
        proficiencyBonus: {
          type: "object",
          additionalProperties: false,
          required: ["formula"],
          properties: { formula: { type: "string", minLength: 1 } },
        },
      },
    },
    classes: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name", "hitDie"],
        properties: {
          key: { type: "string", pattern: SLUG_PATTERN },
          name: { type: "string", minLength: 1, maxLength: 80 },
          hitDie: { type: "integer", minimum: 2, maximum: 20 },
          spellcasting: {
            type: "object",
            additionalProperties: false,
            required: ["ability", "knownByLevel"],
            properties: {
              ability: { type: "string", pattern: SLUG_PATTERN },
              knownByLevel: {
                type: "array",
                minItems: 1,
                items: { type: "integer" },
              },
            },
          },
        },
      },
    },
    ancestries: optionListSchema,
    backgrounds: optionListSchema,
    armor: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name", "base", "dex"],
        properties: {
          key: { type: "string", pattern: SLUG_PATTERN },
          name: { type: "string", minLength: 1, maxLength: 80 },
          base: { type: "integer" },
          dex: {
            anyOf: [{ enum: ["full", "none"] }, { type: "integer" }],
          },
          slots: { type: "integer", minimum: 0 },
        },
      },
    },
    shield: {
      type: "object",
      additionalProperties: false,
      required: ["bonus"],
      properties: { bonus: { type: "integer" } },
    },
    derived: {
      type: "object",
      additionalProperties: false,
      properties: {
        hitPointsAtFirstLevel: { type: "string" },
        hitPointsPerLevel: { type: "string" },
        initiative: { type: "string" },
        carrySlots: { type: "string" },
      },
    },
    currency: {
      type: "object",
      additionalProperties: false,
      required: ["units"],
      properties: {
        units: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string", minLength: 1, maxLength: 10 },
        },
      },
    },
    extras: {
      type: "object",
      additionalProperties: false,
      properties: {
        talents: { type: "boolean" },
        spells: { type: "boolean" },
        notes: { type: "boolean" },
      },
    },
  },
} as const;

const ajv = new AjvCtor({ allErrors: true, strict: true });
const validate = ajv.compile<SystemConfig>(systemConfigJsonSchema);

const BASE_IDENTIFIERS = new Set(["score", "level", "class.hitDie"]);

function toPath(instancePath: string): string {
  return instancePath.replace(/^\//, "").replace(/\//g, ".");
}

function ajvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  return (errors ?? []).map((error) => {
    // "required" errors point at the parent object; report the missing field.
    if (error.keyword === "required" && "missingProperty" in error.params) {
      const parent = toPath(error.instancePath);
      const missing = String(error.params.missingProperty);
      return { path: parent ? `${parent}.${missing}` : missing, message: error.message ?? "invalid value" };
    }
    return { path: toPath(error.instancePath) || "root", message: error.message ?? "invalid value" };
  });
}

/**
 * Cross-field rules a JSON Schema cannot express (ranges that must be
 * ordered, lengths tied to other sections, uniqueness, reference integrity,
 * and the formula whitelist of spec §3).
 */
function crossFieldErrors(config: SystemConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const abilityKeys = new Set(config.abilities.map((a) => a.key));

  const seen = new Set<string>();
  for (const ability of config.abilities) {
    if (seen.has(ability.key)) {
      errors.push({ path: "abilities", message: `duplicate ability key: ${ability.key}` });
    }
    seen.add(ability.key);
  }

  if (config.abilityScoreRange.min >= config.abilityScoreRange.max) {
    errors.push({
      path: "abilityScoreRange",
      message: "min must be less than max",
    });
  }

  const modifier = config.abilityModifier;
  if (modifier.min !== undefined && modifier.max !== undefined && modifier.min >= modifier.max) {
    errors.push({
      path: "abilityModifier",
      message: "min must be less than max when both are given",
    });
  }

  if (
    config.creation.standardArray !== undefined &&
    config.creation.standardArray.length !== config.abilities.length
  ) {
    errors.push({
      path: "creation.standardArray",
      message: `standardArray length (${config.creation.standardArray.length}) must equal abilities count (${config.abilities.length})`,
    });
  }

  const advancement = config.levels.advancement;
  if (advancement.mode === "thresholds") {
    const thresholds = advancement.thresholds;
    if (thresholds.length !== config.levels.max) {
      errors.push({
        path: "levels.advancement.thresholds",
        message: `thresholds length (${thresholds.length}) must equal levels.max (${config.levels.max})`,
      });
    }
    if (thresholds.length > 0 && thresholds[0] !== 0) {
      errors.push({
        path: "levels.advancement.thresholds",
        message: "thresholds must start with 0",
      });
    }
    for (let i = 1; i < thresholds.length; i += 1) {
      if (thresholds[i] < thresholds[i - 1]) {
        errors.push({
          path: "levels.advancement.thresholds",
          message: `thresholds must be non-decreasing (index ${i})`,
        });
        break;
      }
    }
  }

  config.classes.forEach((cls, index) => {
    if (cls.spellcasting) {
      if (!abilityKeys.has(cls.spellcasting.ability)) {
        errors.push({
          path: `classes.${index}.spellcasting.ability`,
          message: `unknown ability: ${cls.spellcasting.ability}`,
        });
      }
      if (cls.spellcasting.knownByLevel.length !== config.levels.max) {
        errors.push({
          path: `classes.${index}.spellcasting.knownByLevel`,
          message: `knownByLevel length (${cls.spellcasting.knownByLevel.length}) must equal levels.max (${config.levels.max})`,
        });
      }
    }
  });

  return errors;
}

function isWhitelistedIdentifier(name: string, abilityKeys: Set<string>): boolean {
  if (BASE_IDENTIFIERS.has(name)) return true;
  const match = /^([a-z0-9][a-z0-9-]*)\.(score|mod)$/.exec(name);
  return match !== null && abilityKeys.has(match[1]);
}

function formulaErrors(config: SystemConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  const abilityKeys = new Set(config.abilities.map((a) => a.key));

  const check = (formula: string | undefined, path: string) => {
    if (formula === undefined) return;
    let identifiers: string[];
    try {
      identifiers = collectIdentifiers(parse(formula));
    } catch (error) {
      errors.push({
        path,
        message: error instanceof EvalError ? `invalid formula: ${error.message}` : "invalid formula",
      });
      return;
    }
    for (const identifier of identifiers) {
      if (!isWhitelistedIdentifier(identifier, abilityKeys)) {
        errors.push({
          path,
          message: `unknown identifier in formula: ${identifier}`,
        });
      }
    }
  };

  check(config.abilityModifier.formula, "abilityModifier.formula");
  check(config.levels.proficiencyBonus?.formula, "levels.proficiencyBonus.formula");
  for (const key of Object.keys(config.derived) as Array<keyof DerivedConfig>) {
    check(config.derived[key], `derived.${key}`);
  }

  return errors;
}

/** Validates an arbitrary document against the system configuration contract. Never throws. */
export function validateSystemConfig(doc: unknown): ValidationResult {
  if (!validate(doc)) {
    return { ok: false, errors: ajvErrors(validate.errors) };
  }
  const config = doc as SystemConfig;
  const errors = [...crossFieldErrors(config), ...formulaErrors(config)];
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, config };
}
