/**
 * Computed form fields (API_CONTRACT_V4 §1.2): a tiny, safe formula evaluator — no `eval`.
 *
 * Grammar: numbers, field keys, `+ - * / ( )`, unary minus.
 *   expr   := term (("+" | "-") term)*
 *   term   := unary (("*" | "/") unary)*
 *   unary  := "-" unary | "+" unary | atom
 *   atom   := NUMBER | KEY | "(" expr ")"
 * The result is rounded to 2 decimals; a missing operand or a division by zero gives `null`
 * (the same rules the server applies — the server value is the one that is stored).
 */

type Token =
  | { kind: "num"; value: number }
  | { kind: "key"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

export type FormulaNode =
  | { type: "num"; value: number }
  | { type: "key"; key: string }
  | { type: "neg"; arg: FormulaNode }
  | { type: "bin"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

export class FormulaError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^(\d+(\.\d*)?|\.\d+)/.exec(source.slice(index));
      if (!match) throw new FormulaError(`Noto‘g‘ri son: ${source.slice(index, index + 5)}`);
      tokens.push({ kind: "num", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(char)) {
      const match = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(source.slice(index));
      const key = match ? match[0] : char;
      tokens.push({ kind: "key", value: key });
      index += key.length;
      continue;
    }
    if ("+-*/()".includes(char)) {
      tokens.push({ kind: "op", value: char as "+" | "-" | "*" | "/" | "(" | ")" });
      index += 1;
      continue;
    }
    throw new FormulaError(`Ruxsat etilmagan belgi: ${char}`);
  }
  return tokens;
}

/** Parses a formula into a tree; throws FormulaError on a syntax error. */
export function parseFormula(source: string): FormulaNode {
  const tokens = tokenize(source);
  let position = 0;

  const peek = () => tokens[position];
  const isOp = (value: string) => {
    const token = peek();
    return token?.kind === "op" && token.value === value;
  };

  const parseExpr = (): FormulaNode => {
    let node = parseTerm();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[position++] as { value: "+" | "-" }).value;
      node = { type: "bin", op, left: node, right: parseTerm() };
    }
    return node;
  };

  const parseTerm = (): FormulaNode => {
    let node = parseUnary();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[position++] as { value: "*" | "/" }).value;
      node = { type: "bin", op, left: node, right: parseUnary() };
    }
    return node;
  };

  const parseUnary = (): FormulaNode => {
    if (isOp("-")) {
      position += 1;
      return { type: "neg", arg: parseUnary() };
    }
    if (isOp("+")) {
      position += 1;
      return parseUnary();
    }
    return parseAtom();
  };

  const parseAtom = (): FormulaNode => {
    const token = tokens[position];
    if (!token) throw new FormulaError("Formula to‘liq emas");
    position += 1;
    if (token.kind === "num") return { type: "num", value: token.value };
    if (token.kind === "key") return { type: "key", key: token.value };
    if (token.value === "(") {
      const inner = parseExpr();
      if (!isOp(")")) throw new FormulaError("Qavs yopilmagan");
      position += 1;
      return inner;
    }
    throw new FormulaError(`Kutilmagan belgi: ${token.value}`);
  };

  if (tokens.length === 0) throw new FormulaError("Formula bo‘sh");
  const tree = parseExpr();
  if (position < tokens.length) throw new FormulaError("Formula oxirida ortiqcha belgi bor");
  return tree;
}

/** Field keys a formula refers to (for dependency checks); `[]` when the formula does not parse. */
export function formulaKeys(source: string): string[] {
  let tree: FormulaNode;
  try {
    tree = parseFormula(source);
  } catch {
    return [];
  }
  const keys = new Set<string>();
  const walk = (node: FormulaNode) => {
    if (node.type === "key") keys.add(node.key);
    else if (node.type === "neg") walk(node.arg);
    else if (node.type === "bin") {
      walk(node.left);
      walk(node.right);
    }
  };
  walk(tree);
  return [...keys];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Evaluates a formula. `resolve(key)` returns the operand value (a finite number) or `null`
 * when it is missing. Any null operand, a division by zero or a syntax error gives `null`.
 */
export function evaluateFormula(source: string, resolve: (key: string) => number | null): number | null {
  let tree: FormulaNode;
  try {
    tree = parseFormula(source);
  } catch {
    return null;
  }
  const run = (node: FormulaNode): number | null => {
    switch (node.type) {
      case "num":
        return node.value;
      case "key": {
        const value = resolve(node.key);
        return value === null || !Number.isFinite(value) ? null : value;
      }
      case "neg": {
        const value = run(node.arg);
        return value === null ? null : -value;
      }
      case "bin": {
        const left = run(node.left);
        const right = run(node.right);
        if (left === null || right === null) return null;
        if (node.op === "+") return left + right;
        if (node.op === "-") return left - right;
        if (node.op === "*") return left * right;
        if (right === 0) return null;
        return left / right;
      }
    }
  };
  const result = run(tree);
  return result === null || !Number.isFinite(result) ? null : round2(result);
}

/** Number value of a raw form value (numbers and numeric strings); null otherwise. */
export function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Values of every computed field of a form, computed from the other values. Computed fields may
 * refer to other computed fields; a reference cycle yields `null`.
 */
export function computeAll(
  fields: readonly { key: string; type: string; formula?: string }[],
  values: Record<string, unknown>,
): Record<string, number | null> {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const result: Record<string, number | null> = {};
  const visiting = new Set<string>();

  const valueOf = (key: string): number | null => {
    const field = byKey.get(key);
    if (!field) return null;
    if (field.type !== "computed") return field.type === "number" ? numericValue(values[key]) : null;
    if (key in result) return result[key];
    if (visiting.has(key)) return null;
    visiting.add(key);
    const computed = field.formula ? evaluateFormula(field.formula, valueOf) : null;
    visiting.delete(key);
    result[key] = computed;
    return computed;
  };

  for (const field of fields) if (field.type === "computed") valueOf(field.key);
  return result;
}
