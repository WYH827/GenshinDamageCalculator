import CharacterVisual from "./CharacterVisual";
import { enkaApiUrl } from "./site-config";
import EquipmentVisual from "./EquipmentVisual";
import { useEffect, useRef, useState } from "react";
import { CharacterSelect, Field, Modal } from "./components";
import {
  ALL_STATS,
  MAIN_SLOTS,
  charName,
  CHARACTER_LEVELS,
  type MainStats,
  type Project,
} from "./model";
import {
  applyQuickImport,
  applyBatchQuickImport,
  type ImportMapping,
  defaultImportOptions,
  importedStatLabel,
  parseEnkaImport,
  parseGoodImport,
  type ImportAccount,
  type QuickImportOptions,
} from "./quick-import";
import type { Update } from "./sections";
export const LAST_ENKA_UID_KEY = "teyvat-studio.last-enka-uid";

export default function QuickImport({
  project,
  update,
  onClose,
  onImported,
}: {
  project: Project;
  update: Update;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [mode, setMode] = useState<"json" | "enka">("json"),
    [account, setAccount] = useState<ImportAccount | null>(null);
  const [uidValue, setUid] = useState(() => {
      try {
        return localStorage.getItem(LAST_ENKA_UID_KEY) ?? "";
      } catch {
        return "";
      }
    }),
    [sourceKey, setSourceKey] = useState("");
  const [batch, setBatch] = useState(false);
  const [mappings, setMappings] = useState<ImportMapping[]>([]);
  const [batchOptions, setBatchOptions] = useState<QuickImportOptions>({});
  const [targetId, setTargetId] = useState(project.characters[0].id);
  const [options, setOptions] = useState<QuickImportOptions>(
    defaultImportOptions(),
  );
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null),
    sequence = useRef(0);
  useEffect(
    () => () => {
      request.current?.abort();
      sequence.current++;
    },
    [],
  );
  const source = account?.characters.find((c) => c.key === sourceKey);
  const select = (data: ImportAccount) => {
    setAccount(data);
    setMappings(
      project.characters.map((c, i) => ({
        targetId: c.id,
        sourceKey: data.characters[i]?.key ?? "",
      })),
    );
    setBatchOptions({});
    setSourceKey(data.characters[0]?.key ?? "");
    setOptions(defaultImportOptions(data.characters[0]));
  };
  const cancelLoad = () => {
    request.current?.abort();
    sequence.current++;
    setLoading(false);
  };
  const chooseMode = (next: typeof mode) => {
    cancelLoad();
    setMode(next);
    setAccount(null);
    setError("");
  };
  async function enka() {
    if (!/^[1-9]\d{8,9}$/.test(uidValue.trim())) {
      setError("请输入9或10位数字UID");
      return;
    }
    try {
      localStorage.setItem(LAST_ENKA_UID_KEY, uidValue.trim());
    } catch {
      /* Import still works when storage is unavailable. */
    }
    cancelLoad();
    const id = ++sequence.current,
      controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setAccount(null);
    try {
      const r = await fetch(enkaApiUrl(uidValue.trim()), {
        signal: controller.signal,
      });
      if (!r.headers.get("content-type")?.includes("application/json"))
        throw new Error(
          "当前服务未启用Enka接口，请使用启动工作台或npm run preview运行",
        );
      const json = await r.json();
      if (!r.ok)
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : `读取失败（${r.status}）`,
        );
      if (id === sequence.current) select(parseEnkaImport(json));
    } catch (e) {
      if (id === sequence.current && !controller.signal.aborted)
        setError((e as Error).message || "读取失败，请检查网络");
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }
  const option = (
    key: keyof QuickImportOptions,
    label: string,
    detail: string,
    disabled = false,
  ) => (
    <label className={`quick-import-option ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        aria-label={label}
        checked={!disabled && !!options[key]}
        disabled={disabled}
        onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
      />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </label>
  );
  return (
    <Modal
      wide
      title="快速导入装备"
      subtitle="选择来源角色与计算器目标角色，预览后导入勾选的内容。"
      onClose={onClose}
    >
      <div className="segmented" role="tablist" aria-label="快速导入方式">
        <button
          role="tab"
          aria-selected={mode === "json"}
          className={mode === "json" ? "active" : ""}
          onClick={() => chooseMode("json")}
        >
          GGScanner JSON
        </button>
        <button
          role="tab"
          aria-selected={mode === "enka"}
          className={mode === "enka" ? "active" : ""}
          onClick={() => chooseMode("enka")}
        >
          Enka UID
        </button>
      </div>
      {mode === "json" ? (
        <div className="quick-import-source">
          <Field label="GGScanner导出文件">
            <input
              type="file"
              accept=".json,application/json"
              aria-label="快速导入JSON"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                cancelLoad();
                const id = ++sequence.current;
                setError("");
                setAccount(null);
                setLoading(true);
                try {
                  if (file.size > 16 * 1024 * 1024)
                    throw new Error("导出文件不能超过16MB");
                  const json = JSON.parse(
                    (await file.text()).replace(/^\uFEFF/, ""),
                  );
                  const data = parseGoodImport(json);
                  if (id === sequence.current) select(data);
                } catch (err) {
                  if (id === sequence.current)
                    setError(
                      err instanceof SyntaxError
                        ? "文件不是有效JSON"
                        : (err as Error).name === "ZodError"
                          ? "请选择GGScanner导出的GOOD JSON（含角色/已装备物品）"
                          : (err as Error).message,
                    );
                } finally {
                  if (id === sequence.current) setLoading(false);
                }
              }}
            />
          </Field>
          <p className="input-note">
            支持{" "}
            <a
              href="https://github.com/Anyrainel/GGScanner"
              target="_blank"
              rel="noreferrer"
            >
              GGScanner
            </a>{" "}
            抓包生成的GOOD JSON，按装备归属匹配角色；文件在本机解析。
          </p>
        </div>
      ) : (
        <div className="quick-import-source">
          <Field label="原神UID">
            <input
              inputMode="numeric"
              value={uidValue}
              onChange={(e) => {
                cancelLoad();
                setUid(e.target.value);
                setAccount(null);
                setError("");
              }}
              placeholder="输入9或10位UID"
            />
          </Field>
          <button className="btn" disabled={loading} onClick={enka}>
            {loading ? "正在读取…" : "读取账号"}
          </button>
          <p className="input-note">
            <a
              href="https://api.enka.network/#/api"
              target="_blank"
              rel="noreferrer"
            >
              Enka.Network
            </a>{" "}
            仅返回公开展柜角色，请在游戏中开启“显示角色详情”。数据受接口缓存影响。
          </p>
        </div>
      )}
      {loading && <p role="status">正在读取角色数据…</p>}
      {error && (
        <p className="validation" role="alert">
          {error}
        </p>
      )}
      {account && (
        <>
          <p className="input-note">
            {account.name} · {account.characters.length}个角色
          </p>
          <div className="segmented" role="tablist" aria-label="导入数量">
            <button
              role="tab"
              aria-selected={!batch}
              className={!batch ? "active" : ""}
              onClick={() => setBatch(false)}
            >
              单角色导入
            </button>
            <button
              role="tab"
              aria-selected={batch}
              className={batch ? "active" : ""}
              onClick={() => setBatch(true)}
            >
              四角色批量导入
            </button>
          </div>
          {batch ? (
            <div className="batch-import-mappings">
              {mappings.map((m, i) => {
                const row = account.characters.find(
                  (c) => c.key === m.sourceKey,
                );
                return (
                  <section className="batch-import-row" key={m.targetId}>
                    <CharacterVisual
                      character={{
                        ...project.characters[i],
                        name: row?.name ?? project.characters[i].name,
                        avatarUrl: row?.avatarUrl,
                        element: (row?.element ??
                          project.characters[i]
                            .element) as Project["characters"][number]["element"],
                      }}
                      index={i}
                    />
                    <Field
                      label={`导入到角色${i + 1} · ${charName(project.characters[i], i)}`}
                    >
                      <select
                        aria-label={`批量来源角色${i + 1}`}
                        value={m.sourceKey}
                        onChange={(e) =>
                          setMappings((old) =>
                            old.map((x) =>
                              x.targetId === m.targetId
                                ? { ...x, sourceKey: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="">跳过此角色</option>
                        {account.characters.map((c) => (
                          <option
                            key={c.key}
                            value={c.key}
                            disabled={mappings.some(
                              (x) =>
                                x.targetId !== m.targetId &&
                                x.sourceKey === c.key,
                            )}
                          >
                            {c.name} · {c.level ?? "?"}级
                          </option>
                        ))}
                      </select>
                    </Field>
                    {row && (
                      <div className="batch-import-summary">
                        <span>
                          {row.baseStats
                            ? `基础生命 ${row.baseStats.hp.toFixed(1)} · 攻击 ${row.baseStats.atk.toFixed(1)} · 防御 ${row.baseStats.def.toFixed(1)}`
                            : "未提供可靠基础三维"}{" "}
                          · {row.constellation ?? "?"}命
                        </span>
                        <span>
                          <EquipmentVisual
                            kind="weapon"
                            urls={
                              row.weapon?.iconUrl ? [row.weapon.iconUrl] : []
                            }
                          />
                          {row.weapon?.name ?? "未提供武器"}
                        </span>
                        <span>
                          <EquipmentVisual
                            kind="artifact"
                            urls={row.artifacts?.iconUrls}
                          />
                          {row.artifacts?.name ?? "未提供套装"}
                        </span>
                      </div>
                    )}
                  </section>
                );
              })}
              <div className="batch-import-flags">
                {Object.entries({
                  characterName: "角色名称",
                  characterLevel: "角色等级",
                  characterConstellation: "角色命座",
                  characterBase: "角色基础三维",
                  characterAvatar: "角色头像",
                  characterElement: "角色属性",
                  weaponName: "武器名称",
                  weaponAtk: "武器主词条",
                  weaponSubstats: "武器副词条",
                  weaponIcon: "武器图标",
                  artifacts: "圣遗物主副词条",
                  artifactName: "套装名字",
                  artifactIcon: "套装图标",
                }).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={
                        batchOptions[key as keyof QuickImportOptions] !== false
                      }
                      onChange={(e) =>
                        setBatchOptions({
                          ...batchOptions,
                          [key]: e.target.checked,
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="input-note">
                默认导入全部可用信息；缺失项保留目标值。每个来源角色只能选择一次。
              </p>
            </div>
          ) : (
            <>
              <div className="form-grid two">
                <Field label="来源角色">
                  <select
                    aria-label="来源角色"
                    value={sourceKey}
                    onChange={(e) => {
                      setSourceKey(e.target.value);
                      const c = account.characters.find(
                        (c) => c.key === e.target.value,
                      )!;
                      setOptions(defaultImportOptions(c));
                    }}
                  >
                    {account.characters.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                        {c.level ? ` · ${c.level}级` : ""}
                        {c.element ? ` · ${c.element}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="导入到计算器角色">
                  <CharacterSelect
                    label="导入到计算器角色"
                    value={targetId}
                    onChange={setTargetId}
                    characters={project.characters}
                  />
                </Field>
              </div>
              {source && (
                <div className="quick-import-preview">
                  <div className="import-visual-preview">
                    <CharacterVisual
                      character={{
                        ...project.characters[0],
                        name: source.name,
                        avatarUrl: source.avatarUrl,
                        element: (source.element ??
                          project.characters[0]
                            .element) as Project["characters"][number]["element"],
                      }}
                      index={0}
                    />
                    <EquipmentVisual
                      kind="weapon"
                      urls={
                        source.weapon?.iconUrl ? [source.weapon.iconUrl] : []
                      }
                    />
                    <EquipmentVisual
                      kind="artifact"
                      urls={source.artifacts?.iconUrls}
                    />
                  </div>
                  <div className="quick-import-options">
                    <section>
                      <h4>角色信息</h4>
                      {option("characterName", "导入角色名称", source.name)}
                      {option(
                        "characterBase",
                        "导入角色基础生命/攻击/防御",
                        source.baseStats
                          ? `${source.baseStats.hp.toFixed(2)} / ${source.baseStats.atk.toFixed(2)} / ${source.baseStats.def.toFixed(2)} · ${source.baseStatsNote}`
                          : (source.baseStatsNote ?? "未提供可靠基础三维"),
                        !source.baseStats,
                      )}
                      {option(
                        "characterAvatar",
                        "导入角色头像",
                        source.avatarUrl ? "Enka角色头像" : "未提供",
                        !source.avatarUrl,
                      )}
                      {option(
                        "characterElement",
                        "导入角色属性",
                        source.element ?? "未提供",
                        !defaultImportOptions(source).characterElement,
                      )}
                      {option(
                        "characterLevel",
                        "导入角色等级",
                        source.level === undefined
                          ? "未提供"
                          : `${source.level}级`,
                        source.level === undefined ||
                          !CHARACTER_LEVELS.includes(source.level),
                      )}
                      {option(
                        "characterConstellation",
                        "导入角色命座",
                        source.constellation === undefined
                          ? "未提供"
                          : `${source.constellation}命`,
                        source.constellation === undefined,
                      )}
                    </section>
                    <section>
                      <h4>武器</h4>
                      {option(
                        "weaponIcon",
                        "导入武器图标",
                        source.weapon?.iconUrl ? "Enka武器图标" : "未提供",
                        !source.weapon?.iconUrl,
                      )}
                      {option(
                        "weaponName",
                        "导入武器名称",
                        source.weapon?.name ?? "未提供",
                        !source.weapon,
                      )}
                      {option(
                        "weaponAtk",
                        "导入武器主词条",
                        source.weapon
                          ? `基础攻击力 ${source.weapon.atk}`
                          : "未提供",
                        !source.weapon,
                      )}
                      {option(
                        "weaponSubstats",
                        "导入武器副词条",
                        source.weapon?.substats
                          ? source.weapon.substats
                              .map(
                                (s) =>
                                  `${ALL_STATS[s.type].name} ${s.value}${ALL_STATS[s.type].percent ? "%" : ""}`,
                              )
                              .join("、") || "无副词条"
                          : (source.weapon?.substatError ?? "未提供"),
                        !source.weapon?.substats,
                      )}
                    </section>
                    <section className="quick-import-artifact-option">
                      <h4>圣遗物</h4>
                      {option(
                        "artifactIcon",
                        "导入圣遗物图标",
                        source.artifacts?.iconUrls?.length === 2
                          ? "2+2套装花图标"
                          : source.artifacts?.iconUrls?.length
                            ? "生效套装花图标"
                            : "未提供激活套装",
                        !source.artifacts?.iconUrls?.length,
                      )}
                      {option(
                        "artifactName",
                        "导入圣遗物套装名字",
                        source.artifacts?.name ?? "未提供套装信息",
                        !source.artifacts?.name,
                      )}
                      {option(
                        "artifacts",
                        "导入圣遗物主词条与副词条",
                        "按部位等级设置固定值或自定义值",
                        !source.artifacts,
                      )}
                    </section>
                  </div>
                  {source.artifactError && (
                    <p className="validation">{source.artifactError}</p>
                  )}
                  {source.artifacts && (
                    <>
                      <dl>
                        {(Object.keys(MAIN_SLOTS) as (keyof MainStats)[]).map(
                          (slot) => (
                            <div key={slot}>
                              <dt>{MAIN_SLOTS[slot]}</dt>
                              <dd>
                                {importedStatLabel(
                                  source.artifacts!.importedMainStats[slot]!,
                                )}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                      <p className="input-note">
                        {source.artifacts.pieces.join("；") ||
                          "角色未装备圣遗物"}
                      </p>
                      <h4>副词条合计</h4>
                      <dl>
                        {source.artifacts.substats.map((s) => (
                          <div key={s.id}>
                            <dt>{ALL_STATS[s.type].name}</dt>
                            <dd>
                              {s.value}
                              {ALL_STATS[s.type].percent ? "%" : ""}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  {source.weaponError && (
                    <p className="validation">{source.weaponError}</p>
                  )}
                  {source.weapon && (
                    <p>
                      {source.weapon.name} · {source.weapon.level}级 ·
                      基础攻击力 <strong>{source.weapon.atk}</strong>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      <p className="input-note">
        确认只替换勾选且可读取的字段。突破属性、已有装备效果和时间轴保留。
      </p>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={
            loading ||
            (batch
              ? !mappings.some((m) => m.sourceKey)
              : !source || !Object.values(options).some(Boolean))
          }
          onClick={() => {
            if (batch && account) {
              try {
                const next = applyBatchQuickImport(
                  project,
                  account,
                  mappings,
                  batchOptions,
                );
                update(() => next);
                onImported(
                  `已批量导入${mappings.filter((m) => m.sourceKey).length}个角色`,
                );
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
              return;
            }
            if (!source) return;
            try {
              const next = applyQuickImport(project, source, targetId, options);
              update(() => next);
              onImported(
                `已将${source.name}的所选装备导入${charName(
                  project.characters.find((c) => c.id === targetId)!,
                  project.characters.findIndex((c) => c.id === targetId),
                )}`,
              );
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          确认导入
        </button>
      </div>
    </Modal>
  );
}
