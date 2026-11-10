import FormulaEditor from "./FormulaEditor";
import ScheduleEditor from "./ScheduleEditor";
import { boundedActiveFor } from "./schedule";
import {
  defaultEffectName,
  namedEffect,
  automaticEffectName,
} from "./effect-names";
import {
  timingPreset,
  isGlobalEffect,
  isStackingEffect,
  environmentEffect,
  realtimeConfig,
} from "./effect-catalog";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SkillOptionsContext } from "./SkillOptionsContext";
import { REALTIME_KINDS, type RealtimeConfig } from "./model";
import { Plus, Trash2, X, ArrowRight, Info, ChevronDown } from "lucide-react";
import {
  ATTACKS,
  SCALINGS,
  VARIABLE_STATS,
  VALUE_MODES,
  ELEMENTS,
  SPECIALS,
  EFFECT_TYPES,
  effectTypeName,
  effectTypeNote,
  isEnemyEffect,
  isDamageEffect,
  PERCENT_EFFECTS,
  STATS,
  ALL_STATS,
  CHARACTER_ELEMENTS,
  MAIN_SLOTS,
  artifactMainStat,
  mainOptions,
  type Artifact,
  type MainStats,
  uid,
  statValue,
  fmt,
  charName,
  effect,
  effectUnit,
  usesDirectVariableValue,
  type Character,
  type Damage,
  type Effect,
  type Substat,
  type StatKey,
} from "./model";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
export function Num({
  value,
  onChange,
  unit,
  min,
  max,
  label,
  disabled = false,
  disableWheel = false,
}: {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  label?: string;
  disabled?: boolean;
  disableWheel?: boolean;
}) {
  const [raw, setRaw] = useState(String(value));
  const focused = useRef(false);
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (!focused.current || value !== lastEmitted.current)
      setRaw(String(value));
    lastEmitted.current = value;
  }, [value]);
  return (
    <span className={`number-input ${disabled ? "disabled" : ""}`}>
      <input
        onWheel={disableWheel ? (e) => e.currentTarget.blur() : undefined}
        aria-label={label}
        type="number"
        step="any"
        min={min}
        max={max}
        disabled={disabled}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const next = e.target.valueAsNumber;
          if (
            e.target.value !== "" &&
            Number.isFinite(next) &&
            (min === undefined || next >= min)
          ) {
            const bounded = max === undefined ? next : Math.min(max, next);
            if (bounded !== next) setRaw(String(bounded));
            lastEmitted.current = bounded;
            onChange(bounded);
          }
        }}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          const next = raw.trim() === "" ? 0 : Number(raw);
          const normalized = Math.min(
            max ?? Infinity,
            Number.isFinite(next)
              ? min === undefined
                ? next
                : Math.max(min, next)
              : value,
          );
          setRaw(String(normalized));
          lastEmitted.current = normalized;
          onChange(normalized);
        }}
      />
      {unit && <span>{unit}</span>}
    </span>
  );
}
export function CharacterSelect({
  value,
  onChange,
  characters,
  label,
  allowNone = false,
}: {
  value: string;
  onChange: (v: string) => void;
  characters: Character[];
  label?: string;
  allowNone?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowNone && <option value="">无对象</option>}
      {characters.map((c, i) => (
        <option key={c.id} value={c.id}>
          {String(i + 1).padStart(2, "0")} · {charName(c, i)}
        </option>
      ))}
    </select>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" aria-label="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  icon,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function DamageEditor({
  value,
  onChange,
  filter = false,
}: {
  value: Damage;
  onChange: (v: Damage) => void;
  filter?: boolean;
}) {
  const update = (key: keyof Damage, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="damage-editor">
      <div className="form-grid three">
        <Field label="属性">
          <select
            value={value.element}
            onChange={(e) => update("element", e.target.value)}
          >
            {(filter ? ["全部", ...ELEMENTS] : ELEMENTS).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="伤害类型">
          <select
            value={value.attack}
            onChange={(e) => update("attack", e.target.value)}
          >
            {(filter ? ["全部", ...ATTACKS] : ATTACKS).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="乘区">
          <select
            value={value.scaling}
            onChange={(e) => update("scaling", e.target.value)}
          >
            {(filter ? ["全部", ...SCALINGS] : SCALINGS).map((x) => (
              <option value={x} key={x}>
                {x === "全部" ? x : `${x}乘区`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <span className="field-label advanced-label">
        高级属性{" "}
        <span className="field-hint">
          可不选，最多选择一项{filter && "；不选则不限制"}
        </span>
      </span>
      <div className="specials">
        {SPECIALS.map((x) => (
          <label key={x} className={value.special === x ? "checked" : ""}>
            <input
              type="checkbox"
              checked={value.special === x}
              onChange={() => update("special", value.special === x ? "" : x)}
            />
            {x}伤害
          </label>
        ))}
      </div>
    </div>
  );
}
export function SubstatEditor({
  value,
  onChange,
  max,
  weapon = false,
}: {
  value: Substat[];
  onChange: (v: Substat[]) => void;
  max?: number;
  weapon?: boolean;
}) {
  function update(id: string, patch: Partial<Substat>) {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  return (
    <div className="substat-editor">
      <div className="subheading">
        <h4>
          副词条{" "}
          <span>
            {value.length}
            {max ? ` / ${max}` : " 条"}
          </span>
        </h4>
        <button
          className="text-btn"
          disabled={!!max && value.length >= max}
          onClick={() =>
            onChange([
              ...value,
              { id: uid(), type: "critRate", mode: "rolls", value: 1 },
            ])
          }
        >
          <Plus size={14} />
          添加词条
        </button>
      </div>
      {!value.length && (
        <p className="muted small">
          尚未添加副词条
          {max === 1 ? "，武器最多添加 1 条。" : "，可按词条数或实际数值输入。"}
        </p>
      )}
      {value.map((s) => {
        const meta = ALL_STATS[s.type];
        const ignored = s.type === "notImportant";
        return (
          <div className="stat-entry" key={s.id}>
            <div className="stat-row">
              <select
                aria-label="词条类别"
                value={s.type}
                onChange={(e) => {
                  const type = e.target.value as StatKey;
                  const direct = ALL_STATS[type].average === null;
                  update(s.id, {
                    type,
                    ...(direct
                      ? {
                          mode: "direct" as const,
                          value: type === "notImportant" ? 0 : statValue(s),
                        }
                      : {}),
                  });
                }}
              >
                {Object.entries(
                  weapon
                    ? ALL_STATS
                    : { ...STATS, notImportant: ALL_STATS.notImportant },
                ).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="词条输入方式"
                disabled={meta.average === null}
                value={s.mode}
                onChange={(e) => {
                  const mode = e.target.value as Substat["mode"];
                  update(s.id, {
                    mode,
                    value:
                      mode === "direct"
                        ? statValue(s)
                        : Number((s.value / (meta.average ?? 1)).toFixed(6)),
                  });
                }}
              >
                <option value="rolls">词条数</option>
                <option value="direct">直接数值</option>
              </select>
              <Num
                label="词条数值"
                disabled={ignored}
                value={s.value}
                min={0}
                onChange={(v) => update(s.id, { value: v })}
                unit={s.mode === "rolls" ? "条" : meta.percent ? "%" : "点"}
              />
              <button
                className="icon-btn danger"
                aria-label="删除词条"
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="stat-caption">
              <span>
                {ignored ? (
                  "不影响伤害"
                ) : meta.average === null ? (
                  "按实际百分比输入"
                ) : (
                  <>
                    均值 {meta.average}
                    {meta.percent ? "%" : ""} / 条{" "}
                    <span title={`四档数值：${meta.tiers}`}>
                      <Info size={12} />
                    </span>
                  </>
                )}
              </span>
              <span className="stat-result">
                <ArrowRight size={12} />
                {fmt(statValue(s))}
                {meta.percent ? "%" : ""} {meta.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
export function EffectEditor({
  value,
  onChange,
  characters,
  sourceLocked = false,
  environment = false,
  allowNoSource = false,
  defaultName,
}: {
  value: Effect;
  onChange: (v: Effect) => void;
  characters: Character[];
  sourceLocked?: boolean;
  allowGlobal?: boolean;
  environment?: boolean;
  allowNoSource?: boolean;
  defaultName?: string;
}) {
  const generatedName =
    defaultName ??
    defaultEffectName(
      characters,
      environment ? "" : value.sourceId,
      environment ? "环境/元素共鸣" : "独立效果",
    );
  const global = isGlobalEffect(value, environment);
  const stacking = !global && isStackingEffect(value);
  const skills = useContext(SkillOptionsContext);
  const config = realtimeConfig(value);
  function update(patch: Partial<Effect>) {
    const next = { ...value, ...patch };
    if (!next.sourceId && next.target === "self") next.target = "team";
    onChange(
      environment
        ? environmentEffect({ ...next, unit: effectUnit(next) })
        : { ...next, unit: effectUnit(next) },
    );
  }
  return (
    <div className="effect-form">
      <Field label="效果分类">
        <select
          value={global ? "global" : "realtime"}
          onChange={(e) =>
            update({
              category: e.target.value as Effect["category"],
              global: e.target.value === "global",
              ...(e.target.value === "realtime" ? { realtime: config } : {}),
            })
          }
        >
          <option value="global">全局效果</option>
          <option value="realtime">实时效果</option>
        </select>
      </Field>
      {global && (
        <div>
          <label className="infinite-toggle">
            <input
              type="checkbox"
              checked={value.outsideActive ?? false}
              onChange={(e) => update({ outsideActive: e.target.checked })}
            />
            局外生效
          </label>
          <p className="formula-note">
            勾选后也参与局外面板。局外计算只读取装备和已勾选的全局效果；实时变量按局外环境解析，前台对象使用初始场上角色。实时面板不会重复计入此效果。
          </p>
        </div>
      )}
      {!global && (
        <Field label="实时效果类型">
          <select
            value={config.kind}
            onChange={(e) =>
              update({
                realtime: {
                  ...config,
                  kind: e.target.value as RealtimeConfig["kind"],
                  max: config.kind === "fixed" ? 5 : config.max,
                },
              })
            }
          >
            {Object.entries(REALTIME_KINDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!global && (
        <details className="skill-binding">
          <summary>技能绑定（{value.boundSkillIds?.length ?? 0}）</summary>
          <p className="input-note">
            释放所选技能时自动触发，同次伤害生效。不造成伤害的技能也可绑定效果。
          </p>
          <div className="target-selection">
            {skills.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={value.boundSkillIds?.includes(s.id) ?? false}
                  onChange={(event) =>
                    update({
                      realtime: config,
                      boundSkillIds: event.target.checked
                        ? [...(value.boundSkillIds ?? []), s.id]
                        : value.boundSkillIds?.filter((id) => id !== s.id),
                    })
                  }
                />
                {characters.find((c) => c.id === s.characterId)?.name ||
                  "未命名角色"}{" "}
                · {s.name || "未命名技能"}
              </label>
            ))}
          </div>
          {!skills.length && <p className="input-note">请先添加技能。</p>}
        </details>
      )}

      {value.skillFilter && (
        <div className="info-strip">
          <span>
            仅限技能「{value.skillFilter.name || "未命名技能"}
            」；由旧技能参数迁移。
          </span>
          <button
            className="text-btn"
            onClick={() => update({ skillFilter: undefined })}
          >
            移除技能限制
          </button>
        </div>
      )}
      <div className="form-grid two">
        <div>
          <Field label="效果名称">
            <input
              placeholder="例如：全队攻击力提升"
              value={automaticEffectName(value) ? generatedName : value.name}
              onChange={(e) =>
                update({ name: e.target.value, nameMode: "custom" })
              }
            />
          </Field>
          <button
            className="text-btn"
            type="button"
            onClick={() => update({ name: generatedName, nameMode: "auto" })}
          >
            恢复默认名称
          </button>
        </div>
        {!environment && (
          <Field label="来源角色">
            {sourceLocked ? (
              <div className="read-field">
                {charName(
                  characters.find((c) => c.id === value.sourceId) ||
                    characters[0],
                  characters.findIndex((c) => c.id === value.sourceId),
                )}
              </div>
            ) : (
              <CharacterSelect
                allowNone={allowNoSource}
                value={value.sourceId}
                characters={characters}
                onChange={(sourceId) => update({ sourceId })}
              />
            )}
          </Field>
        )}
      </div>
      <div className="form-grid two">
        <Field label="生效对象">
          <select
            value={isEnemyEffect(value.type) ? "enemy" : value.target}
            disabled={isEnemyEffect(value.type)}
            onChange={(e) =>
              update({ target: e.target.value as Effect["target"] })
            }
          >
            {!environment && value.sourceId && (
              <option value="self">自己</option>
            )}
            <option value="foreground">前台角色</option>
            <option value="elements">按角色属性选择</option>
            {isEnemyEffect(value.type) && (
              <option value="enemy">敌方（无需选择角色）</option>
            )}
            <option value="team">全队</option>
            <option value="custom">高级 · 自选队友</option>
          </select>
        </Field>
        <Field label="效果类型">
          <select
            value={value.type === "星月额外提升" ? "基础值加成" : value.type}
            onChange={(e) => {
              const type = e.target.value as Effect["type"];
              update({
                type,
                ...((PERCENT_EFFECTS as readonly string[]).includes(type)
                  ? { unit: "percent" as const }
                  : ["基础值加成", "星月额外提升", "独立乘区"].includes(type)
                    ? { unit: "flat" as const }
                    : {}),
                ...(type === "擢升" && value.type !== "擢升"
                  ? { value: 0 }
                  : {}),
                ...(type === "独立乘区" && value.type !== "独立乘区"
                  ? { value: 1 }
                  : {}),
              });
            }}
          >
            {EFFECT_TYPES.filter((x) => x !== "星月额外提升").map((x) => (
              <option key={x} value={x}>
                {[
                  "生命值",
                  "攻击力",
                  "防御力",
                  "元素精通",
                  "暴击率",
                  "暴击伤害",
                  "敌方抗性",
                ].includes(x)
                  ? `改变${x}`
                  : effectTypeName(x)}
                {effectTypeNote(x) ? ` ${effectTypeNote(x)}` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {effectTypeNote(value.type) && (
        <p className="effect-wording">
          {effectTypeName(value.type)}：{effectTypeNote(value.type)}
        </p>
      )}
      {!isEnemyEffect(value.type) && value.target === "custom" && (
        <div className="target-selection">
          {characters.map((c, i) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={value.targetIds.includes(c.id)}
                onChange={(e) =>
                  update({
                    targetIds: e.target.checked
                      ? [...value.targetIds, c.id]
                      : value.targetIds.filter((id) => id !== c.id),
                  })
                }
              />
              {i + 1} · {charName(c, i)}
            </label>
          ))}
          {!value.targetIds.length && (
            <span className="validation">请选择至少一个生效对象</span>
          )}
        </div>
      )}
      {!isEnemyEffect(value.type) && value.target === "elements" && (
        <div className="target-selection">
          {CHARACTER_ELEMENTS.map((el) => (
            <label key={el}>
              <input
                type="checkbox"
                checked={value.targetElements.includes(el)}
                onChange={(e) =>
                  update({
                    targetElements: e.target.checked
                      ? [...value.targetElements, el]
                      : value.targetElements.filter((x) => x !== el),
                  })
                }
              />
              {el}角色
            </label>
          ))}
          {!value.targetElements.length && (
            <span className="validation">请选择至少一种角色属性</span>
          )}
        </div>
      )}
      {!isEnemyEffect(value.type) && value.target === "foreground" && (
        <p className="formula-note">
          对象跟随时间轴的前台角色；切换角色后，后续事件使用新的场上角色。
        </p>
      )}
      {isDamageEffect(value.type) && (
        <DamageEditor
          filter
          value={value.damage}
          onChange={(damage) => update({ damage })}
        />
      )}
      {value.type === "增幅反应增伤" && (
        <>
          <Field label="增幅反应类型">
            <select
              value={value.amplificationReaction ?? "全部"}
              onChange={(e) =>
                update({
                  amplificationReaction: e.target
                    .value as Effect["amplificationReaction"],
                })
              }
            >
              <option>全部</option>
              <option>蒸发</option>
              <option>融化</option>
            </select>
          </Field>
          <p className="formula-note">
            仅对时间轴勾选的蒸发/融化命中生效。同类反应增伤相加，与精通项相加后乘基础系数；基础增伤不会自动计入此项。
          </p>
        </>
      )}
      {value.type === "倍率区" && (
        <>
          <Field label="倍率处理方式">
            <select
              value={value.multiplierMode}
              onChange={(e) =>
                update({
                  multiplierMode: e.target.value as Effect["multiplierMode"],
                })
              }
            >
              <option value="unconfirmed" disabled>
                请选择倍率语义
              </option>
              <option value="add">倍率增加（百分点加算）</option>
              <option value="scale">倍率提升（乘以 1 + 提升比例）</option>
            </select>
          </Field>
          <p className="formula-note">
            200% 倍率增加 20 个百分点 = 220%；提升 20% =
            240%。同类增加与提升分别求和，先增加再提升。
          </p>
        </>
      )}
      {[
        "基础值加成",
        "星月额外提升",
        "星月基础提升",
        "星月增伤",
        "擢升",
        "增伤区",
        "独立乘区",
      ].includes(value.type) && (
        <p className="formula-note">
          {value.type === "基础值加成" || value.type === "星月额外提升"
            ? "直接填写增加的伤害数值。常规直伤在基础增伤之前加算；星月直伤在基础提升、精通和专属增伤之后加算，再参与抗性、暴击、擢升和独立乘区。"
            : value.type === "独立乘区"
              ? "直接填写系数，例如1.2表示最终伤害×1.2。多个独立乘区分别相乘；变层数效果每层乘一次（3层1.2为1.2³）。普通和星月直伤均适用。"
              : value.type === "擢升"
                ? "填写擢升百分数；所有生效且匹配的擢升相加。10% + 5% 对应最终系数 1 + 15% = 1.15。支持基础、局外、实时变量及条件公式。"
                : value.type === "星月基础提升"
                  ? "只放大星月直伤的属性×倍率基础部分。"
                  : value.type === "星月增伤"
                    ? "与星月精通加成相加，不与普通元素增伤混用。"
                    : "常规直伤增伤，与对应元素/物理面板加成、易伤、减伤在同一个括号合并；星月直伤不使用此区。"}
        </p>
      )}
      {value.type === "敌方抗性" && (
        <Field label="抗性属性">
          <select
            value={value.damage.element}
            onChange={(e) =>
              update({
                damage: {
                  ...value.damage,
                  element: e.target.value as Damage["element"],
                },
              })
            }
          >
            {["全部", ...ELEMENTS].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="form-grid two">
        <Field label="数值方式">
          <select
            value={value.valueMode}
            onChange={(e) =>
              update({ valueMode: e.target.value as Effect["valueMode"] })
            }
          >
            <option value="number">固定数值</option>
            <option value="base">角色基础数值</option>
            <option value="outside">角色局外数值</option>
            <option value="live">角色实时数值</option>
          </select>
        </Field>
        <Field label="数值单位">
          <select
            value={value.type === "擢升" ? "percent" : effectUnit(value)}
            disabled={
              value.type === "擢升" ||
              value.type === "独立乘区" ||
              usesDirectVariableValue(value)
            }
            onChange={(e) => update({ unit: e.target.value as Effect["unit"] })}
          >
            <option value="percent">百分比（%）</option>
            <option value="flat">
              {value.type === "独立乘区" ? "系数（×）" : "固定数值"}
            </option>
          </select>
        </Field>
      </div>
      {value.valueMode === "number" ? (
        <Field
          label={stacking ? "每层效果数值" : "效果数值"}
          hint={
            value.type === "独立乘区"
              ? "填写非负系数，1表示不变"
              : "支持正数与负数"
          }
        >
          <Num
            min={value.type === "独立乘区" ? 0 : undefined}
            value={value.value}
            onChange={(v) => update({ value: v })}
            unit={
              value.type === "独立乘区"
                ? "×"
                : effectUnit(value) === "percent"
                  ? "%"
                  : "点"
            }
          />
        </Field>
      ) : (
        <>
          <div className="form-grid three">
            <Field label="变量来源">
              <CharacterSelect
                characters={characters}
                value={value.variableCharacterId}
                onChange={(variableCharacterId) =>
                  update({ variableCharacterId })
                }
              />
            </Field>
            <Field label="角色属性">
              <select
                value={value.variableStat}
                onChange={(e) =>
                  update({
                    variableStat: e.target.value as Effect["variableStat"],
                  })
                }
              >
                {VARIABLE_STATS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="系数" hint="支持负数">
              <Num
                disabled={value.advanced}
                value={value.coefficient}
                onChange={(coefficient) => update({ coefficient })}
                unit="×"
              />
            </Field>
          </div>
          <p className="formula-note">
            {value.valueMode === "base"
              ? "基础：仅角色自身数值与武器基础攻击力，不含武器副词条及任何圣遗物词条、效果。"
              : value.valueMode === "outside"
                ? "局外：包含角色、武器和圣遗物主副词条，以及勾选局外生效的全局效果，不包含时间轴效果。"
                : "实时：在所选时间轴事件之前，读取角色当前数值与有效属性效果。"}
          </p>
          <label className="infinite-toggle">
            <input
              type="checkbox"
              checked={value.advanced}
              onChange={(e) =>
                update({
                  advanced: e.target.checked,
                  formulas:
                    e.target.checked && !value.formulas.length
                      ? [
                          {
                            id: uid(),
                            condition: "",
                            formula: `x * ${value.coefficient}`,
                          },
                        ]
                      : value.formulas,
                })
              }
            />
            高级公式
          </label>
          {value.advanced && usesDirectVariableValue(value) && (
            <p className="formula-note">
              公式结果直接作为{value.type}增加值，不按百分比转换。
            </p>
          )}
          {value.advanced ? (
            <FormulaEditor
              value={value.formulas}
              onChange={(formulas, formulaPreset) =>
                update({
                  formulas,
                  ...(formulaPreset ? { formulaPreset } : {}),
                })
              }
              preset={value.formulaPreset}
              onPresetChange={(formulaPreset) => update({ formulaPreset })}
              effectLabel={`${value.type}${effectUnit(value) === "percent" ? "（%）" : "（点）"}`}
            />
          ) : (
            <p className="formula-note">
              效果数值 = x × 系数
              {usesDirectVariableValue(value)
                ? `，结果直接作为${value.type}增加值（结果20表示增加20点），不再按百分比乘基础属性。`
                : effectUnit(value) === "percent"
                  ? "，结果按百分比使用（结果20表示20%）。"
                  : value.type === "独立乘区"
                    ? "，结果直接作为最终乘数（结果1.2表示×1.2）。"
                    : "，结果直接作为数值使用。"}
            </p>
          )}
        </>
      )}
      {!global && (
        <TimingPresetEditor
          value={config}
          onChange={(realtime) => update({ realtime })}
        />
      )}
      {global && (
        <p className="formula-note">
          全局效果始终参与每次伤害计算，不通过时间轴触发，不受层数或持续时间影响；实时变量按该事件当时数值计算。
        </p>
      )}
    </div>
  );
}
export function EffectsList({
  value,
  onChange,
  characters,
  sourceId,
  title = "提供效果",
  allowGlobal = false,
  sourceType = "技能",
  ownerName = "",
  ownerSkillId,
}: {
  value: Effect[];
  onChange: (v: Effect[]) => void;
  characters: Character[];
  sourceId: string;
  title?: string;
  allowGlobal?: boolean;
  sourceType?: string;
  ownerName?: string;
  ownerSkillId?: string;
}) {
  const generatedName = defaultEffectName(
    characters,
    sourceId,
    sourceType,
    ownerName,
  );
  return (
    <div className="effects-list">
      <div className="subheading">
        <h4>
          {title} <span>{value.length} 条</span>
        </h4>
        <button
          className="text-btn"
          onClick={() =>
            onChange([
              ...value,
              namedEffect(
                {
                  ...effect(sourceId),
                  realtime: realtimeConfig(effect(sourceId)),
                  boundSkillIds: ownerSkillId ? [ownerSkillId] : [],
                },
                generatedName,
              ),
            ])
          }
        >
          <Plus size={14} />
          添加效果
        </button>
      </div>
      {value.map((e, i) => (
        <EffectFold
          key={e.id}
          title={
            <>
              效果 {String(i + 1).padStart(2, "0")} ·{" "}
              {automaticEffectName(e) ? generatedName : e.name || "未命名效果"}
            </>
          }
          actions={
            <button
              className="icon-btn danger"
              aria-label="删除效果"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                onChange(value.filter((x) => x.id !== e.id));
              }}
            >
              <Trash2 size={14} />
            </button>
          }
        >
          <EffectEditor
            allowGlobal={allowGlobal}
            sourceLocked
            defaultName={generatedName}
            value={{ ...e, sourceId }}
            onChange={(next) =>
              onChange(value.map((x) => (x.id === e.id ? next : x)))
            }
            characters={characters}
          />
        </EffectFold>
      ))}
    </div>
  );
}
export function EffectFold({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="effect-details" open={expanded}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          setExpanded(!expanded);
        }}
      >
        <span className="effect-fold-title">
          <ChevronDown size={16} />
          {title}
        </span>
        {actions}
      </summary>
      {children}
    </details>
  );
}
export function effectSummary(e: Effect) {
  const value =
    e.valueMode === "number"
      ? `${e.value > 0 && e.type !== "独立乘区" ? "+" : ""}${fmt(e.value)}${effectUnit(e) === "percent" ? "%" : ""}`
      : `${VALUE_MODES[e.valueMode]} · ${e.variableStat} ${e.advanced ? `条件公式(${e.formulas.length}条)` : `× ${fmt(e.coefficient)}`}${effectUnit(e) === "percent" ? "%" : ""}`;
  const target = isEnemyEffect(e.type)
    ? "敌方"
    : e.target === "team"
      ? "全队"
      : e.target === "self"
        ? "自己"
        : e.target === "foreground"
          ? "前台角色"
          : e.target === "elements"
            ? `${e.targetElements.join("/")}角色`
            : `${e.targetIds.length} 个角色`;
  return `${target} · ${!isGlobalEffect(e) && isStackingEffect(e) ? "每层 " : ""}${effectTypeName(e.type)} ${e.type === "独立乘区" ? "× " : ""}${value}${isGlobalEffect(e) && e.outsideActive ? " · 局外生效" : ""}`;
}

export function effectDurationSummary(e: Effect) {
  const t = timingPreset(e);
  return `预设 ${t.count} 层 · ${t.duration === null ? "永久" : `${fmt(t.duration)}s`}`;
}

export function TimingPresetEditor({
  value: c,
  onChange,
}: {
  value: RealtimeConfig;
  onChange: (v: RealtimeConfig) => void;
}) {
  const patch = (v: Partial<RealtimeConfig>) => {
    const next = { ...c, ...v };
    onChange({
      ...next,
      activeFor: boundedActiveFor(next.kind, next.duration, next.activeFor),
    });
  };
  const integer = (v: number) =>
    Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(v)));
  const stacking = c.kind !== "fixed",
    periodic = c.kind.endsWith("Periodic");
  return (
    <div className="stack-editor timing-presets">
      <h4>{stacking ? "层数与持续时间预设" : "持续时间预设"}</h4>
      <div className="form-grid two">
        {stacking && (
          <>
            <Field label="最大层数">
              <Num
                value={c.max ?? 0}
                disabled={c.max === null}
                min={1}
                unit="层"
                onChange={(v) => patch({ max: Math.max(1, integer(v)) })}
              />
            </Field>
            <Field label="初始层数" hint="0.00s时已有层数，不显示事件">
              <Num
                value={c.initial}
                min={0}
                unit="层"
                onChange={(v) => patch({ initial: integer(v) })}
              />
            </Field>
          </>
        )}
        <Field
          label={
            c.kind.startsWith("independent")
              ? "默认每层持续时间"
              : c.kind.startsWith("shared")
                ? "默认共用持续时间"
                : "默认持续时间"
          }
        >
          <Num
            value={c.duration ?? 0}
            disabled={c.duration === null}
            min={0}
            unit="s"
            onChange={(duration) => patch({ duration })}
          />
        </Field>
        {periodic && (
          <>
            <Field label="默认变化间隔">
              <Num
                min={0.000001}
                value={c.interval}
                unit="s"
                onChange={(interval) => patch({ interval })}
              />
            </Field>
            <Field label="默认每次变化层数" hint="正数增加，负数扣除">
              <Num
                value={c.delta}
                unit="层"
                onChange={(v) =>
                  patch({
                    delta: Math.max(
                      -Number.MAX_SAFE_INTEGER,
                      Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(v)),
                    ),
                  })
                }
              />
            </Field>
          </>
        )}
      </div>
      <div className="button-group">
        <label className="infinite-toggle">
          <input
            type="checkbox"
            checked={c.duration === null}
            onChange={(e) => patch({ duration: e.target.checked ? null : 10 })}
          />
          默认永久
        </label>
        {stacking && (
          <label className="infinite-toggle">
            <input
              type="checkbox"
              checked={c.max === null}
              onChange={(e) => patch({ max: e.target.checked ? null : 5 })}
            />
            无上限叠加
          </label>
        )}
      </div>
      {periodic && (
        <ScheduleEditor
          preset
          maxDuration={c.kind === "sharedPeriodic" ? c.duration : undefined}
          duration={c.activeFor ?? null}
          interval={c.interval}
          onChange={(activeFor) => patch({ activeFor })}
        />
      )}
      <p className="input-note">
        时间轴填写本次层数；持续时间{periodic ? "和定时参数" : ""}
        默认跟随这里的预设。{stacking && "初始层数从0秒起计时。"}
        {periodic && "定时变化在时间轴触发后开始。"}
      </p>
    </div>
  );
}

export function MainStatEditor({
  value: a,
  onChange,
}: {
  value: Artifact;
  onChange: (v: Partial<Artifact>) => void;
}) {
  const updateSlot = (
    slot: keyof MainStats,
    patch: {
      type?: MainStats[keyof MainStats];
      full?: boolean;
      value?: number;
    },
  ) => {
    const current = artifactMainStat(a, slot);
    const full = patch.full ?? a.mainStat20?.[slot] !== false;
    const type = patch.type ?? a.mainStats[slot];
    onChange({
      mainStats: { ...a.mainStats, [slot]: type },
      mainStat20: { ...a.mainStat20, [slot]: full },
      mainStatValues: {
        ...a.mainStatValues,
        [slot]:
          patch.value ??
          (patch.full === false
            ? current.value
            : (a.mainStatValues?.[slot] ?? current.value)),
      },
      importedMainStats: undefined,
    });
  };
  return (
    <div className="mainstat-editor">
      <div className="subheading">
        <h4>
          主词条 <span>5 个部位</span>
        </h4>
      </div>
      <div className="mainstat-grid">
        {(Object.keys(MAIN_SLOTS) as (keyof MainStats)[]).map((slot) => {
          const full = a.mainStat20?.[slot] !== false,
            type = a.mainStats[slot];
          const fixed = slot === "flower" || slot === "feather";
          return (
            <div className="mainstat-slot" key={slot}>
              <Field label={MAIN_SLOTS[slot]}>
                <select
                  aria-label={`${MAIN_SLOTS[slot]}主词条`}
                  value={type}
                  disabled={fixed}
                  onChange={(e) =>
                    updateSlot(slot, {
                      type: e.target.value as MainStats[keyof MainStats],
                    })
                  }
                >
                  {mainOptions(slot).map((key) => (
                    <option key={key} value={key}>
                      {key === "notImportant"
                        ? "NOT IMPORTANT"
                        : ALL_STATS[key].name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="infinite-toggle">
                <input
                  type="checkbox"
                  aria-label={`${MAIN_SLOTS[slot]}为20级5星圣遗物`}
                  checked={full}
                  onChange={(e) => updateSlot(slot, { full: e.target.checked })}
                />
                20级5星圣遗物
              </label>
              <Field label={`${MAIN_SLOTS[slot]}主词条数值`}>
                <Num
                  value={artifactMainStat(a, slot).value}
                  disabled={full || type === "notImportant"}
                  onChange={(value) => updateSlot(slot, { value })}
                  unit={ALL_STATS[type].percent ? "%" : "点"}
                />
              </Field>
            </div>
          );
        })}
      </div>
      <p className="input-note">
        勾选20级5星圣遗物使用固定主词条；取消勾选可自定义数值。花、毛类型固定，其它部位沿用原有类型列表。
      </p>
    </div>
  );
}
