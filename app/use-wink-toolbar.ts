"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useWinkToolbar() {
  const ref = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLButtonElement | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const clear = useCallback(() => {
    selected.current?.removeAttribute("data-wink-selected");
    selected.current = null;
    setSelectedLabel("");
  }, []);
  const hasSelection = useCallback(() => Boolean(selected.current && ref.current?.contains(selected.current) && !selected.current.disabled), []);
  const move = useCallback((eye: "left" | "right") => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)") ?? []);
    if (!buttons.length) { clear(); return; }
    const current = selected.current ? buttons.indexOf(selected.current) : -1;
    const next = current < 0 ? (eye === "left" ? 0 : buttons.length - 1) : Math.max(0, Math.min(buttons.length - 1, current + (eye === "left" ? -1 : 1)));
    selected.current?.removeAttribute("data-wink-selected");
    selected.current = buttons[next];
    selected.current.setAttribute("data-wink-selected", "true");
    setSelectedLabel(selected.current.textContent?.trim() ?? "");
    selected.current.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [clear]);
  const activate = useCallback(() => {
    const button = hasSelection() ? selected.current : null;
    clear();
    button?.click();
  }, [clear, hasSelection]);

  useEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;
    const observer = new MutationObserver(() => {
      if (selected.current && !hasSelection()) clear();
    });
    observer.observe(toolbar, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  });
  return { ref, selectedLabel, move, clear, hasSelection, activate };
}
