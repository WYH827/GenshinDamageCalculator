import EquipmentVisual from "./EquipmentVisual";
import CharacterVisual, { ElementIcon } from "./CharacterVisual";
import portraits from "./data/portraits.json";
import LevelSelect from "./LevelSelect";
import { effectFormulaError } from "./formulas";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Check,
  ChevronDown,
  FolderOpen,
  MessageSquare,
  Plus,
  Sparkles,
  Swords,
  Trash2,
} from "lucide-react";
import {
  Field,
  Num,
  CharacterSelect,
  DamageEditor,
  EffectsList,
  SubstatEditor,
  MainStatEditor,
  Empty,
} from "./components";
import {
  ELEMENTS,
  ASCENSION_STATS,
  ALL_STATS,
  type AscensionStat,
  CHARACTER_ELEMENTS,
  starsForLevel,
  effectTargetValid,
  VALUE_MODES,
  type Artifact,
  charName,
  resultTeamName,
  sortedEquipment,
  assignEquipment,
  skill,
  moveSkill,
  type Character,
  type Project,
  type Skill,
  type Weapon,
} from "./model";

export type Update = (fn: (p: Project) => Project) => void;
export const elementClass = (element: string) =>
  `element-${ELEMENTS.indexOf(element as (typeof ELEMENTS)[number])}`;
