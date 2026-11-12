import { Power } from "lucide-react";

export default function EnableToggle({
  enabled,
  label,
  onChange,
}: {
  enabled?: boolean;
  label: string;
  onChange: (enabled: boolean) => void;
}) {
  const active = enabled !== false;
  return (
    <button
      type="button"
      className="icon-btn enable-toggle"
      aria-label={`${active ? "禁用" : "开启"}${label}`}
      aria-pressed={active}
      title={active ? "点击禁用" : "点击开启"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(!active);
      }}
    >
      <Power size={16} />
    </button>
  );
}
