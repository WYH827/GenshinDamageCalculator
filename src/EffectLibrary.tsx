import EnableToggle from "./EnableToggle";
import { useState } from "react";
import EffectSourceVisual from "./EffectSourceVisual";
import { Plus } from "lucide-react";
import { EffectEditor, Modal, effectSummary } from "./components";
import { SectionTitle, type Update } from "./sections";
import {
  effectCatalog,
  EFFECT_SOURCE_LABELS,
  updateCatalogEffect,
  realtimeConfig,
} from "./effect-catalog";
import {
  REALTIME_KINDS,
  effect,
  effectTargetValid,
  type Effect,
  type Project,
} from "./model";
import { effectFormulaError } from "./formulas";

export default function EffectLibrary({
  project: p,
  update,
}: {
  project: Project;
  update: Update;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Effect | null>(null);
  const [category, setCategory] = useState<"global" | "realtime">("global");
  const rows = effectCatalog(p);
  const entry = rows.find((r) => r.key === editing);
  return (
    <>
      <SectionTitle
        eyebrow="EFFECT LIBRARY"
        title="效果列表"
        description="按来源分类，分类内按角色与原条目顺序排列；此处与原位置同步编辑同一份效果。"
      >
        <button
          className="btn primary"
          onClick={() => {
            setDraft({
              ...effect(p.characters[0].id),
              category,
              realtimeKind: "fixed" as const,
              realtime: realtimeConfig(effect(p.characters[0].id)),
            });
          }}
        >
          <Plus size={16} />
          添加独立效果
        </button>
      </SectionTitle>
      <div className="segmented" role="tablist" aria-label="效果分类查看">
        {(["global", "realtime"] as const).map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={category === kind}
            aria-controls={`effect-category-${kind}`}
            className={category === kind ? "active" : ""}
            onClick={() => setCategory(kind)}
          >
            {kind === "global" ? "全局效果" : "实时效果"} ·{" "}
            {rows.filter((r) => r.automatic === (kind === "global")).length}
          </button>
        ))}
      </div>
      {[category === "global"].map((global) => (
        <section
          className="effect-category"
          key={String(global)}
          data-category={global ? "global" : "realtime"}
          id={`effect-category-${global ? "global" : "realtime"}`}
          role="tabpanel"
          aria-label={global ? "全局效果" : "实时效果"}
        >
          <h2>{global ? "全局效果" : "实时效果"}</h2>
          {Object.entries(EFFECT_SOURCE_LABELS).map(([kind, label]) => {
            const grouped = rows.filter(
              (r) => r.automatic === global && r.kind === kind,
            );
            return (
              <section className="effect-source-group" key={kind}>
                <div className="subheading">
                  <h3>{label}</h3>
                  <span className="soft-badge">{grouped.length} 条</span>
                </div>
                <div className="global-list">
                  {grouped.map((r) => (
                    <div
                      className={`panel global-card ${r.effect.enabled === false ? "is-disabled" : ""}`}
                      key={r.key}
                    >
                      <EffectSourceVisual project={p} entry={r} />
                      <div className="global-content">
                        <h3>{r.effect.name || "未命名效果"}</h3>
                        <p>{r.source}</p>
                        <p>{effectSummary(r.effect)}</p>
                      </div>
                      <span className="soft-badge">
                        {r.effect.enabled === false
                          ? "已禁用"
                          : global
                            ? "始终生效"
                            : REALTIME_KINDS[realtimeConfig(r.effect).kind]}
                      </span>
                      <EnableToggle
                        enabled={r.effect.enabled}
                        label={`效果 ${r.effect.name}`}
                        onChange={(enabled) =>
                          update((p) =>
                            updateCatalogEffect(p, r.key, {
                              ...r.effect,
                              enabled,
                            }),
                          )
                        }
                      />
                      <button
                        className="btn small-btn"
                        aria-label={`编辑汇总效果 ${r.effect.name}`}
                        onClick={() => setEditing(r.key)}
                      >
                        编辑
                      </button>
                    </div>
                  ))}
                </div>
                {!grouped.length && <p className="input-note">暂无效果</p>}
              </section>
            );
          })}
        </section>
      ))}
      {draft && (
        <Modal
          wide
          title="添加独立效果"
          subtitle="确认后才添加到效果列表。"
          onClose={() => setDraft(null)}
        >
          <EffectEditor
            value={draft}
            characters={p.characters}
            allowNoSource
            onChange={setDraft}
          />
          <div className="form-actions">
            <button className="btn" onClick={() => setDraft(null)}>
              取消
            </button>
            <button
              className="btn primary"
              disabled={
                !effectTargetValid(draft) ||
                !!effectFormulaError(draft) ||
                (draft.type === "独立乘区" &&
                  draft.valueMode === "number" &&
                  draft.value < 0)
              }
              onClick={() => {
                update((p) => ({
                  ...p,
                  customEffects: [...(p.customEffects ?? []), draft],
                }));
                setCategory(draft.category ?? "realtime");
                setDraft(null);
              }}
            >
              确认添加
            </button>
          </div>
        </Modal>
      )}
      {entry && (
        <Modal
          wide
          title={`编辑效果 · ${entry.source}`}
          subtitle="修改立即同步至原位置；时间轴仅引用此效果数值。"
          onClose={() => setEditing(null)}
        >
          <EffectEditor
            value={entry.effect}
            sourceLocked={!!entry.ownerId}
            environment={entry.kind === "global"}
            allowNoSource={entry.kind === "custom"}
            defaultName={entry.defaultName}
            characters={p.characters}
            onChange={(value) => {
              setCategory(
                value.category ?? (entry.automatic ? "global" : "realtime"),
              );
              update((p) => updateCatalogEffect(p, entry.key, value));
            }}
          />

          <div className="form-actions">
            {entry.kind === "custom" && (
              <button
                className="btn danger"
                onClick={() => {
                  update((p) => ({
                    ...p,
                    customEffects: (p.customEffects ?? []).filter(
                      (e) => e.id !== entry.effect.id,
                    ),
                    timeline: p.timeline.filter(
                      (e) =>
                        e.kind !== "effectTrigger" || e.effectKey !== entry.key,
                    ),
                  }));
                  setEditing(null);
                }}
              >
                删除独立效果及触发事件
              </button>
            )}
            <button className="btn primary" onClick={() => setEditing(null)}>
              完成编辑
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
