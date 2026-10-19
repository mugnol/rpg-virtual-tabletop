import crypto from "node:crypto";

export class DiceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiceParseError";
  }
}

export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceRollResult {
  formula: string;
  dice: number[];
  modifier: number;
  total: number;
  label?: string;
}

const ALLOWED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);

const FORMULA_REGEX = /^(?:([1-9][0-9]*)?d([0-9]+))([+-][0-9]+)?$/i;

/**
 * Parses a standard RPG dice formula (e.g. "d20", "2d6", "1d20+5", "2d6-1").
 * Throws DiceParseError if the formula is invalid or contains non-standard dice.
 */
export function parseDiceFormula(raw: string): ParsedDice {
  const trimmed = raw.trim();
  const match = FORMULA_REGEX.exec(trimmed);
  if (!match) {
    throw new DiceParseError(`Invalid dice formula: "${raw}"`);
  }

  const countStr = match[1];
  const sidesStr = match[2];
  const modStr = match[3];

  const count = countStr !== undefined ? Number.parseInt(countStr, 10) : 1;
  const sides = Number.parseInt(sidesStr, 10);
  const modifier = modStr !== undefined ? Number.parseInt(modStr, 10) : 0;

  if (count < 1 || count > 100) {
    throw new DiceParseError(`Dice count must be between 1 and 100, received ${count}`);
  }

  if (!ALLOWED_SIDES.has(sides)) {
    throw new DiceParseError(
      `Invalid die sides d${sides}. Supported standard polyhedrals: d4, d6, d8, d10, d12, d20, d100`,
    );
  }

  if (modifier < -999 || modifier > 999) {
    throw new DiceParseError(`Dice modifier must be between -999 and +999, received ${modifier}`);
  }

  return { count, sides, modifier };
}

/**
 * Evaluates a dice formula using server-authoritative cryptographically secure randomness.
 */
export function rollDice(formula: string, label?: string): DiceRollResult {
  const { count, sides, modifier } = parseDiceFormula(formula);
  const dice: number[] = [];
  let sum = 0;

  for (let i = 0; i < count; i += 1) {
    const roll = crypto.randomInt(1, sides + 1);
    dice.push(roll);
    sum += roll;
  }

  const normalizedFormula = `${count === 1 && !formula.toLowerCase().startsWith("1d") ? "" : count}d${sides}${
    modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ""
  }`;

  return {
    formula: normalizedFormula,
    dice,
    modifier,
    total: sum + modifier,
    ...(label ? { label } : {}),
  };
}
