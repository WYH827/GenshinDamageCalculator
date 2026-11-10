import { charName, type Character, type Effect, type Project } from "./model";

export function defaultEffectName(
  characters: Character[],
  sourceId: string,
  sourceType: string,
  ownerName = "",
) {
  const index = characters.findIndex((c) => c.id === sourceId);
  const character = index < 0 ? "" : charName(characters[index], index);
  return `${character}${sourceType}${ownerName.trim()}`;
}
export const automaticEffectName = (e: Effect) =>
  e.nameMode === "auto" || (!e.nameMode && !e.name.trim());
export function namedEffect(e: Effect, defaultName: string): Effect {
  return automaticEffectName(e)
    ? { ...e, name: defaultName, nameMode: "auto" }
    : e;
}

/** Save automatic names with their current owner; never replace a custom name or ID. */
export function syncEffectNames(p: Project): Project {
  const names = <
    T extends { name: string; characterId: string; effects: Effect[] },
  >(
    owners: T[],
    type: string,
  ): T[] =>
    owners.map((o) => ({
      ...o,
      effects: o.effects.map((e) =>
        namedEffect(
          e,
          defaultEffectName(p.characters, o.characterId, type, o.name),
        ),
      ),
    }));
  return {
    ...p,
    weapons: names(p.weapons, "武器"),
    artifacts: names(p.artifacts, "圣遗物"),
    talents: names(p.talents, "天赋"),
    skills: names(p.skills, "技能"),
    globals: p.globals.map((e) => namedEffect(e, "环境/元素共鸣")),
    customEffects: (p.customEffects ?? []).map((e) =>
      namedEffect(e, defaultEffectName(p.characters, e.sourceId, "独立效果")),
    ),
  };
}
