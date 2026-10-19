import { describe, expect, it } from "vitest";
import { EvalError, evaluate, parse } from "../../src/rules/expressions.js";

function evalExpr(source: string, context: Record<string, number> = {}): number {
  return evaluate(parse(source), context);
}

describe("expression parser & evaluator", () => {
  it("evaluates plain numbers", () => {
    expect(evalExpr("42")).toBe(42);
    expect(evalExpr("3.5")).toBe(3.5);
  });

  it("applies operator precedence (* and / before + and -)", () => {
    expect(evalExpr("2 + 3 * 4")).toBe(14);
    expect(evalExpr("20 - 6 / 2")).toBe(17);
    expect(evalExpr("2 * 3 + 4 * 5")).toBe(26);
  });

  it("evaluates parentheses", () => {
    expect(evalExpr("(2 + 3) * 4")).toBe(20);
    expect(evalExpr("((10))")).toBe(10);
    expect(evalExpr("(1 + 2) * (3 + 4)")).toBe(21);
  });

  it("is left-associative for same-precedence operators", () => {
    expect(evalExpr("10 - 4 - 3")).toBe(3);
    expect(evalExpr("20 / 4 / 5")).toBe(1);
  });

  it("supports floor, ceil and abs calls", () => {
    expect(evalExpr("floor(7 / 2)")).toBe(3);
    expect(evalExpr("ceil(7 / 2)")).toBe(4);
    expect(evalExpr("abs(3 - 10)")).toBe(7);
    expect(evalExpr("floor((17 - 10) / 2)")).toBe(3);
  });

  it("supports max and min with two or more arguments", () => {
    expect(evalExpr("max(1, 2)")).toBe(2);
    expect(evalExpr("max(1, 7, 3)")).toBe(7);
    expect(evalExpr("min(4, 2, 8)")).toBe(2);
    expect(evalExpr("max(3, min(8, 5))")).toBe(5);
  });

  it("substitutes whitelisted identifiers from the context map", () => {
    expect(evalExpr("con.mod + level", { "con.mod": 2, level: 3 })).toBe(5);
    expect(evalExpr("class.hitDie + con.mod", { "class.hitDie": 8, "con.mod": 2 })).toBe(10);
    expect(evalExpr("max(str.score, 10)", { "str.score": 8 })).toBe(10);
    expect(evalExpr("score * 2", { score: 9 })).toBe(18);
  });

  it("treats an identifier missing from the context as an error", () => {
    expect(() => evalExpr("dex.mod + 1", {})).toThrow(EvalError);
    expect(() => evalExpr("foo.bar")).toThrow(/unknown identifier: foo\.bar/);
  });

  it("rejects division by zero with an EvalError", () => {
    expect(() => evalExpr("1 / 0")).toThrow(EvalError);
    expect(() => evalExpr("1 / 0")).toThrow(/division by zero/);
  });

  it("rejects malformed strings", () => {
    expect(() => parse("")).toThrow(EvalError);
    expect(() => parse("2 +")).toThrow(EvalError);
    expect(() => parse("(1 + 2")).toThrow(EvalError);
    expect(() => parse("1 2")).toThrow(EvalError);
    expect(() => parse("2 ** 3")).toThrow(EvalError);
    expect(() => parse("foo(1)")).toThrow(EvalError);
  });

  it("rejects max/min with fewer than two arguments", () => {
    expect(() => parse("max(1)")).toThrow(EvalError);
    expect(() => parse("min(2)")).toThrow(EvalError);
  });

  it("rejects unknown function names", () => {
    expect(() => parse("sqrt(4)")).toThrow(EvalError);
  });

  it("does not use eval or Function", () => {
    // The grammar only admits the whitelisted tokens above; anything outside
    // the grammar must fail at parse time rather than execute.
    expect(() => parse("process.exit(1)")).toThrow(EvalError);
    expect(() => parse("__proto__")).toThrow(EvalError);
  });
});
