import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  evaluateRules,
  formulaError,
  rulesError,
  presetFormula,
} from "./formulas";
import { uid, fmt, type FormulaRule, type FormulaPreset } from "./model";

export default function FormulaEditor({
  value,
  onChange,
  preset,
  onPresetChange,
  effectLabel,
}: {
  value: FormulaRule[];
  onChange: (v: FormulaRule[], preset?: FormulaPreset) => void;
  preset?: FormulaPreset;
  onPresetChange: (v: FormulaPreset) => void;
  effectLabel: string;
}) {
  const [sample, setSample] = useState("2000");
  const error = rulesError(value);
  const settings = preset ?? {
    threshold: 0,
    step: 100,
    change: 8,
    cap: 160,
    wholeSteps: false,
  };
  const [presetOpen, setPresetOpen] = useState(false);
  const patchPreset = (patch: Partial<FormulaPreset>) =>
    onPresetChange({ ...settings, ...patch });
  let preview = "";
  try {
    const x = Number(sample);
    if (!sample.trim() || !Number.isFinite(x)) throw new Error("请输入试算 x");
    const r = evaluateRules(value, x);
    preview = `第 ${value.findIndex((v) => v.id === r.ruleId) + 1} 条匹配，结果 = ${fmt(r.value)}`;
  } catch (e) {
    preview = (e as Error).message;
  }
  const patch = (id: string, p: Partial<FormulaRule>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...p } : v)));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="formula-editor">
      <div className="formula-preset">
        <button className="text-btn" onClick={() => setPresetOpen(!presetOpen)}>
          {presetOpen ? "收起公式预设" : "使用公式预设"}
        </button>
        {presetOpen && (
          <>
            <p className="input-note">
              按变量超过阈值的部分，每一定数值转换为{effectLabel}
              ；生成后仍可编辑条件公式。
            </p>
            <div className="form-grid two">
              {(
                [
                  ["threshold", "变量超过", undefined],
                  ["step", "每多少变量数值", 0.000001],
                  ["change", `每档${effectLabel}变化`, undefined],
                ] as const
              ).map(([key, label, min]) => (
                <label className="field" key={key}>
                  <span className="field-label">{label}</span>
                  <input
                    type="number"
                    step="any"
                    min={min}
                    value={settings[key]}
                    onChange={(e) => {
                      const n = e.target.valueAsNumber;
                      if (Number.isFinite(n) && (min === undefined || n >= min))
                        patchPreset({ [key]: n });
                    }}
                  />
                </label>
              ))}
              <label className="field">
                <span className="field-label">最多变化数值（绝对值）</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  disabled={settings.cap === null}
                  value={settings.cap ?? 0}
                  onChange={(e) => {
                    if (
                      Number.isFinite(e.target.valueAsNumber) &&
                      e.target.valueAsNumber >= 0
                    )
                      patchPreset({ cap: e.target.valueAsNumber });
                  }}
                />
              </label>
            </div>
            <div className="target-selection">
              <label>
                <input
                  type="checkbox"
                  checked={settings.cap === null}
                  onChange={(e) =>
                    patchPreset({ cap: e.target.checked ? null : 160 })
                  }
                />
                不限制变化上限
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.wholeSteps}
                  onChange={(e) =>
                    patchPreset({ wholeSteps: e.target.checked })
                  }
                />
                每满一档才生效
              </label>
            </div>
            <p className="formula-note">{presetFormula(settings)}</p>
            <button
              className="btn small-btn"
              onClick={() =>
                onChange(
                  [
                    {
                      id: uid(),
                      condition: "",
                      formula: presetFormula(settings),
                    },
                  ],
                  settings,
                )
              }
            >
              生成并替换公式
            </button>
          </>
        )}
      </div>
      <div className="subheading">
        <h4>条件公式</h4>
        <button
          className="text-btn"
          disabled={value.length >= 50}
          onClick={() =>
            onChange([...value, { id: uid(), condition: "", formula: "x" }])
          }
        >
          <Plus size={14} />
          添加公式
        </button>
      </div>
      <p className="input-note">
        从上到下采用第一条满足条件的公式；留空条件表示兜底，放在最后。x
        为所选角色数值，公式结果直接作为效果数值，不再乘系数。
      </p>
      {value.map((row, i) => (
        <div className="formula-row" key={row.id}>
          <div className="formula-rule-heading">
            <span>规则 {i + 1}</span>
            <div className="button-group">
              <button
                className="icon-btn"
                disabled={i === 0}
                aria-label="公式上移"
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-btn"
                disabled={i === value.length - 1}
                aria-label="公式下移"
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="icon-btn danger"
                aria-label="删除公式"
                onClick={() => onChange(value.filter((v) => v.id !== row.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <label className="field">
            <span className="field-label">条件（可留空）</span>
            <input
              aria-label={`条件 ${i + 1}`}
              value={row.condition}
              maxLength={500}
              placeholder="例如：x > 2000"
              onChange={(e) => patch(row.id, { condition: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">公式</span>
            <input
              aria-label={`公式 ${i + 1}`}
              value={row.formula}
              maxLength={500}
              placeholder="例如：(x - 2000) * 0.04"
              onChange={(e) => patch(row.id, { formula: e.target.value })}
            />
          </label>
          {(formulaError(row.condition, true) || formulaError(row.formula)) && (
            <span className="validation">
              {formulaError(row.condition, true) || formulaError(row.formula)}
            </span>
          )}
        </div>
      ))}
      {error && (
        <p className="validation" role="status">
          {error}
        </p>
      )}
      <p className="input-note">
        支持 + − * / ^、括号、min/max/abs/floor/ceil/round/sqrt；条件支持
        &gt;、&gt;=、&lt;、&lt;=、==、!=、&amp;&amp;、||。例如 x ≥ 2000 或 x
        &gt; 1000 &amp;&amp; x &lt;= 2000。
      </p>
      <div className="formula-preview">
        <label className="field">
          <span className="field-label">试算 x</span>
          <input
            aria-label="试算 x"
            type="number"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
        </label>
        <output>{preview}</output>
      </div>
    </div>
  );
}