export const Avatar = CharacterVisual;
export function SectionTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Characters({
  project: p,
  update,
  preset,
}: {
  project: Project;
  update: Update;
  preset: (
    kind: "character" | "weapon",
    id: string,
    mode: "save" | "load",
  ) => void;
}) {
  const [active, setActive] = useState(p.characters[0].id);
  const c = p.characters.find((c) => c.id === active) || p.characters[0];
  const index = p.characters.indexOf(c);
  function patch(change: Partial<Character>) {
    update((p) => ({
      ...p,
      characters: p.characters.map((x) =>
        x.id === c.id ? { ...x, ...change } : x,
      ),
    }));
  }
  function move(direction: number) {
    update((p) => {
      const characters = [...p.characters];
      [characters[index], characters[index + direction]] = [
        characters[index + direction],
        characters[index],
      ];
      return { ...p, characters };
    });
  }
  return (
    <>
      <SectionTitle
        eyebrow="01 / CHARACTERS"
        title="配置你的队伍"
        description="从四位角色开始，建立这场战斗的基础。"
      >
        <span className="soft-badge">
          <span className="green-dot" />
          {p.characters.filter((c) => c.name).length} / 4 已配置
        </span>
      </SectionTitle>
      <div className="character-grid">
        {p.characters.map((character, i) => (
          <button
            className={`character-card ${c.id === character.id ? "selected" : ""}`}
            key={character.id}
            onClick={() => setActive(character.id)}
          >
            <div className="slot-label">
              SLOT {String(i + 1).padStart(2, "0")}
              {c.id === character.id && (
                <span>
                  <Check size={11} />
                  编辑中
                </span>
              )}
            </div>
            <div className="character-preview">
              <Avatar character={character} index={i} />
              <div>
                <h3>{charName(character, i)}</h3>
                <p>
                  {character.name
                    ? `${character.element}属性 · ${character.constellation || "0"}命`
                    : "点击配置角色"}
                </p>
              </div>
            </div>
            <div className="character-bottom">
              <span>
                {character.name
                  ? `${character.gold} 金 · ${starsForLevel(character.level)} 命星`
                  : "等待加入队伍"}
              </span>
              <span>{character.short || "—"}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="panel character-editor">
        <div className="panel-header">
          <div className="panel-heading">
            <span className="panel-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>
                {charName(c, index)}{" "}
                <span className={`element-tag ${elementClass(c.element)}`}>
                  <ElementIcon element={c.element} /> {c.element}
                </span>
              </h3>
              <p>角色基础信息与初始面板</p>
            </div>
          </div>
          <div className="button-group">
            <button
              className="icon-btn"
              title="角色前移"
              aria-label="角色前移"
              disabled={index === 0}
              onClick={() => move(-1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-btn"
              title="角色后移"
              aria-label="角色后移"
              disabled={index === 3}
              onClick={() => move(1)}
            >
              <ArrowDown size={16} />
            </button>
            <span className="button-divider" />
            <button
              className="btn small-btn"
              onClick={() => preset("character", c.id, "load")}
            >
              <FolderOpen size={15} />
              导入预设
            </button>
            <button
              className="btn small-btn"
              onClick={() => preset("character", c.id, "save")}
            >
              <BookmarkPlus size={15} />
              保存预设
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div className="form-section-title">
            <span>基础信息</span>
            <span>IDENTITY</span>
          </div>
          <div className="form-grid character-info">
            <Field label="角色名称">
              <input
                value={c.name}
                placeholder="输入角色名称"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
            <Field label="角色简写" hint="单字">
              <input
                value={c.short}
                placeholder="如：偶"
                onChange={(e) =>
                  patch({
                    short: Array.from(e.target.value).slice(0, 1).join(""),
                  })
                }
              />
            </Field>
            <Field label="命座">
              <input
                value={c.constellation}
                placeholder="如：2"
                onChange={(e) => patch({ constellation: e.target.value })}
              />
            </Field>
            <Field label="角色属性">
              <select
                value={c.element}
                onChange={(e) =>
                  patch({
                    element: e.target.value as Character["element"],
                    elementNeedsReview: false,
                  })
                }
              >
                {CHARACTER_ELEMENTS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="金数">
              <Num
                min={0}
                value={c.gold}
                onChange={(gold) => patch({ gold })}
              />
            </Field>
            <Field label="限定金数">
              <Num
                min={0}
                value={c.limitedGold}
                onChange={(limitedGold) => patch({ limitedGold })}
              />
            </Field>
            <LevelSelect
              key={c.id}
              value={c.level}
              onChange={(level) =>
                patch({ level, stars: starsForLevel(level) })
              }
            />
          </div>
          <div className="form-grid two portrait-settings">
            <Field label="角色头像">
              <select
                aria-label="角色头像"
                value={
                  portraits.some((p) => p.url === c.avatarUrl)
                    ? c.avatarUrl
                    : c.avatarUrl
                      ? "custom"
                      : ""
                }
                onChange={(e) =>
                  patch({
                    avatarUrl:
                      e.target.value === "custom" ? "" : e.target.value,
                  })
                }
              >
                <option value="">使用简写</option>
                {c.avatarUrl &&
                  !portraits.some((p) => p.url === c.avatarUrl) && (
                    <option value="custom">自定义头像</option>
                  )}
                {[...new Map(portraits.map((p) => [p.url, p])).values()].map(
                  (p) => (
                    <option key={p.url} value={p.url}>
                      {p.name}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="头像图片地址" hint="可粘贴Enka头像链接">
              <input
                aria-label="头像图片地址"
                value={c.avatarUrl ?? ""}
                placeholder="https://enka.network/ui/...png"
                onChange={(e) => patch({ avatarUrl: e.target.value })}
              />
            </Field>
          </div>
          {c.elementNeedsReview && (
            <p className="validation">
              旧方案将角色属性设为物理，已保留原伤害加成为物理伤害加成；请重新选择该角色的元素属性（暂显示火）。
            </p>
          )}
          <p className="input-note">
            1～90级对应0命星，95级对应1命星，100级对应3命星。队伍名仅在95/100级时自动添加等级前缀；防御系数使用所选等级。
          </p>
          <div className="form-section-title separated">
            <span>基础属性</span>
            <span>BASE STATS</span>
          </div>
          <div className="form-grid three">
            {(["hp", "atk", "def"] as const).map((key, i) => (
              <Field
                key={key}
                label={["基础生命值", "基础攻击力", "基础防御力"][i]}
              >
                <Num
                  value={c[key]}
                  min={0}
                  onChange={(v) => patch({ [key]: v })}
                />
              </Field>
            ))}
          </div>
          <div className="form-grid two base-crit-fields">
            <Field label="基础暴击率">
              <Num value={5} onChange={() => {}} unit="%" disabled />
            </Field>
            <Field label="基础暴击伤害">
              <Num value={50} onChange={() => {}} unit="%" disabled />
            </Field>
          </div>
          <div className="form-section-title separated">
            <span>突破属性</span>
            <span>ASCENSION</span>
          </div>
          <div className="form-grid two">
            <Field label="突破属性类型">
              <select
                aria-label="突破属性类型"
                value={c.ascension?.type ?? "critRate"}
                onChange={(e) =>
                  patch({
                    ascension: {
                      type: e.target.value as AscensionStat["type"],
                      value: c.ascension?.value ?? 0,
                    },
                  })
                }
              >
                {ASCENSION_STATS.map((key) => (
                  <option key={key} value={key}>
                    {ALL_STATS[key].name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="突破属性数值">
              <Num
                value={c.ascension?.value ?? 0}
                onChange={(value) =>
                  patch({
                    ascension: { type: c.ascension?.type ?? "critRate", value },
                  })
                }
                unit={
                  ALL_STATS[c.ascension?.type ?? "critRate"].percent
                    ? "%"
                    : "点"
                }
              />
            </Field>
          </div>
          <p className="input-note">
            填写突破带来的增量，例如暴击率突破19.2%应填19.2；基础暴击率5%、基础暴伤50%固定。百分比生命、攻击、防御按对应基础数值增加，装备另计。
          </p>
          {!!c.legacyAscension?.length && (
            <details className="legacy-ascension">
              <summary>
                旧方案其它自身数值（{c.legacyAscension.length}项，已保留）
              </summary>
              {c.legacyAscension.map((stat, i) => (
                <div className="form-grid three" key={i}>
                  <Field label={`保留属性 ${i + 1}`}>
                    <select
                      value={stat.type}
                      onChange={(e) =>
                        patch({
                          legacyAscension: c.legacyAscension!.map((s, j) =>
                            i === j
                              ? {
                                  ...s,
                                  type: e.target.value as AscensionStat["type"],
                                }
                              : s,
                          ),
                        })
                      }
                    >
                      {ASCENSION_STATS.map((key) => (
                        <option key={key} value={key}>
                          {ALL_STATS[key].name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`保留数值 ${i + 1}`}>
                    <Num
                      value={stat.value}
                      unit={ALL_STATS[stat.type].percent ? "%" : "点"}
                      onChange={(value) =>
                        patch({
                          legacyAscension: c.legacyAscension!.map((s, j) =>
                            i === j ? { ...s, value } : s,
                          ),
                        })
                      }
                    />
                  </Field>
                  <button
                    className="text-btn danger"
                    onClick={() =>
                      patch({
                        legacyAscension: c.legacyAscension!.filter(
                          (_, j) => i !== j,
                        ),
                      })
                    }
                  >
                    删除此项
                  </button>
                </div>
              ))}
            </details>
          )}
        </div>
        <div className="panel-footer">
          <span>
            <span className="green-dot" />
            当前队伍命名
          </span>
          <strong>{resultTeamName(p)}</strong>
          <span className="muted">角色顺序将同步至装备和技能</span>
        </div>
      </div>
    </>
  );
}
export function Equipment({
  project: p,
  update,
  kind,
  preset,
}: {
  project: Project;
  update: Update;
  kind: "weapons" | "artifacts";
  preset: (
    kind: "character" | "weapon",
    id: string,
    mode: "save" | "load",
  ) => void;
}) {
  const weapon = kind === "weapons";
  const [active, setActive] = useState(p.characters[0].id);
  const current = p.characters.find((c) => c.id === active) ?? p.characters[0];
  return (
    <>
      <SectionTitle
        eyebrow={weapon ? "02 / WEAPONS" : "04 / ARTIFACTS"}
        title={weapon ? "武器配置" : "圣遗物配置"}
        description={
          weapon
            ? "配置基础攻击力、副词条与武器效果，为每位角色搭配武器。"
            : "按平均词条数或实际数值，配置每位角色的圣遗物属性。"
        }
      />
      <div className="character-grid equipment-character-grid">
        {p.characters.map((c, i) => {
          const item = p[kind].find((x) => x.characterId === c.id)!;
          return (
            <button
              className={`character-card ${current.id === c.id ? "selected" : ""}`}
              key={c.id}
              onClick={() => setActive(c.id)}
            >
              <div className="slot-label">
                SLOT {String(i + 1).padStart(2, "0")}
                {current.id === c.id && (
                  <span>
                    <Check size={11} />
                    编辑中
                  </span>
                )}
              </div>
              <div className="character-preview">
                <Avatar character={c} index={i} />
                <div>
                  <h3>{charName(c, i)}</h3>
                  <p>{item.name || (weapon ? "未命名武器" : "未命名套装")}</p>
                </div>
              </div>
              <div className="character-bottom">
                <span>{item.effects.length} 条效果</span>
                <EquipmentVisual
                  kind={weapon ? "weapon" : "artifact"}
                  name={item.name}
                  urls={
                    weapon
                      ? (item as Weapon).iconUrl
                        ? [(item as Weapon).iconUrl!]
                        : []
                      : (item as Artifact).iconUrls
                  }
                />
              </div>
            </button>
          );
        })}
      </div>
      <div className="equipment-single">
        {sortedEquipment<Weapon | Artifact>(p[kind], p.characters)
          .filter((item) => item.characterId === current.id)
          .map((item) => {
            const c = p.characters.find((c) => c.id === item.characterId)!;
            const index = p.characters.indexOf(c);
            function patch(patch: Partial<typeof item>) {
              update((p) => ({
                ...p,
                [kind]: p[kind].map((x) =>
                  x.id === item.id ? { ...x, ...patch } : x,
                ),
              }));
            }
            return (
              <div className="panel equipment-panel" key={item.id}>
                <div className="panel-header">
                  <div className="panel-heading">
                    <Avatar small character={c} index={index} />
                    <EquipmentVisual
                      kind={weapon ? "weapon" : "artifact"}
                      name={item.name}
                      urls={
                        weapon
                          ? (item as Weapon).iconUrl
                            ? [(item as Weapon).iconUrl!]
                            : []
                          : (item as Artifact).iconUrls
                      }
                    />
                    <div>
                      <h3>{charName(c, index)}</h3>
                      <p>
                        {weapon ? "武器" : "圣遗物"} · SLOT{" "}
                        {String(index + 1).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                  {weapon && (
                    <div className="button-group">
                      <button
                        className="icon-btn"
                        title="导入武器预设"
                        aria-label={`导入武器预设 ${index + 1}`}
                        onClick={() => preset("weapon", item.id, "load")}
                      >
                        <FolderOpen size={17} />
                      </button>
                      <button
                        className="icon-btn"
                        title="保存武器预设"
                        aria-label={`保存武器预设 ${index + 1}`}
                        onClick={() => preset("weapon", item.id, "save")}
                      >
                        <BookmarkPlus size={17} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="panel-body">
                  <div className="form-grid two">
                    <Field label={weapon ? "武器名称" : "套装名字"}>
                      <input
                        placeholder={
                          weapon ? "输入武器名称" : "例如：四件套 / 散件"
                        }
                        value={item.name}
                        onChange={(e) => patch({ name: e.target.value })}
                      />
                    </Field>
                    <Field label="装备角色">
                      <CharacterSelect
                        characters={p.characters}
                        value={item.characterId}
                        onChange={(target) =>
                          update((p) => {
                            const items = assignEquipment<Weapon | Artifact>(
                              p[kind],
                              item.id,
                              target,
                            );
                            return {
                              ...p,
                              [kind]: items.map((x) =>
                                "effects" in x
                                  ? {
                                      ...x,
                                      effects: (x as Weapon).effects.map(
                                        (e) => ({
                                          ...e,
                                          sourceId: x.characterId,
                                        }),
                                      ),
                                    }
                                  : x,
                              ),
                            };
                          })
                        }
                      />
                    </Field>
                  </div>
                  {weapon && (
                    <>
                      <Field label="武器简写" hint="用于队伍命名，1 指专武">
                        <input
                          value={(item as Weapon).short}
                          placeholder="1 / 5 / 0精5狼末 / 0精5极霸剑"
                          onChange={(e) =>
                            patch({ short: e.target.value } as Partial<Weapon>)
                          }
                        />
                      </Field>
                      <div className="form-grid two">
                        <Field label="金数">
                          <Num
                            min={0}
                            value={(item as Weapon).gold}
                            onChange={(gold) =>
                              patch({ gold } as Partial<Weapon>)
                            }
                          />
                        </Field>
                        <Field label="限定金数">
                          <Num
                            min={0}
                            value={(item as Weapon).limitedGold}
                            onChange={(limitedGold) =>
                              patch({ limitedGold } as Partial<Weapon>)
                            }
                          />
                        </Field>
                      </div>
                      <Field label="武器基础攻击力">
                        <Num
                          min={0}
                          value={(item as Weapon).atk}
                          onChange={(atk) => patch({ atk } as Partial<Weapon>)}
                        />
                      </Field>
                    </>
                  )}
                  {!weapon && (
                    <MainStatEditor
                      value={item as Artifact}
                      onChange={(next) => patch(next as Partial<Artifact>)}
                    />
                  )}
                  <SubstatEditor
                    weapon={weapon}
                    value={item.substats}
                    onChange={(substats) => patch({ substats })}
                    max={weapon ? 1 : undefined}
                  />
                  <EffectsList
                    allowGlobal
                    title={weapon ? "武器效果" : "套装效果"}
                    sourceType={weapon ? "武器" : "圣遗物"}
                    ownerName={item.name}
                    value={item.effects}
                    onChange={(effects) =>
                      patch({ effects } as Partial<Weapon>)
                    }
                    characters={p.characters}
                    sourceId={item.characterId}
                  />
                </div>
              </div>
            );
          })}
      </div>
      <div className="info-strip">
        <Sparkles size={16} />
        <span>
          {weapon
            ? "武器最多添加1条副词条；切换装备角色时武器互换。全局效果始终参与伤害计算，不通过时间轴触发，其他效果通过时间轴「触发效果」安排。"
            : "1.9条元素精通 = 38点元素精通。全局效果始终参与伤害计算，不通过时间轴触发，其他效果通过时间轴「触发效果」安排。"}
        </span>
      </div>
    </>
  );
}
export function SkillForm({
  value,
  onChange,
  characters,
}: {
  value: Skill;
  onChange: (s: Skill) => void;
  characters: Character[];
}) {
  function patch(patch: Partial<Skill>) {
    onChange({ ...value, ...patch });
  }
  return (
    <div className="skill-form">
      <div className="form-grid two">
        <Field label="技能名称">
          <input
            value={value.name}
            placeholder="例如：木偶E"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="所属角色">
          <CharacterSelect
            characters={characters}
            value={value.characterId}
            onChange={(characterId) =>
              patch({
                characterId,
                name:
                  !value.name ||
                  value.name ===
                    characters.find((c) => c.id === value.characterId)?.name
                    ? (characters.find((c) => c.id === characterId)?.name ?? "")
                    : value.name,
                effects: value.effects.map((e) => ({
                  ...e,
                  sourceId: characterId,
                })),
              })
            }
          />
        </Field>
      </div>
      <div className="segmented skill-type-tabs">
        <button
          className={value.kind === "damage" ? "active" : ""}
          onClick={() => patch({ kind: "damage" })}
        >
          <Swords size={16} />
          造成伤害
        </button>
        <button
          className={value.kind === "effect" ? "active" : ""}
          onClick={() => patch({ kind: "effect" })}
        >
          <Sparkles size={16} />
          提供效果
        </button>
        <button
          className={value.kind === "empty" ? "active" : ""}
          onClick={() => patch({ kind: "empty" })}
        >
          <MessageSquare size={16} />
          不造成伤害
        </button>
      </div>
      {value.kind === "damage" ? (
        <>
          <DamageEditor
            value={value.damage}
            onChange={(damage) => patch({ damage })}
          />
          <div className="form-grid two">
            <Field label="依赖属性取值">
              <select
                value={value.scalingMode}
                onChange={(e) =>
                  patch({ scalingMode: e.target.value as Skill["scalingMode"] })
                }
              >
                {(["base", "outside", "live"] as const).map((m) => (
                  <option value={m} key={m}>
                    {VALUE_MODES[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="技能倍率" hint="自动添加百分号">
              <Num
                min={0}
                value={value.multiplier}
                onChange={(multiplier) => patch({ multiplier })}
                unit="%"
              />
            </Field>
          </div>
          {value.damage.special ? (
            <p className="input-note">
              此技能按星月直伤公式计算。星月基础提升、专属增伤、额外提升及擢升统一来自生效效果；擢升百分数求和后使用
              1 +
              总和。星超导层数只在时间轴逐事件填写，再按表换算系数。仅依赖属性使用上方取值方式，精通与暴击读取实时面板。
            </p>
          ) : (
            <p className="input-note">
              常规直伤：（基础伤害 + 基础值加成）× 基础增伤系数 × 抗性系数 ×
              防御系数 × 暴击区 ×
              独立乘区；普通火/水/冰伤害可在时间轴逐事件勾选蒸发或融化，不自动判断元素附着。
            </p>
          )}
        </>
      ) : (
        <>
          <EffectsList
            sourceType="技能"
            ownerSkillId={value.id}
            ownerName={value.name}
            value={value.effects}
            onChange={(effects) => patch({ effects })}
            characters={characters}
            sourceId={value.characterId}
          />
          {value.kind === "empty" && (
            <p className="input-note">
              此技能不造成伤害，计入DPS统计时长，并触发技能绑定的效果。
            </p>
          )}
        </>
      )}
    </div>
  );
}
export function Skills({
  project: p,
  update,
  remove,
  draft,
  setDraft,
}: {
  project: Project;
  update: Update;
  remove: (s: Skill) => void;
  draft: Skill | null;
  setDraft: (s: Skill | null) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  function add() {
    if (!draft) {
      setDraft({ ...skill(p.characters[0].id), name: p.characters[0].name });
      setTimeout(
        () =>
          document
            .getElementById("new-skill")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50,
      );
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="03 / SKILLS"
        title="技能与动作"
        description="按角色组织技能，定义伤害类型、倍率与提供的效果。"
      >
        <button className="btn primary" onClick={add} disabled={!!draft}>
          <Plus size={17} />
          添加技能
        </button>
      </SectionTitle>
      {!p.skills.length && !draft && (
        <div className="panel">
          <Empty
            icon={<Swords size={28} />}
            title="从第一个技能开始"
            detail="添加角色的普攻、重击、战技、大招，或一个提供效果的技能。"
            action={
              <button className="btn" onClick={add}>
                <Plus size={16} />
                添加技能
              </button>
            }
          />
        </div>
      )}
      {p.characters.map((c, index) => {
        const items = p.skills.filter((s) => s.characterId === c.id);
        if (!items.length) return null;
        return (
          <div className="skill-group" key={c.id}>
            <div className="group-header">
              <Avatar small character={c} index={index} />
              <h3>{charName(c, index)}</h3>
              <span>{items.length} 个技能</span>
              <div />
            </div>
            {items.map((s, i) => (
              <div className="panel skill-card" key={s.id}>
                <div className="skill-card-header">
                  <span className={`skill-kind-icon skill-kind-${s.kind}`}>
                    {s.kind === "empty" ? (
                      <MessageSquare size={18} />
                    ) : s.kind === "effect" ? (
                      <Sparkles size={18} />
                    ) : (
                      <Swords size={18} />
                    )}
                  </span>
                  <button
                    className="skill-label"
                    onClick={() => setEditing(editing === s.id ? null : s.id)}
                  >
                    <strong>{s.name || "未命名技能"}</strong>
                    <span>
                      {s.kind === "damage"
                        ? `${s.damage.element} · ${s.damage.attack} · ${s.damage.scaling}乘区${s.damage.special ? ` · ${s.damage.special}` : ""}`
                        : s.kind === "effect"
                          ? `提供效果 · ${s.effects.length} 条`
                          : "不造成伤害 · 可触发效果"}
                    </span>
                  </button>
                  <strong className="multiplier">
                    {s.kind === "damage"
                      ? `${s.multiplier}%`
                      : s.kind === "effect"
                        ? "效果"
                        : "—"}
                  </strong>
                  <div className="button-group">
                    <button
                      className="icon-btn"
                      aria-label="技能上移"
                      disabled={i === 0}
                      onClick={() => update((p) => moveSkill(p, s.id, -1))}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="技能下移"
                      disabled={i === items.length - 1}
                      onClick={() => update((p) => moveSkill(p, s.id, 1))}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`删除技能 ${s.name || "未命名技能"}`}
                      onClick={() => remove(s)}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`编辑技能 ${s.name || "未命名技能"}`}
                      onClick={() => setEditing(editing === s.id ? null : s.id)}
                    >
                      <ChevronDown size={17} />
                    </button>
                  </div>
                </div>
                {editing === s.id && (
                  <div className="panel-body">
                    <SkillForm
                      value={s}
                      characters={p.characters}
                      onChange={(next) =>
                        update((p) => ({
                          ...p,
                          skills: p.skills.map((x) =>
                            x.id === s.id ? next : x,
                          ),
                        }))
                      }
                    />
                    <div className="form-actions">
                      <button
                        className="btn primary small-btn"
                        onClick={() => setEditing(null)}
                      >
                        <Check size={15} />
                        完成编辑
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {draft && (
        <div className="panel draft-card" id="new-skill">
          <div className="panel-header">
            <div>
              <h3>新增技能</h3>
              <p>完成编辑后，将自动归入对应角色。</p>
            </div>
            <span className="soft-badge">草稿</span>
          </div>
          <div className="panel-body">
            <SkillForm
              value={draft}
              onChange={setDraft}
              characters={p.characters}
            />
            <div className="form-actions">
              <button className="btn" onClick={() => setDraft(null)}>
                取消
              </button>
              <button
                className="btn primary"
                disabled={
                  !draft.name.trim() ||
                  (draft.kind === "effect" &&
                    (!draft.effects.length ||
                      draft.effects.some(
                        (e) => !effectTargetValid(e) || !!effectFormulaError(e),
                      )))
                }
                onClick={() => {
                  update((p) => ({ ...p, skills: [...p.skills, draft] }));
                  setDraft(null);
                }}
              >
                <Check size={16} />
                完成编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
