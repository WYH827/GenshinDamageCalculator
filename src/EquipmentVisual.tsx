import { useState } from "react";
import { Flower2, Swords } from "lucide-react";
import { validAvatarUrl } from "./CharacterVisual";
export default function EquipmentVisual({
  urls = [],
  kind,
  name = "",
}: {
  urls?: string[];
  kind: "weapon" | "artifact";
  name?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const visible = urls
    .filter((u) => validAvatarUrl(u) && !failed.includes(u))
    .slice(0, 2);
  return (
    <span
      className={`equipment-visual ${visible.length === 2 ? "paired-set" : ""}`}
      role="img"
      aria-label={`${name || (kind === "weapon" ? "武器" : "圣遗物")}图标`}
    >
      {visible.length ? (
        visible.map((url, i) => (
          <img
            alt=""
            key={url}
            className={`equipment-image image-${i}`}
            src={url}
            referrerPolicy="no-referrer"
            onError={() => setFailed((old) => [...old, url])}
          />
        ))
      ) : kind === "weapon" ? (
        <Swords size={23} />
      ) : (
        <Flower2 size={23} />
      )}
      {visible.length === 2 && <b className="set-plus">+</b>}
    </span>
  );
}
