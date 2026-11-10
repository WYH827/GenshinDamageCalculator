import { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
} from "lucide-react";
import { Avatar, SectionTitle, type Update } from "./sections";
import { CharacterSelect, EffectsList, Field, Num } from "./components";
import { ELEMENTS, charName, uid, type Project, type Talent } from "./model";

export function Talents({
  project: p,
  update,
  remove,
}: {
  project: Project;
  update: Update;
  remove: (t: Talent) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Talent | null>(null);
  const form = (t: Talent, patch: (v: Partial<Talent>) => void) => (
    <>
      <div className="form-grid two">
        <Field label="天赋名称">
          <input
            value={t.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="所属角色">
          <CharacterSelect
            value={t.characterId}
            characters={p.characters}
            onChange={(characterId) =>
              patch({
                characterId,
                effects: t.effects.map((e) => ({
                  ...e,
                  sourceId: characterId,
                })),
              })
            }
          />
        </Field>
      </div>
      <EffectsList
        allowGlobal
        title="天赋效果"
        sourceType="天赋"
        ownerName={t.name}
        value={t.effects}
        onChange={(effects) => patch({ effects })}
        sourceId={t.characterId}
        characters={p.characters}
      />
    </>
  );
  const move = (id: string, neighbor: string) =>
    update((p) => {
      const talents = [...p.talents],
        a = talents.findIndex((t) => t.id === id),
        b = talents.findIndex((t) => t.id === neighbor);
      [talents[a], talents[b]] = [talents[b], talents[a]];
      return { ...p, talents };
    });
  return (
    <>
      <SectionTitle
        eyebrow="05 / TALENTS"
        title="角色天赋"
        description="按角色分组，展开编辑；新增天赋完成后归入对应角色。"
      >
        <button
          className="btn primary"
          disabled={!!draft}
          onClick={() =>
            setDraft({
              id: uid(),
              name: "",
              characterId: p.characters[0].id,
              effects: [],
            })
          }
        >
          <Plus size={16} />
          添加天赋
        </button>
      </SectionTitle>
      {p.characters.map((c, index) => {
        const items = p.talents.filter((t) => t.characterId === c.id);
        if (!items.length) return null;
        return (
          <div className="skill-group talent-group" key={c.id}>
            <div className="group-header">
              <Avatar small character={c} index={index} />
              <h3>{charName(c, index)}</h3>
              <span>{items.length} 个天赋</span>
              <div />
            </div>
            {items.map((t, i) => (
              <div className="panel skill-card talent-panel" key={t.id}>
                <div className="skill-card-header">
                  <button
                    className="skill-label"
                    onClick={() => setEditing(editing === t.id ? null : t.id)}
                  >
                    <strong>{t.name || "未命名天赋"}</strong>
                    <span>提供效果 · {t.effects.length} 条</span>
                  </button>
                  <div className="button-group">
                    <button
                      className="icon-btn"
                      aria-label="天赋上移"
                      disabled={i === 0}
                      onClick={() => move(t.id, items[i - 1].id)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="天赋下移"
                      disabled={i === items.length - 1}
                      onClick={() => move(t.id, items[i + 1].id)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`删除天赋 ${t.name || "未命名"}`}
                      onClick={() => remove(t)}
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`编辑天赋 ${t.name || "未命名"}`}
                      onClick={() => setEditing(editing === t.id ? null : t.id)}
                    >
                      <ChevronDown size={17} />
                    </button>
                  </div>
                </div>
                {editing === t.id && (
                  <div className="panel-body">
                    {form(t, (patch) =>
                      update((p) => ({
                        ...p,
                        talents: p.talents.map((x) =>
                          x.id === t.id ? { ...x, ...patch } : x,
                        ),
                      })),
                    )}
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
      {!p.talents.length && !draft && (
        <p className="info-strip">暂无天赋，点击添加后配置效果。</p>
      )}
      {draft && (
        <div className="panel draft-card talent-draft">
          <div className="panel-header">
            <h3>新增天赋</h3>
            <span className="soft-badge">草稿</span>
          </div>
          <div className="panel-body">
            {form(draft, (patch) => setDraft({ ...draft, ...patch }))}
            <div className="form-actions">
              <button className="btn" onClick={() => setDraft(null)}>
                取消
              </button>
              <button
                className="btn primary"
                disabled={!draft.name.trim()}
                onClick={() => {
                  update((p) => ({ ...p, talents: [...p.talents, draft] }));
                  setDraft(null);
                }}
              >
                完成编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EnemySection({
  project: p,
  update,
}: {
  project: Project;
  update: Update;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="07 / ENEMY"
        title="敌方属性"
        description="配置直伤计算使用的目标等级与各元素、物理抗性。"
      />
      <div className="panel enemy-panel">
        <div className="panel-body">
          <div className="form-grid three">
            <Field label="怪物等级" hint="非负数">
              <Num
                min={0}
                value={p.enemy.level}
                onChange={(level) =>
                  update((p) => ({ ...p, enemy: { ...p.enemy, level } }))
                }
              />
            </Field>
          </div>
          <div className="form-section-title separated">
            <span>伤害抗性</span>
            <span>RESISTANCE</span>
          </div>
          <div className="form-grid four">
            {ELEMENTS.map((el) => (
              <Field
                key={el}
                label={`${el}${el === "物理" ? "伤害" : "元素"}抗性`}
              >
                <Num
                  unit="%"
                  value={p.enemy.resistance[el]}
                  onChange={(value) =>
                    update((p) => ({
                      ...p,
                      enemy: {
                        ...p.enemy,
                        resistance: { ...p.enemy.resistance, [el]: value },
                      },
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <p className="input-note">
            抗性默认均为
            10%，支持负值。怪物等级与抗性独立保存；改变等级不会自动改写抗性。
          </p>
        </div>
      </div>
    </>
  );
}
