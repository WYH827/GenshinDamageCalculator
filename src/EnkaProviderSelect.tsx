import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ENKA_PROVIDERS,
  isDiscouragedProvider,
  type EnkaProvider,
} from "./site-config";

const providers = Object.keys(ENKA_PROVIDERS) as EnkaProvider[];

export default function EnkaProviderSelect({
  value,
  onChange,
}: {
  value: EnkaProvider;
  onChange: (value: EnkaProvider) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const choose = (provider: EnkaProvider) => {
    onChange(provider);
    setOpen(false);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = providers.indexOf(open ? active : value);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        setActive(
          open
            ? providers[
                (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  providers.length) %
                  providers.length
              ]
            : value,
        );
        setOpen(true);
        break;
      case "Home":
      case "End":
        event.preventDefault();
        setActive(providers[event.key === "Home" ? 0 : providers.length - 1]);
        setOpen(true);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else {
          setActive(value);
          setOpen(true);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        UID查询接口
      </span>
      <div
        className="enka-provider-select"
        ref={root}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
      >
        <button
          type="button"
          role="combobox"
          className="enka-provider-trigger"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          data-value={value}
          onKeyDown={keyDown}
          onClick={() => {
            setActive(value);
            setOpen(!open);
          }}
        >
          <span
            className={isDiscouragedProvider(value) ? "provider-struck" : ""}
          >
            {ENKA_PROVIDERS[value]}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <ul
            className="enka-provider-menu"
            role="listbox"
            id={`${id}-list`}
            aria-labelledby={`${id}-label`}
          >
            {providers.map((provider) => (
              <li
                key={provider}
                id={`${id}-${provider}`}
                role="option"
                aria-selected={value === provider}
                data-value={provider}
                className={`enka-provider-option ${active === provider ? "is-active" : ""}`}
                onPointerMove={() => setActive(provider)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(provider)}
              >
                <span
                  className={
                    isDiscouragedProvider(provider) ? "provider-struck" : ""
                  }
                >
                  {ENKA_PROVIDERS[provider]}
                </span>
                {value === provider && <Check size={15} aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
