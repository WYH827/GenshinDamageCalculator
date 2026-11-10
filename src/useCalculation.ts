import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "./model";
import type { OutsidePanels } from "./panels";
import type { DamageMode } from "./damage-summary";
import type { CombatAxisData } from "./combat-axis";
import type {
  Calculation,
  CalculationDetail,
  WorkerRequest,
  WorkerResponse,
} from "./calculation.worker";

export type CalculationRun = {
  project: Project;
  calculation: Calculation;
  details: Record<string, CalculationDetail>;
  detailErrors: Record<string, string>;
  outsidePanels: OutsidePanels;
  axis: CombatAxisData;
};
export function useCalculation(project: Project) {
  const [damageMode, setDamageMode] = useState<DamageMode>("expected");
  const [run, setRun] = useState<CalculationRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const worker = useRef<Worker | null>(null),
    startedFor = useRef<Project | null>(null),
    latest = useRef(project);
  latest.current = project;
  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    startedFor.current = null;
    setRunning(false);
    setPending([]);
  }, []);
  useEffect(() => {
    if (startedFor.current && startedFor.current !== project) stop();
  }, [project, stop]);
  useEffect(
    () => () => {
      worker.current?.terminate();
    },
    [],
  );
  const start = () => {
    if (worker.current && running) return;
    stop();
    setRun(null);
    setError("");
    setRunning(true);
    startedFor.current = project;
    try {
      const w = new Worker(
        new URL("./calculation.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = (message: MessageEvent<WorkerResponse>) => {
        if (worker.current !== w || latest.current !== project) return;
        const data = message.data;
        if (data.kind === "calculated") {
          setRun({
            project,
            calculation: data.calculation,
            details: {},
            detailErrors: {},
            outsidePanels: data.outsidePanels,
            axis: data.axis,
          });
          setRunning(false);
        } else if (data.kind === "detail") {
          setRun((current) =>
            current?.project === project
              ? {
                  ...current,
                  details: { ...current.details, [data.eventId]: data.detail },
                }
              : current,
          );
          setPending((ids) => ids.filter((id) => id !== data.eventId));
        } else if (data.eventId) {
          setRun((current) =>
            current?.project === project
              ? {
                  ...current,
                  detailErrors: {
                    ...current.detailErrors,
                    [data.eventId!]: data.message,
                  },
                }
              : current,
          );
          setPending((ids) => ids.filter((id) => id !== data.eventId));
        } else {
          setError(data.message);
          stop();
        }
      };
      w.onerror = () => {
        if (worker.current === w) {
          setError("计算失败，请重试或检查方案");
          stop();
        }
      };
      w.postMessage({ kind: "calculate", project } satisfies WorkerRequest);
    } catch (e) {
      setError((e as Error).message);
      stop();
    }
  };
  const detail = (id: string) => {
    if (
      !worker.current ||
      running ||
      run?.project !== project ||
      run.details[id] ||
      run.detailErrors[id] ||
      pending.includes(id)
    )
      return;
    setPending((ids) => [...ids, id]);
    worker.current.postMessage({
      kind: "detail",
      eventId: id,
    } satisfies WorkerRequest);
  };
  const clear = () => {
    stop();
    setRun(null);
    setError("");
  };
  return {
    damageMode,
    setDamageMode,
    run,
    running,
    error,
    start,
    cancel: stop,
    detail,
    clear,
    stale: !!run && run.project !== project,
  };
}
export type CalculationController = ReturnType<typeof useCalculation>;
