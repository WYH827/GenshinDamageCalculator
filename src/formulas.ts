import type { Effect, FormulaRule } from "./model";

type Value = number | boolean;
type Expr = { kind: "number" | "boolean"; run: (x: number) => Value };
const functions: Record<
  string,
  { min: number; max: number; fn: (...args: number[]) => number }
> = {
  min: { min: 1, max: 20, fn: Math.min },
  max: { min: 1, max: 20, fn: Math.max },
  abs: { min: 1, max: 1, fn: Math.abs },
  floor: { min: 1, max: 1, fn: Math.floor },
  ceil: { min: 1, max: 1, fn: Math.ceil },
  round: { min: 1, max: 1, fn: Math.round },
  sqrt: { min: 1, max: 1, fn: Math.sqrt },
};
function normalize(input: string) {
  const chars: Record<string, string> = {
    "＞": ">",
    "＜": "<",
    "≥": ">=",
    "≤": "<=",
    "＝": "=",
    "！": "!",
    "×": "*",
    "÷": "/",
    "（": "(",
    "）": ")",
    "，": ",",
    "－": "-",
    "＋": "+",
    且: "&&",
    或: "||",
  };
  return input.replace(/[＞＜≥≤＝！×÷（），－＋且或]/g, (c) => chars[c]);
}
function compile(input: string, kind: Expr["kind"]): Expr {
  if (!input.trim())
    throw new Error(kind === "number" ? "公式不能为空" : "条件不能为空");
  if (input.length > 500) throw new Error("表达式最多500个字符");
  const text = normalize(input),
    tokens: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    if (/\s/.test(text[offset])) {
      offset++;
      continue;
    }
    const token =
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|^(?:[A-Za-z_]+)|^(?:>=|<=|==|!=|&&|\|\||[+\-*/^(),<>!=])/.exec(
        text.slice(offset),
      )?.[0];
    if (!token) throw new Error(`不支持的字符：${text[offset]}`);
    tokens.push(token);
    offset += token.length;
    if (tokens.length > 250) throw new Error("表达式过于复杂");
  }
  let pos = 0,
    depth = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const requireToken = (s: string) => {
    if (take() !== s) throw new Error(`需要 ${s}`);
  };
  const number = (e: Expr) => {
    if (e.kind !== "number") throw new Error("算术项必须是数字");
    return e;
  };
  const boolean = (e: Expr) => {
    if (e.kind !== "boolean")
      throw new Error("条件需要比较表达式，例如 x > 2000");
    return e;
  };
  function binary(a: Expr, b: Expr, op: string): Expr {
    const logic = ["&&", "||"].includes(op),
      compare = [">", "<", ">=", "<=", "==", "!=", "="].includes(op);
    if (logic) {
      boolean(a);
      boolean(b);
    } else {
      number(a);
      number(b);
    }
    return {
      kind: logic || compare ? "boolean" : "number",
      run: (x) => {
        if (op === "&&") return Boolean(a.run(x)) && Boolean(b.run(x));
        if (op === "||") return Boolean(a.run(x)) || Boolean(b.run(x));
        const left = a.run(x) as number,
          right = b.run(x) as number;
        switch (op) {
          case "+":
            return finite(left + right);
          case "-":
            return finite(left - right);
          case "*":
            return finite(left * right);
          case "/":
            if (right === 0) throw new Error("除数不能为0");
            return finite(left / right);
          case "^":
            return finite(left ** right);
          case ">":
            return left > right;
          case "<":
            return left < right;
          case ">=":
            return left >= right;
          case "<=":
            return left <= right;
          case "==":
          case "=":
            return left === right;
          case "!=":
            return left !== right;
          default:
            throw new Error("未知运算");
        }
      },
    };
  }
  const precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    ">": 3,
    "<": 3,
    ">=": 3,
    "<=": 3,
    "==": 3,
    "=": 3,
    "!=": 3,
    "+": 4,
    "-": 4,
    "*": 5,
    "/": 5,
    "^": 7,
  };
  function expression(min = 0): Expr {
    if (++depth > 50) throw new Error("括号嵌套过深");
    const token = take();
    let left: Expr;
    if (token === "+" || token === "-") {
      const a = number(expression(6));
      left = {
        kind: "number",
        run: (x) => (token === "-" ? -(a.run(x) as number) : a.run(x)),
      };
    } else if (token === "!") {
      const a = boolean(expression(6));
      left = { kind: "boolean", run: (x) => !a.run(x) };
    } else if (token === "(") {
      left = expression();
      requireToken(")");
    } else if (token === "x") {
      left = { kind: "number", run: (x) => x };
    } else if (token && /^(?:\d|\.)/.test(token)) {
      const n = Number(token);
      if (!Number.isFinite(n)) throw new Error("数字超出范围");
      left = { kind: "number", run: () => n };
    } else if (token && Object.hasOwn(functions, token)) {
      requireToken("(");
      const args: Expr[] = [];
      if (peek() !== ")") {
        do {
          args.push(number(expression()));
          if (peek() !== ",") break;
          take();
        } while (true);
      }
      requireToken(")");
      const f = functions[token];
      if (args.length < f.min || args.length > f.max)
        throw new Error(`${token} 参数个数不正确`);
      left = {
        kind: "number",
        run: (x) => finite(f.fn(...args.map((a) => a.run(x) as number))),
      };
    } else throw new Error(`无效表达式：${token ?? "缺少数值"}`);
    while (peek() in precedence && precedence[peek()] >= min) {
      const op = take(),
        p = precedence[op];
      left = binary(left, expression(op === "^" ? p : p + 1), op);
    }
    depth--;
    return left;
  }
  const result = expression();
  if (pos !== tokens.length) throw new Error(`多余内容：${peek()}`);
  if (result.kind !== kind)
    throw new Error(
      kind === "number" ? "公式必须返回数值" : "条件必须是比较式",
    );
  return result;
}
function finite(n: number) {
  if (!Number.isFinite(n)) throw new Error("公式结果不是有限数值");
  return n;
}
export function evaluateFormula(formula: string, x: number) {
  return finite(compile(formula, "number").run(finite(x)) as number);
}
export function evaluateCondition(condition: string, x: number) {
  return (
    condition.trim() === "" ||
    Boolean(compile(condition, "boolean").run(finite(x)))
  );
}
export function formulaError(
  formula: string,
  condition = false,
): string | null {
  try {
    if (condition && !formula.trim()) return null;
    compile(formula, condition ? "boolean" : "number");
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
export function rulesError(rules: FormulaRule[]): string | null {
  if (!rules.length) return "请添加至少一条公式";
  for (let i = 0; i < rules.length; i++) {
    const error =
      formulaError(rules[i].condition, true) || formulaError(rules[i].formula);
    if (error) return `第${i + 1}条：${error}`;
    if (!rules[i].condition.trim() && i !== rules.length - 1)
      return "无条件公式必须放在最后";
  }
  return null;
}
export function evaluateRules(
  rules: FormulaRule[],
  x: number,
): { value: number; ruleId: string } {
  const error = rulesError(rules);
  if (error) throw new Error(error);
  const match = rules.find((r) => evaluateCondition(r.condition, x));
  if (!match) throw new Error(`x=${x} 未匹配任何条件，请添加兜底公式`);
  return { value: evaluateFormula(match.formula, x), ruleId: match.id };
}
export function effectFormulaError(e: Effect) {
  return e.valueMode !== "number" && e.advanced ? rulesError(e.formulas) : null;
}
export function evaluateEffectValue(e: Effect, x: number) {
  return e.valueMode === "number"
    ? e.value
    : e.advanced
      ? evaluateRules(e.formulas, x).value
      : finite(x * e.coefficient);
}

export function presetFormula(p: import("./model").FormulaPreset): string {
  if (
    ![p.threshold, p.step, p.change].every(Number.isFinite) ||
    p.step <= 0 ||
    (p.cap !== null && (!Number.isFinite(p.cap) || p.cap < 0))
  )
    throw new Error("预设每档数值须大于0，上限须为非负数");
  const steps = `max(x - (${p.threshold}), 0) / ${p.step}`;
  const amount = `${p.wholeSteps ? `floor(${steps})` : `(${steps})`} * ${Math.abs(p.change)}`;
  const capped = p.cap === null ? amount : `min(${amount}, ${p.cap})`;
  return p.change < 0 ? `-(${capped})` : capped;
}
