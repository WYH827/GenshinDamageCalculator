import { useId, useState } from "react";
import { starsForLevel } from "./model";

export default function LevelSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (level: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="field level-field">
      <span className="field-label">
        角色等级 <span className="field-hint">{starsForLevel(value)} 命星</span>
      </span>
      <select
        aria-label="角色等级"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {value < 90 && <option value={value}>{value} 级</option>}
        {[90, 95, 100].map((level) => (
          <option key={level} value={level}>
            {level} 级
          </option>
        ))}
      </select>
      <button
        type="button"
        className="level-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "收起" : "展开"} 1–89 级
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div id={id} className="low-levels" role="group" aria-label="1–89级">
          {Array.from({ length: 89 }, (_, i) => i + 1).map((level) => (
            <button
              type="button"
              key={level}
              aria-label={`选择 ${level} 级`}
              aria-pressed={value === level}
              onClick={() => {
                onChange(level);
                setExpanded(false);
              }}
            >
              {level}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
