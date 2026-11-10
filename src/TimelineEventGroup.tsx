import { useLayoutEffect, useRef, type ReactNode } from "react";
export default function TimelineEventGroup({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = ref.current!;
    const measure = () => {
      const input = group.querySelector(
        ".timeline-row > .timeline-time .number-input",
      );
      const children = group.querySelector(".bound-effects-children");
      if (!input || !children) return;
      const box = group.getBoundingClientRect(),
        time = input.getBoundingClientRect(),
        child = children.getBoundingClientRect();
      group.style.setProperty(
        "--guide-x",
        `${time.left + time.width / 2 - box.left}px`,
      );
      group.style.setProperty("--guide-top", `${time.bottom - box.top}px`);
      group.style.setProperty(
        "--guide-height",
        `${Math.max(0, child.top - time.bottom + 1)}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
