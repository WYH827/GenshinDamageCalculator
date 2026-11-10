import type { DamageResult } from "./damage-engine";

export const DAMAGE_MODES = {
  crit: "暴击",
  nonCrit: "不暴击",
  expected: "期望",
} as const;
export type DamageMode = keyof typeof DAMAGE_MODES;
export function summarizeDamage(
  rows: DamageResult[],
  characterIds: string[],
  time: number,
  mode: DamageMode,
) {
  const sums = new Map(
    characterIds.map((id) => [id, { total: 0, failed: false }]),
  );
  let partial = 0,
    failed = 0;
  for (const row of rows) {
    const amount = row[mode],
      character = sums.get(row.skill.characterId);
    if (row.error || amount === undefined || !Number.isFinite(amount)) {
      failed++;
      if (character) character.failed = true;
      continue;
    }
    partial += amount;
    if (character) character.total += amount;
  }
  const overflow = !Number.isFinite(partial);
  const total = failed || overflow ? null : partial;
  const quotient = total !== null && time > 0 ? total / time : null;
  return {
    total,
    partial: overflow ? null : partial,
    failed,
    overflow,
    dps: quotient !== null && Number.isFinite(quotient) ? quotient : null,
    characters: characterIds.map((id) => {
      const row = sums.get(id)!;
      const damage =
        row.failed || !Number.isFinite(row.total) ? null : row.total;
      return {
        id,
        damage,
        percent:
          total !== null && total > 0 && damage !== null
            ? (damage / total) * 100
            : 0,
      };
    }),
  };
}
export type DamageSummary = ReturnType<typeof summarizeDamage>;
