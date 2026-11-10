import { calculateProject, type DamageResult } from "./damage-engine";
import { activeEffectsAt } from "./effect-state";
import {
  createPanelResolver,
  calculateOutsidePanels,
  type OutsidePanels,
} from "./panels";
import type { Project, TimelineEvent } from "./model";
import { buildCombatAxis, type CombatAxisData } from "./combat-axis";

export function calculateDetail(project: Project, event: TimelineEvent) {
  const effects = activeEffectsAt(project, event.id),
    resolver = createPanelResolver(project, event.id);
  const characters = project.characters.map((c) => {
    const panels = resolver.panels.get(c.id)!;
    const stats = [
      "生命值",
      "攻击力",
      "防御力",
      "元素精通",
      "暴击率",
      "暴击伤害",
      "元素充能效率",
      "治疗加成",
      `${c.element}元素伤害加成`,
      "物理伤害加成",
    ];
    return {
      id: c.id,
      rows: stats.map((stat) => {
        let live: number | null = null,
          outside: number | null = null,
          error: string | undefined;
        try {
          outside = resolver.resolve(c.id, stat, "outside");
        } catch (e) {
          error = (e as Error).message;
        }
        try {
          live = resolver.resolve(c.id, stat, "live");
        } catch (e) {
          error = (e as Error).message;
        }
        return {
          stat,
          base: panels.base[stat],
          outside,
          live,
          error,
        };
      }),
    };
  });
  return {
    characters,
    effects: effects.map((row) => ({
      ...row,
      evaluation: resolver.trace(row.effect, row.stacks ?? 1),
    })),
  };
}
export type Calculation = ReturnType<typeof calculateProject>;
export type CalculationDetail = ReturnType<typeof calculateDetail>;
export type WorkerRequest =
  { kind: "calculate"; project: Project } | { kind: "detail"; eventId: string };
export type WorkerResponse =
  | {
      kind: "calculated";
      calculation: Calculation;
      outsidePanels: OutsidePanels;
      axis: CombatAxisData;
    }
  | { kind: "detail"; eventId: string; detail: CalculationDetail }
  | { kind: "error"; message: string; eventId?: string };

let project: Project | undefined;
let results = new Map<string, DamageResult>();
self.onmessage = (message: MessageEvent<WorkerRequest>) => {
  const request = message.data;
  try {
    if (request.kind === "calculate") {
      project = request.project;
      const calculation = calculateProject(project);
      results = new Map(calculation.rows.map((r) => [r.event.id, r]));
      self.postMessage({
        kind: "calculated",
        calculation,
        outsidePanels: calculateOutsidePanels(project),
        axis: buildCombatAxis(project),
      } satisfies WorkerResponse);
    } else {
      const event = results.get(request.eventId)?.event;
      if (!project || !event) throw new Error("请先计算当前方案");
      self.postMessage({
        kind: "detail",
        eventId: request.eventId,
        detail: calculateDetail(project, event),
      } satisfies WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      kind: "error",
      message: (error as Error).message,
      eventId: request.kind === "detail" ? request.eventId : undefined,
    } satisfies WorkerResponse);
  }
};
