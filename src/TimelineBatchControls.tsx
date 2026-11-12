import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Field, Modal, Num } from "./components";
import ScheduleEditor from "./ScheduleEditor";
import { endTime, type Project } from "./model";
import { batchSkills, transformEvents } from "./timeline-batch";
import type { Update } from "./sections";
export default function TimelineBatchControls({
  project: p,
  update,
  selected,
  onSelection,
  selecting,
  onSelecting,
  adding,
  onAdding,
  actions,
}: {
  actions: ReactNode;
  project: Project;
  update: Update;
  selected: Set<string>;
  onSelection: (ids: Set<string>) => void;
  selecting: boolean;
  onSelecting: (v: boolean) => void;
  adding: boolean;
  onAdding: (v: boolean) => void;
}) {
  const setAdding = onAdding;
  const [skillId, setSkillId] = useState(p.skills[0]?.id ?? ""),
    [time, setTime] = useState(0),
    [interval, setInterval] = useState(1),
    [duration, setDuration] = useState<number | null>(10);
  const [action, setAction] = useState<"move" | "copy" | "delete" | null>(null),
    [mode, setMode] = useState<"before" | "after" | "at">("after"),
    [seconds, setSeconds] = useState(1),
    [error, setError] = useState("");
  useEffect(() => {
    if (adding) {
      setTime(endTime(p));
      setSkillId(p.skills[0]?.id ?? "");
      setError("");
    }
  }, [adding]);
  const count = p.timeline.filter((e) => selected.has(e.id)).length;
  const run = () => {
    try {
      const timeline = transformEvents(
        p.timeline,
        selected,
        action!,
        mode,
        seconds,
      );
      update((p) => ({ ...p, timeline }));
      setAction(null);
      onSelection(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div
        className={`timeline-batch-toolbar ${selecting ? "is-selecting" : "is-idle"}`}
      >
        {!selecting && actions}
        <button
          className={`btn ${selecting ? "primary" : ""}`}
          onClick={() => {
            onSelecting(!selecting);
            onSelection(new Set());
          }}
        >
          {selecting ? "退出多选" : "多选"}
        </button>
        {selecting && (
          <>
            <label className="infinite-toggle">
              <input
                type="checkbox"
                aria-label="全选可编辑事件"
                checked={!!p.timeline.length && count === p.timeline.length}
                onChange={(e) =>
                  onSelection(
                    new Set(
                      e.target.checked ? p.timeline.map((e) => e.id) : [],
                    ),
                  )
                }
              />
              全选
            </label>
            <span>已选 {count} 项</span>
            {(
              [
                ["move", "批量移动"],
                ["copy", "批量复制"],
                ["delete", "批量删除"],
              ] as const
            ).map(([key, label]) => (
              <button
                className={`btn small-btn ${key === "delete" ? "danger" : ""}`}
                disabled={!count}
                key={key}
                onClick={() => {
                  setAction(key);
                  setError("");
                }}
              >
                {label}
              </button>
            ))}
          </>
        )}
      </div>
      {adding && (
        <Modal title="批量添加技能事件" onClose={() => setAdding(false)}>
          <Field label="触发技能">
            <select
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
            >
              {p.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {p.characters.find((c) => c.id === s.characterId)?.name ||
                    "未命名角色"}{" "}
                  · {s.name || "未命名技能"}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid two">
            <Field label="起始时间">
              <Num
                disableWheel
                value={time}
                min={0}
                unit="s"
                onChange={setTime}
              />
            </Field>
            <Field label="每隔">
              <Num
                value={interval}
                min={0.000001}
                unit="秒"
                onChange={setInterval}
              />
            </Field>
          </div>
          <ScheduleEditor
            duration={duration}
            interval={interval}
            onChange={setDuration}
          />
          <p className="input-note">
            首次在起始时间后的一个间隔触发，包含范围终点。永久循环保存为规则，仅展开到当前时间轴结束；有限事件添加后可逐条编辑。
          </p>
          {error && <p className="validation">{error}</p>}
          <div className="form-actions">
            <button className="btn" onClick={() => setAdding(false)}>
              取消
            </button>
            <button
              className="btn primary"
              disabled={!skillId}
              onClick={() => {
                try {
                  const events = batchSkills(skillId, time, interval, duration);
                  if (!events.length)
                    throw new Error("当前范围内没有触发，请增大范围");
                  update((p) => ({
                    ...p,
                    timeline: [...p.timeline, ...events],
                  }));
                  setAdding(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              添加批量事件
            </button>
          </div>
        </Modal>
      )}
      {action && (
        <Modal
          title={
            action === "delete"
              ? "批量删除事件"
              : action === "copy"
                ? "批量复制事件"
                : "批量移动事件"
          }
          onClose={() => setAction(null)}
        >
          <p>
            已选择 {count} 项事件
            {action === "delete"
              ? "，删除时也会移除关联子事件。"
              : "，保留相互间的时间间隔。"}
          </p>
          {action !== "delete" && (
            <div className="form-grid two">
              <Field label="目标位置">
                <select
                  aria-label="目标位置"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="before">
                    {action === "copy" ? "复制到前" : "向前移动"}
                  </option>
                  <option value="after">
                    {action === "copy" ? "复制到后" : "向后移动"}
                  </option>
                  <option value="at">最早事件对齐到第</option>
                </select>
              </Field>
              <Field label="秒数">
                <Num
                  disableWheel
                  value={seconds}
                  min={0}
                  unit="秒"
                  onChange={setSeconds}
                />
              </Field>
            </div>
          )}
          {error && <p className="validation">{error}</p>}
          <div className="form-actions">
            <button className="btn" onClick={() => setAction(null)}>
              取消
            </button>
            <button
              className={`btn ${action === "delete" ? "danger" : "primary"}`}
              onClick={run}
            >
              确认
              {action === "delete"
                ? "删除"
                : action === "copy"
                  ? "复制"
                  : "移动"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
