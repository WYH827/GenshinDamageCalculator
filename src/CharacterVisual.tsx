import { useState, type CSSProperties } from "react";
import type { Character, CharacterElement } from "./model";
import pyro from "./assets/elements/elementPyro.svg";
import cryo from "./assets/elements/elementCryo.svg";
import electro from "./assets/elements/elementElectro.svg";
import dendro from "./assets/elements/elementDendro.svg";
import geo from "./assets/elements/elementGeo.svg";
import anemo from "./assets/elements/elementAmeno.svg";
import hydro from "./assets/elements/elementHydro.svg";
export const ELEMENT_VISUALS: Record<
  CharacterElement,
  { icon: string; color: string }
> = {
  火: { icon: pyro, color: "#FF9999" },
  冰: { icon: cryo, color: "#99FFFF" },
  雷: { icon: electro, color: "#FFACFF" },
  草: { icon: dendro, color: "#99FF88" },
  岩: { icon: geo, color: "#FFE699" },
  风: { icon: anemo, color: "#80FFD7" },
  水: { icon: hydro, color: "#80C0FF" },
};
export function ElementIcon({ element }: { element: CharacterElement }) {
  const v = ELEMENT_VISUALS[element];
  return (
    <span
      role="img"
      aria-label={`${element}元素`}
      className="element-symbol"
      style={
        {
          "--element-icon": `url("${v.icon}")`,
          "--element-color": v.color,
        } as CSSProperties
      }
    />
  );
}
export function validAvatarUrl(url?: string) {
  return !!url && /^https?:\/\//i.test(url);
}
export default function CharacterVisual({
  character: c,
  index,
  small = false,
}: {
  character: Character;
  index: number;
  small?: boolean;
}) {
  const [failed, setFailed] = useState("");
  return (
    <div
      className={`avatar element-${["火", "冰", "雷", "草", "岩", "风", "水"].indexOf(c.element)} ${small ? "small-avatar" : ""}`}
    >
      {validAvatarUrl(c.avatarUrl) && failed !== c.avatarUrl ? (
        <span className="portrait-window">
          <img
            className="character-portrait"
            src={c.avatarUrl}
            alt={`${c.name || "角色"}头像`}
            referrerPolicy="no-referrer"
            onError={() => setFailed(c.avatarUrl!)}
          />
        </span>
      ) : (
        <span>
          {c.short ||
            Array.from(c.name)[0] ||
            String(index + 1).padStart(2, "0")}
        </span>
      )}
      <i>
        <ElementIcon element={c.element} />
      </i>
    </div>
  );
}
