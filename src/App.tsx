import authorAvatar from "./assets/author.jpg";
const InformationDialogs = lazy(() => import("./InformationDialogsEntry"));
import { SkillOptionsContext } from "./SkillOptionsContext";
import { useCalculation } from "./useCalculation";
import { Talents, EnemySection } from "./additional-sections";
import { globalEffects } from "./effect-state";
import {
  effectCatalog,
  upgradeRealtimeProject,
  environmentEffect,
  removeGlobalTriggers,
  isGlobalEffect,
} from "./effect-catalog";
import EffectLibrary from "./EffectLibrary";
import { syncEffectNames } from "./effect-names";
import TimelineSection from "./TimelineSection";
import { effectFormulaError } from "./formulas";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
const QuickImport = lazy(() => import("./QuickImport"));
const OfficialPresetLibrary = lazy(() => import("./OfficialPresetLibrary"));
import {
  Activity,
  ArrowDownToLine,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Download,
  FileJson,
  FolderOpen,
  Gem,
  Leaf,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  Characters,
  Equipment,
  Skills,
  SectionTitle,
  type Update,
} from "./sections";
import {
  EffectEditor,
  EffectFold,
  Empty,
  Field,
  Modal,
  effectSummary,
} from "./components";
import {
  PRESETS_KEY,
  RESET_BACKUP_KEY,
  STORAGE_KEY,
  deleteSkill,
  effect,
  endTime,
  fmt,
  newProject,
  normalizeAmplification,
  resultTeamName,
  effectTargetValid,
  deleteTalent,
  uid,
  type Effect,
  type Preset,
  type Project,
  type Skill,
} from "./model";
import Results from "./results";
import { teamCosts } from "./model";
import {
  applyCharacterPreset,
  applyWeaponPreset,
  downloadJson,
  parsePreset,
  parsePresets,
  parseProject,
  readJson,
} from "./storage";

const TABS = [
  { id: "characters", label: "角色", sub: "CHARACTERS", icon: Users },
  { id: "weapons", label: "武器", sub: "WEAPONS", icon: Swords },
  { id: "skills", label: "技能", sub: "SKILLS", icon: Crosshair },
  { id: "artifacts", label: "圣遗物", sub: "ARTIFACTS", icon: Gem },
  { id: "talents", label: "天赋/命座", sub: "TALENTS", icon: Leaf },
  { id: "globals", label: "环境/元素共鸣", sub: "ENVIRONMENT", icon: Sparkles },
  { id: "effects", label: "效果列表", sub: "EFFECT LIBRARY", icon: Sparkles },
  { id: "enemy", label: "敌方属性", sub: "ENEMY", icon: Crosshair },
  { id: "timeline", label: "时间轴", sub: "TIMELINE", icon: Clock3 },
  { id: "results", label: "计算结果", sub: "RESULTS", icon: Activity },
] as const;
type Tab = (typeof TABS)[number]["id"];
type Confirm = { title: string; detail: string; action: () => void };
type EffectDialog = { value: Effect; existing: boolean };

type PresetDialog = {
  kind: "character" | "weapon";
  id: string;
  mode: "save" | "load";
  name: string;
};
function initialProject(): { project: Project; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      project: raw
        ? upgradeRealtimeProject(parseProject(JSON.parse(raw)))
        : newProject(),
      error: "",
    };
  } catch {
    return {
      project: newProject(),
      error: "本地方案读取失败。原始数据尚未覆盖，可导出恢复文件后重新开始。",
    };
  }
}
function initialPresets(): { data: Preset[]; error: boolean } {
  try {
    return {
      data: parsePresets(JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]")),
      error: false,
    };
  } catch {
    return { data: [], error: true };
  }
}

