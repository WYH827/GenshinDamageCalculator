import EquipmentVisual from "./EquipmentVisual";
import CharacterVisual from "./CharacterVisual";
import type { Project } from "./model";
import type { CatalogEffect } from "./effect-catalog";
export default function EffectSourceVisual({
  project: p,
  entry,
}: {
  project: Project;
  entry?: CatalogEffect;
}) {
  if (!entry) return null;
  if (entry.kind === "weapon") {
    const w = p.weapons.find((w) => w.id === entry.ownerId);
    return (
      <EquipmentVisual
        kind="weapon"
        name={w?.name}
        urls={w?.iconUrl ? [w.iconUrl] : []}
      />
    );
  }
  if (entry.kind === "artifact") {
    const a = p.artifacts.find((a) => a.id === entry.ownerId);
    return (
      <EquipmentVisual kind="artifact" name={a?.name} urls={a?.iconUrls} />
    );
  }
  const index = p.characters.findIndex((c) => c.id === entry.effect.sourceId);
  return index >= 0 ? (
    <CharacterVisual small character={p.characters[index]} index={index} />
  ) : null;
}
