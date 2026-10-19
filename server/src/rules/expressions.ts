/**
 * Whitelisted expression language for system-configuration formulas (spec §3).
 *
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := NUMBER | IDENT | call | '(' expr ')'
 *   call   := ('floor' | 'ceil' | 'abs') '(' expr ')'
 *           | ('max' | 'min') '(' expr (',' expr)+ ')'
 *
 * Identifiers resolve from a caller-provided context map; anything else is an
 * EvalError. There is deliberately no eval/Function anywhere near this code.
 */

export class EvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalError";
  }
}

export type Expr =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr }
  | { kind: "call"; name: "floor" | "ceil" | "abs" | "max" | "min"; args: Expr[] };

type Token =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const UNARY_CALLS = new Set(["floor", "ceil", "abs"]);
const MULTI_CALLS = new Set(["max", "min"]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const match = /^[0-9]*\.?[0-9]+/.exec(source.slice(i));
      if (!match) throw new EvalError(`invalid number at position ${i}`);
      tokens.push({ kind: "num", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const match = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*/.exec(source.slice(i));
      if (!match) throw new EvalError(`invalid identifier at position ${i}`);
      tokens.push({ kind: "ident", name: match[0] });
      i += match[0].length;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", op: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma" });
      i += 1;
      continue;
    }
    throw new EvalError(`unexpected character '${ch}' at position ${i}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  parseExpression(): Expr {
    let node = this.parseTerm();
    while (true) {
      const token = this.peek();
      if (token?.kind === "op" && (token.op === "+" || token.op === "-")) {
        this.pos += 1;
        node = { kind: "bin", op: token.op, left: node, right: this.parseTerm() };
      } else {
        return node;
      }
    }
  }

  private parseTerm(): Expr {
    let node = this.parseFactor();
    while (true) {
      const token = this.peek();
      if (token?.kind === "op" && (token.op === "*" || token.op === "/")) {
        this.pos += 1;
        node = { kind: "bin", op: token.op, left: node, right: this.parseFactor() };
      } else {
        return node;
      }
    }
  }

  private parseFactor(): Expr {
    const token = this.tokens[this.pos];
    if (!token) throw new EvalError("unexpected end of expression");
    if (token.kind === "num") {
      this.pos += 1;
      return { kind: "num", value: token.value };
    }
    if (token.kind === "ident") {
      this.pos += 1;
      if (this.peek()?.kind === "lparen") {
        return this.parseCall(token.name);
      }
      return { kind: "ident", name: token.name };
    }
    if (token.kind === "lparen") {
      this.pos += 1;
      const node = this.parseExpression();
      this.expect("rparen", "expected ')'");
      return node;
    }
    throw new EvalError("expected a number, identifier, or '('");
  }

  private parseCall(name: string): Expr {
    if (!UNARY_CALLS.has(name) && !MULTI_CALLS.has(name)) {
      throw new EvalError(`unknown function: ${name}`);
    }
    this.pos += 1; // consume '('
    const args: Expr[] = [this.parseExpression()];
    if (UNARY_CALLS.has(name)) {
      this.expect("rparen", `expected ')' after argument to ${name}`);
    } else {
      while (this.peek()?.kind === "comma") {
        this.pos += 1;
        args.push(this.parseExpression());
      }
      this.expect("rparen", `expected ')' after arguments to ${name}`);
      if (args.length < 2) {
        throw new EvalError(`${name} requires at least 2 arguments`);
      }
    }
    return { kind: "call", name: name as "floor" | "ceil" | "abs" | "max" | "min", args };
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expect(kind: Token["kind"], message: string): void {
    const token = this.tokens[this.pos];
    if (!token || token.kind !== kind) throw new EvalError(message);
    this.pos += 1;
  }
}

/** Parses a formula string into an AST. Throws EvalError on malformed input. */
export function parse(source: string): Expr {
  if (typeof source !== "string" || source.length === 0) {
    throw new EvalError("expression is empty");
  }
  const tokens = tokenize(source);
  if (tokens.length === 0) throw new EvalError("expression is empty");
  const parser = new Parser(tokens);
  const node = parser.parseExpression();
  if (!parser.atEnd()) {
    throw new EvalError("unexpected token after end of expression");
  }
  return node;
}

/** Evaluates a parsed expression against a whitelisted identifier context. */
export function evaluate(node: Expr, context: Record<string, number>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ident": {
      const value = context[node.name];
      if (value === undefined) {
        throw new EvalError(`unknown identifier: ${node.name}`);
      }
      return value;
    }
    case "bin": {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          if (right === 0) throw new EvalError("division by zero");
          return left / right;
      }
      return left; // unreachable; satisfies the exhaustiveness checker
    }
    case "call": {
      const args = node.args.map((arg) => evaluate(arg, context));
      switch (node.name) {
        case "floor":
          return Math.floor(args[0]);
        case "ceil":
          return Math.ceil(args[0]);
        case "abs":
          return Math.abs(args[0]);
        case "max":
          return Math.max(...args);
        case "min":
          return Math.min(...args);
      }
      return args[0]; // unreachable
    }
  }
}

/** Collects every identifier referenced by a parsed expression. */
export function collectIdentifiers(node: Expr, into: string[] = []): string[] {
  switch (node.kind) {
    case "num":
      break;
    case "ident":
      into.push(node.name);
      break;
    case "bin":
      collectIdentifiers(node.left, into);
      collectIdentifiers(node.right, into);
      break;
    case "call":
      for (const arg of node.args) collectIdentifiers(arg, into);
      break;
  }
  return into;
}