export default function App() {
  const [initial] = useState(initialProject),
    [initialLibrary] = useState(initialPresets);
  const [project, setProject] = useState(initial.project);
  const calculation = useCalculation(project);
  const [tab, setTab] = useState<Tab>("characters");
  const [presets, setPresets] = useState(initialLibrary.data);
  const [presetDialog, setPresetDialog] = useState<PresetDialog | null>(null);
  const [effectDialog, setEffectDialog] = useState<EffectDialog | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [quickImportOpen, setQuickImportOpen] = useState(false);
  const [officialProject, setOfficialProject] = useState(false);
  const [presetSource, setPresetSource] = useState<"local" | "official">(
    "local",
  );
  const [help, setHelp] = useState(false);
  const [about, setAbout] = useState(false);
  const [toast, setToast] = useState("");
  const [saveError, setSaveError] = useState(initial.error);
  const [libraryError] = useState(initialLibrary.error);
  const [saved, setSaved] = useState(!initial.error);
  const [draft, setDraft] = useState<Skill | null>(null);
  const [recovering, setRecovering] = useState(!!initial.error);
  const projectInput = useRef<HTMLInputElement>(null),
    presetInput = useRef<HTMLInputElement>(null);
  const update: Update = (fn) =>
    setProject((p) =>
      normalizeAmplification(
        syncEffectNames(removeGlobalTriggers(upgradeRealtimeProject(fn(p)))),
      ),
    );
  function resetProject(saveFirst: boolean) {
    try {
      if (saveFirst) {
        // Keep a separate backup before requesting a browser download, so a
        // canceled file-save dialog cannot erase the only copy of the project.
        localStorage.setItem(RESET_BACKUP_KEY, JSON.stringify(project));
        downloadJson(project, `${project.name || "未命名方案"}.json`);
      }
      const next = newProject();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      calculation.clear();
      setProject(next);
      setDraft(null);
      setEffectDialog(null);
      setPresetDialog(null);
      setConfirm(null);
      setRecovering(false);
      setSaveError("");
      setResetOpen(false);
      setTab("characters");
      setToast(
        saveFirst
          ? "已发起方案下载，并保留重置前备份；空白方案已创建"
          : "方案已重置，预设库已保留",
      );
    } catch {
      setToast("无法完成保存或重置，当前方案已保留。请先手动导出方案。");
    }
  }
  useEffect(() => {
    if (recovering) return;
    setSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        setSaved(true);
        setSaveError("");
      } catch {
        setSaveError("无法保存到浏览器，请导出方案以保留本次修改。");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [project, recovering]);
  useEffect(() => {
    const persist = () => {
      if (!recovering) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        } catch {
          /* The UI already exposes export as the recovery path. */
        }
      }
    };
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [project, recovering]);
  useEffect(() => {
    if (libraryError) return;
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      setToast("预设库保存失败，请导出预设文件。");
    }
  }, [presets, libraryError]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function openPreset(
    kind: PresetDialog["kind"],
    id: string,
    mode: PresetDialog["mode"],
  ) {
    const item =
      kind === "character"
        ? project.characters.find((c) => c.id === id)!
        : project.weapons.find((w) => w.id === id)!;
    setPresetSource("local");
    setPresetDialog({ kind, id, mode, name: item.name });
  }
  function savePreset() {
    if (!presetDialog) return;
    const { kind, id, name } = presetDialog;
    const preset: Preset =
      kind === "character"
        ? {
            id: uid(),
            kind,
            name: name.trim(),
            data: structuredClone(project.characters.find((c) => c.id === id)!),
          }
        : {
            id: uid(),
            kind,
            name: name.trim(),
            data: structuredClone(project.weapons.find((w) => w.id === id)!),
          };
    setPresets((p) => [...p, preset]);
    setPresetDialog(null);
    setToast("预设已保存到本地预设库");
  }
  function loadPreset(preset: Preset) {
    if (!presetDialog || preset.kind !== presetDialog.kind) {
      setToast("预设类型不匹配，请选择对应的角色或武器预设。");
      return;
    }
    const targetId = presetDialog.id;
    update((p) =>
      preset.kind === "character"
        ? {
            ...p,
            characters: p.characters.map((c) =>
              c.id === targetId ? applyCharacterPreset(preset.data, c) : c,
            ),
          }
        : {
            ...p,
            weapons: p.weapons.map((w) =>
              w.id === targetId
                ? applyWeaponPreset(preset.data, w, p.characters)
                : w,
            ),
          },
    );
    setPresetDialog(null);
    setToast(`已应用预设「${preset.name}」`);
  }
  function editEffect(value: Effect) {
    setEffectDialog({ value: structuredClone(value), existing: true });
  }
  function addEffect() {
    setEffectDialog({
      value: {
        ...effect(project.characters[0].id, true),
        sourceId: "",
        category: "global",
      },
      existing: false,
    });
  }
  function saveEffect() {
    if (!effectDialog) return;
    const { existing } = effectDialog;
    const value = environmentEffect(effectDialog.value);
    update((p) => ({
      ...p,
      globals: existing
        ? p.globals.map((e) => (e.id === value.id ? value : e))
        : [...p.globals, value],
    }));
    setEffectDialog(null);
  }
  function removeSkill(s: Skill) {
    const references = project.timeline.filter(
      (e) => e.kind === "skill" && e.skillId === s.id,
    ).length;
    setConfirm({
      title: `删除「${s.name || "未命名技能"}」？`,
      detail: references
        ? `时间轴中引用该技能的 ${references} 个事件也将一并删除。`
        : "该技能会从当前方案移除。",
      action: () => {
        update((p) => deleteSkill(p, s.id));
      },
    });
  }
  const configured = project.characters.filter((c) => c.name.trim()).length;
  const totals = {
    ...teamCosts(project),
    stars: project.characters.reduce((s, c) => s + c.stars, 0),
  };
  const automaticEffects = globalEffects(project);
  const eventCount = project.timeline.length + automaticEffects.length;
  const navCounts: Record<Tab, string> = {
    characters: "04",
    weapons: "04",
    skills: String(project.skills.length).padStart(2, "0"),
    artifacts: "04",
    talents: String(project.talents.length).padStart(2, "0"),
    enemy: "01",
    effects: String(effectCatalog(project).length).padStart(2, "0"),
    globals: String(project.globals.length).padStart(2, "0"),
    timeline: String(eventCount).padStart(2, "0"),
    results: "—",
  };
  function body(): ReactNode {
    switch (tab) {
      case "characters":
        return (
          <Characters project={project} update={update} preset={openPreset} />
        );
      case "weapons":
      case "artifacts":
        return (
          <Equipment
            kind={tab}
            project={project}
            update={update}
            preset={openPreset}
          />
        );
      case "skills":
        return (
          <Skills
            project={project}
            update={update}
            remove={removeSkill}
            draft={draft}
            setDraft={setDraft}
          />
        );
      case "enemy":
        return <EnemySection project={project} update={update} />;
      case "talents":
        return (
          <Talents
            project={project}
            update={update}
            remove={(t) =>
              setConfirm({
                title: `删除天赋/命座「${t.name || "未命名"}」？`,
                detail: "引用该天赋/命座的触发事件也将一并删除。",
                action: () => update((p) => deleteTalent(p, t.id)),
              })
            }
          />
        );
      case "globals":
        return (
          <>
            <SectionTitle
              eyebrow="05 / GLOBAL EFFECTS"
              title="环境/元素共鸣"
              description="环境与元素共鸣没有触发者；选择全局或实时效果后设置对象与数值。"
            >
              <button className="btn primary" onClick={() => addEffect()}>
                <Plus size={17} />
                添加环境/共鸣效果
              </button>
            </SectionTitle>
            <div className="info-strip">
              <Clock3 size={17} />
              <span>
                所有全局效果会自动出现在时间轴的 <strong>0.00s</strong>
                ，并以灰色标记。
              </span>
            </div>
            {!project.globals.length ? (
              <div className="panel">
                <Empty
                  icon={<Sparkles size={28} />}
                  title="让队伍的加成在这里汇合"
                  detail="添加队伍增益或敌方抗性变化；角色天赋/命座请在独立天赋/命座板块配置。"
                  action={
                    <button className="btn" onClick={() => addEffect()}>
                      <Plus size={16} />
                      添加环境/共鸣效果
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="global-list">
                {project.globals.map((e) => (
                  <EffectFold
                    defaultOpen
                    key={e.id}
                    title={e.name || "未命名效果"}
                  >
                    <div className="panel global-card">
                      <div className="effect-mark">
                        <Sparkles size={20} />
                      </div>
                      <div className="global-content">
                        <h3>{e.name || "未命名效果"}</h3>
                        <p>{effectSummary(e)}</p>
                        <span>
                          环境/元素共鸣 ·{" "}
                          {isGlobalEffect(e, true) ? "全局效果" : "实时效果"}
                        </span>
                      </div>
                      <span className="soft-badge">
                        {isGlobalEffect(e, true) ? "始终生效" : "时间轴触发"}
                      </span>
                      <button
                        className="icon-btn"
                        aria-label={`编辑效果 ${e.name}`}
                        onClick={() => editEffect(e)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`删除效果 ${e.name}`}
                        onClick={() =>
                          setConfirm({
                            title: "删除环境/共鸣效果？",
                            detail: "时间轴中对应的起始效果也会同步移除。",
                            action: () =>
                              update((p) => ({
                                ...p,
                                globals: p.globals.filter((x) => x.id !== e.id),
                                timeline: p.timeline.filter(
                                  (x) =>
                                    x.kind !== "effectTrigger" ||
                                    x.effectKey !== `global-${e.id}`,
                                ),
                              })),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </EffectFold>
                ))}
              </div>
            )}
          </>
        );
      case "effects":
        return <EffectLibrary project={project} update={update} />;
      case "timeline":
        return (
          <TimelineSection
            project={project}
            update={update}
            openLibrary={() => setTab("effects")}
          />
        );
      case "results":
        return <Results project={project} controller={calculation} />;
    }
  }
  return (
    <SkillOptionsContext.Provider value={project.skills}>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              setTab("characters");
            }}
          >
            <span className="brand-symbol">
              <Sparkles size={25} strokeWidth={1.5} />
            </span>
            <span>
              提瓦特<span>DAMAGE STUDIO</span>
            </span>
          </a>
          <div className="workspace-label">
            使用说明 <span>GUIDE</span>
          </div>
          <button className="workspace-select" onClick={() => setHelp(true)}>
            <span className="workspace-icon">
              <BookOpen size={17} />
            </span>
            <span>
              使用说明<small>配置 · 编排 · 计算</small>
            </span>
            <ChevronRight size={14} />
          </button>
          <div className="nav-label">方案配置</div>
          <nav>
            {TABS.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? "active" : ""} ${item.id === "timeline" ? "nav-break" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={18} strokeWidth={1.7} />
                <span>{item.label}</span>
                <small>{navCounts[item.id]}</small>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="about-author-btn"
              aria-label="关于&作者"
              onClick={() => setAbout(true)}
            >
              <img src={authorAvatar} alt="" />
              <span>
                关于&amp;作者<small>WYH827 · 项目与使用协议</small>
              </span>
              <ChevronRight size={14} />
            </button>
            <div className="local-note">
              <span className="green-dot" />
              数据保存在当前浏览器
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>使用说明</span>
              <ChevronRight size={13} />
              <strong>伤害工作台</strong>
            </div>
            <div className="topbar-right">
              <span className={`save-state ${saveError ? "error" : ""}`}>
                {saveError ? (
                  <CircleHelp size={14} />
                ) : (
                  <CheckCheck size={15} />
                )}
                {saveError ? "保存异常" : saved ? "已自动保存" : "正在保存…"}
              </span>
              <span className="top-divider" />
              <button
                className="btn small-btn topbar-help"
                onClick={() => setHelp(true)}
              >
                <BookOpen size={14} />
                使用说明
              </button>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">TEYVAT THEORYCRAFTING</div>
                <div className="project-title">
                  <input
                    aria-label="方案名称"
                    value={project.name}
                    onChange={(e) =>
                      update((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <Pencil size={16} />
                </div>
                <p>构筑队伍，编排时间，让每一份伤害有迹可循。</p>
              </div>
              <div className="page-actions">
                <button
                  className="btn"
                  onClick={() => setQuickImportOpen(true)}
                >
                  <Upload size={16} />
                  快速导入
                </button>
                <button className="btn" onClick={() => setResetOpen(true)}>
                  <Trash2 size={16} />
                  重置方案
                </button>
                <input
                  ref={projectInput}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  aria-label="导入方案文件"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const next = upgradeRealtimeProject(
                        parseProject(await readJson(file)),
                      );
                      setConfirm({
                        title: "导入这份方案？",
                        detail: `「${next.name || "未命名方案"}」包含 ${next.characters.filter((c) => c.name).length} 位已配置角色、${next.skills.length} 个技能与 ${next.timeline.length} 个时间轴事件。导入将替换当前方案，请先导出需要保留的内容。`,
                        action: () => {
                          setProject(next);
                          setDraft(null);
                          setRecovering(false);
                          setToast("方案已导入");
                        },
                      });
                    } catch {
                      setToast(
                        "导入失败：文件不是有效的方案 JSON，或存在无效字段与引用。当前方案已保留。",
                      );
                    }
                  }}
                />
                <button
                  className="btn"
                  onClick={() => projectInput.current?.click()}
                >
                  <Upload size={16} />
                  导入方案
                </button>
                <button
                  className="btn"
                  onClick={() => setOfficialProject(true)}
                >
                  <FolderOpen size={16} />
                  从官方预设库导入
                </button>
                <button
                  className="btn dark"
                  onClick={() => {
                    downloadJson(
                      project,
                      `${project.name || "未命名方案"}.json`,
                    );
                    setToast("方案已导出");
                  }}
                >
                  <Download size={16} />
                  导出方案
                </button>
              </div>
            </div>
            {saveError && (
              <div className="error-banner">
                <CircleHelp size={18} />
                <span>{saveError}</span>
                {recovering && (
                  <>
                    <button
                      className="text-btn"
                      onClick={() =>
                        downloadJson(
                          { raw: localStorage.getItem(STORAGE_KEY) },
                          "方案恢复数据.json",
                        )
                      }
                    >
                      导出恢复文件
                    </button>
                    <button
                      className="text-btn"
                      onClick={() =>
                        setConfirm({
                          title: "重新开始？",
                          detail:
                            "将用当前方案覆盖无法读取的本地数据，请先导出恢复文件。",
                          action: () => setRecovering(false),
                        })
                      }
                    >
                      重新开始
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="summary-bar">
              <div className="summary-team">
                <span className="summary-icon">
                  <Users size={21} />
                </span>
                <div>
                  <span>当前队伍</span>
                  <strong>{resultTeamName(project)}</strong>
                </div>
              </div>
              <div className="summary-metric">
                <span>角色</span>
                <strong>
                  {configured}
                  <small>/ 4</small>
                </strong>
              </div>
              <div className="summary-metric">
                <span>队伍金数</span>
                <strong>
                  {fmt(totals.gold)}
                  <small>金</small>
                </strong>
              </div>
              <div className="summary-metric">
                <span>限定金数</span>
                <strong>
                  {fmt(totals.limitedGold)}
                  <small>金</small>
                </strong>
              </div>
              <div className="summary-metric">
                <span>时间轴</span>
                <strong>
                  {endTime(project).toFixed(2)}
                  <small>s</small>
                </strong>
              </div>
              <span className="summary-decoration">
                <Sparkles size={40} strokeWidth={0.65} />
              </span>
            </div>
            <div className="section-content" key={tab}>
              {body()}
            </div>
            <footer className="main-footer">
              <span>
                <Sparkles size={12} /> 提瓦特伤害工作台
              </span>
              <span>每一种构筑，都值得探索。</span>
              <span>本地编辑 · 自由构筑</span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            <span>{toast}</span>
            <button
              className="icon-btn"
              onClick={() => setToast("")}
              aria-label="关闭提示"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {quickImportOpen && (
          <Suspense
            fallback={
              <Modal title="快速导入" onClose={() => setQuickImportOpen(false)}>
                正在加载导入工具…
              </Modal>
            }
          >
            <QuickImport
              project={project}
              update={update}
              onClose={() => setQuickImportOpen(false)}
              onImported={setToast}
            />
          </Suspense>
        )}
        {resetOpen && (
          <Modal
            title="重置当前方案？"
            subtitle="请选择是否先保存当前方案。"
            onClose={() => setResetOpen(false)}
          >
            <p className="confirm-detail">
              将清空当前队伍、装备、技能、天赋/命座、效果与时间轴，并恢复默认敌方属性。角色与武器预设库会保留。
            </p>
            <p className="input-note">
              “保存当前方案并重置”会先导出
              JSON，并在此浏览器保留一份重置前备份。
            </p>
            {draft && (
              <p className="validation">
                还有未完成的技能草稿；草稿不包含在方案导出中，重置会清除它。若要保留，请取消并完成技能编辑。
              </p>
            )}
            <div className="form-actions reset-actions">
              <button className="btn" onClick={() => setResetOpen(false)}>
                取消
              </button>
              <button
                className="btn primary"
                onClick={() => resetProject(true)}
              >
                <Save size={15} />
                保存当前方案并重置
              </button>
              <button
                className="btn danger-btn"
                onClick={() => resetProject(false)}
              >
                直接重置
              </button>
            </div>
            {localStorage.getItem(RESET_BACKUP_KEY) && (
              <button
                className="text-btn reset-backup"
                onClick={() => {
                  try {
                    downloadJson(
                      JSON.parse(localStorage.getItem(RESET_BACKUP_KEY)!),
                      "重置前方案备份.json",
                    );
                  } catch {
                    setToast("备份读取失败");
                  }
                }}
              >
                导出上次重置前备份
              </button>
            )}
          </Modal>
        )}
        {confirm && (
          <Modal title={confirm.title} onClose={() => setConfirm(null)}>
            <p className="confirm-detail">{confirm.detail}</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setConfirm(null)}>
                取消
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                确认
              </button>
            </div>
          </Modal>
        )}
        {officialProject && (
          <Modal
            wide
            title="官方方案预设库"
            subtitle="导入整队配置与时间轴"
            onClose={() => setOfficialProject(false)}
          >
            <Suspense fallback={<p>正在打开官方预设库…</p>}>
              <OfficialPresetLibrary
                kind="project"
                onApply={(value) => {
                  if (value.kind !== "project") return;
                  const next = upgradeRealtimeProject(value.data);
                  setConfirm({
                    title: "应用官方方案预设？",
                    detail: `「${next.name}」将替换当前整份方案，包含队伍与时间轴。请先导出要保留的方案。`,
                    action: () => {
                      setProject(next);
                      setDraft(null);
                      setRecovering(false);
                      setOfficialProject(false);
                      setToast("已应用官方方案预设");
                    },
                  });
                }}
              />
            </Suspense>
          </Modal>
        )}
        {presetDialog && (
          <Modal
            title={presetDialog.mode === "save" ? "保存预设" : "导入预设"}
            subtitle={`${presetDialog.kind === "character" ? "角色" : "武器"}预设 · 可保存在浏览器，也可导出为 JSON 文件`}
            onClose={() => setPresetDialog(null)}
          >
            {presetDialog.mode === "save" ? (
              <>
                <Field label="预设名称">
                  <input
                    placeholder="为这份预设取个名字"
                    value={presetDialog.name}
                    onChange={(e) =>
                      setPresetDialog({ ...presetDialog, name: e.target.value })
                    }
                  />
                </Field>
                {libraryError && (
                  <p className="validation">
                    本地预设库无法读取。请导出预设文件保留当前配置。
                  </p>
                )}
                <div className="form-actions">
                  <button
                    className="btn"
                    disabled={!presetDialog.name.trim()}
                    onClick={() => {
                      const { kind, id, name } = presetDialog;
                      const data =
                        kind === "character"
                          ? project.characters.find((c) => c.id === id)
                          : project.weapons.find((w) => w.id === id);
                      downloadJson(
                        { id: uid(), kind, name, data },
                        `${name}.preset.json`,
                      );
                    }}
                  >
                    <ArrowDownToLine size={16} />
                    导出文件
                  </button>
                  <button
                    className="btn primary"
                    disabled={!presetDialog.name.trim() || libraryError}
                    onClick={savePreset}
                  >
                    <Save size={16} />
                    保存到预设库
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="segmented" role="tablist" aria-label="预设来源">
                  <button
                    role="tab"
                    aria-selected={presetSource === "local"}
                    className={presetSource === "local" ? "active" : ""}
                    onClick={() => setPresetSource("local")}
                  >
                    本地 / 文件
                  </button>
                  <button
                    role="tab"
                    aria-selected={presetSource === "official"}
                    className={presetSource === "official" ? "active" : ""}
                    onClick={() => setPresetSource("official")}
                  >
                    从官方预设库导入
                  </button>
                </div>
                {presetSource === "official" ? (
                  <Suspense fallback={<p>正在打开官方预设库…</p>}>
                    <OfficialPresetLibrary
                      kind={presetDialog.kind}
                      onApply={(value) => {
                        if (value.kind !== "project") loadPreset(value.preset);
                      }}
                    />
                  </Suspense>
                ) : (
                  <>
                    <div className="preset-library">
                      {presets
                        .filter((p) => p.kind === presetDialog.kind)
                        .map((p) => (
                          <div className="preset-row" key={p.id}>
                            <span className="preset-icon">
                              <FileJson size={20} />
                            </span>
                            <div>
                              <strong>{p.name}</strong>
                              <span>
                                {p.kind === "character"
                                  ? `${p.data.name || "未命名角色"} · ${p.data.constellation}`
                                  : `${p.data.name || "未命名武器"} · 基础攻击力 ${p.data.atk}`}
                              </span>
                            </div>
                            <button
                              className="btn small-btn"
                              onClick={() => loadPreset(p)}
                            >
                              应用
                            </button>
                            <button
                              className="icon-btn"
                              aria-label={`导出预设 ${p.name}`}
                              onClick={() =>
                                downloadJson(p, `${p.name}.preset.json`)
                              }
                            >
                              <Download size={15} />
                            </button>
                            <button
                              className="icon-btn danger"
                              aria-label={`删除预设 ${p.name}`}
                              onClick={() =>
                                setConfirm({
                                  title: "删除预设？",
                                  detail:
                                    "只移除预设库中的这份记录，不影响当前队伍配置。",
                                  action: () =>
                                    setPresets((items) =>
                                      items.filter((x) => x.id !== p.id),
                                    ),
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      {!presets.some((p) => p.kind === presetDialog.kind) && (
                        <Empty
                          icon={<FolderOpen size={25} />}
                          title="预设库还是空的"
                          detail="先保存当前配置，或从 JSON 预设文件导入。"
                        />
                      )}
                    </div>
                    <p className="input-note">
                      应用预设会替换当前选中角色或武器的参数。
                    </p>
                    <input
                      ref={presetInput}
                      type="file"
                      hidden
                      accept=".json,application/json"
                      aria-label="导入预设文件"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          loadPreset(parsePreset(await readJson(file)));
                        } catch {
                          setToast(
                            "预设导入失败：请检查 JSON 文件的类型与参数格式。",
                          );
                        }
                      }}
                    />
                    <div className="form-actions">
                      <button
                        className="btn"
                        onClick={() => presetInput.current?.click()}
                      >
                        <Upload size={16} />
                        从文件导入
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </Modal>
        )}
        {effectDialog && (
          <Modal
            wide
            title={`${effectDialog.existing ? "编辑" : "添加"}环境/共鸣效果`}
            subtitle="没有触发者，不可选择自身；变量来源角色仍可独立选择。"
            onClose={() => setEffectDialog(null)}
          >
            <EffectEditor
              environment
              value={effectDialog.value}
              characters={project.characters}
              onChange={(value) => setEffectDialog({ ...effectDialog, value })}
            />
            <div className="form-actions">
              <button className="btn" onClick={() => setEffectDialog(null)}>
                取消
              </button>
              <button
                className="btn primary"
                disabled={
                  !effectTargetValid(effectDialog.value) ||
                  !!effectFormulaError(effectDialog.value)
                }
                onClick={saveEffect}
              >
                保存效果
              </button>
            </div>
          </Modal>
        )}
        {(help || about) && (
          <Suspense
            fallback={
              <Modal
                title="正在打开…"
                onClose={() => {
                  setHelp(false);
                  setAbout(false);
                }}
              >
                <p>正在加载说明</p>
              </Modal>
            }
          >
            <InformationDialogs
              kind={help ? "usage" : "about"}
              onClose={() => {
                setHelp(false);
                setAbout(false);
              }}
            />
          </Suspense>
        )}
      </div>
    </SkillOptionsContext.Provider>
  );
}
