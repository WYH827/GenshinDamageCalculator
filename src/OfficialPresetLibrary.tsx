import { useEffect, useRef, useState } from "react";
import {
  loadOfficialIndex,
  loadOfficialPreset,
  PRESET_FOLDERS,
  type OfficialPresetKind,
  type OfficialPresetEntry,
} from "./official-presets";
import { SITE } from "./site-config";
export default function OfficialPresetLibrary({
  kind,
  onApply,
}: {
  kind: OfficialPresetKind;
  onApply: (value: Awaited<ReturnType<typeof loadOfficialPreset>>) => void;
}) {
  const [entries, setEntries] = useState<OfficialPresetEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [preview, setPreview] = useState<Awaited<
      ReturnType<typeof loadOfficialPreset>
    > | null>(null),
    [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPreview(null);
    setSelected("");
    setBusy(false);
    request.current?.abort();
    loadOfficialIndex(controller.signal)
      .then((data) => setEntries(data.presets.filter((e) => e.kind === kind)))
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [kind, retry]);
  const pick = async (entry: OfficialPresetEntry) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSelected(entry.id);
    setPreview(null);
    setBusy(true);
    setError("");
    try {
      const data = await loadOfficialPreset(entry, controller.signal);
      if (!controller.signal.aborted) setPreview(data);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className="official-library">
      <p className="input-note">
        官方预设库 · {PRESET_FOLDERS[kind]}
        。预览后点击应用；所有条目均随审核合并后更新。
      </p>
      <label className="field">
        <span className="field-label">搜索官方预设</span>
        <input
          aria-label="搜索官方预设"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="名称、作者或描述"
        />
      </label>
      {loading ? (
        <p role="status">正在读取官方预设库…</p>
      ) : entries.length === 0 ? (
        <div className="official-empty">
          <strong>此分类暂无已收录预设</strong>
          <p>欢迎通过 Pull Request 投稿，审核后将加入官方预设库。</p>
        </div>
      ) : (
        entries
          .filter((e) =>
            `${e.name} ${e.description} ${e.author}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((entry) => (
            <button
              className={`official-preset-card ${selected === entry.id ? "selected" : ""}`}
              key={entry.id}
              onClick={() => pick(entry)}
            >
              <strong>{entry.name}</strong>
              <span>{entry.description}</span>
              <small>
                {entry.author ? `作者：${entry.author}` : "社区投稿"} · 点击预览
              </small>
            </button>
          ))
      )}
      {error && (
        <p className="validation" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">正在校验预设…</p>}
      {preview && (
        <div className="official-preview">
          <h4>导入预览</h4>
          {preview.kind === "project" ? (
            <>
              <p>
                {preview.data.name} ·{" "}
                {preview.data.characters
                  .map((c) => c.name || "未命名角色")
                  .join(" / ")}
              </p>
              <p>
                {preview.data.skills.length} 个技能 ·{" "}
                {preview.data.timeline.length} 个时间轴事件
              </p>
              <p>将替换整份方案，应用前仍需确认。</p>
            </>
          ) : preview.preset.kind === "character" ? (
            <>
              <p>
                {preview.preset.data.name} · {preview.preset.data.level}级 ·{" "}
                {preview.preset.data.constellation}命
              </p>
              <p>
                基础生命 {preview.preset.data.hp} · 攻击{" "}
                {preview.preset.data.atk} · 防御 {preview.preset.data.def}
              </p>
            </>
          ) : (
            <>
              <p>
                {preview.preset.data.name} · 基础攻击力{" "}
                {preview.preset.data.atk}
              </p>
              <p>
                {preview.preset.data.substats.length} 条副词条 ·{" "}
                {preview.preset.data.effects.length} 条效果
              </p>
            </>
          )}
          <button className="btn primary" onClick={() => onApply(preview)}>
            应用官方预设
          </button>
        </div>
      )}
      <div className="official-footer">
        <button className="text-btn" onClick={() => setRetry((n) => n + 1)}>
          刷新预设库
        </button>
        <a
          href={`${SITE.repository}/tree/main/public/presets`}
          target="_blank"
          rel="noreferrer"
        >
          查看预设目录与投稿说明 ↗
        </a>
      </div>
    </div>
  );
}
