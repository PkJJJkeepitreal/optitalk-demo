// Delay a single blink so a double blink never also selects a letter.
export function createBlinkSequence(onDouble: () => void, delay = 350) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return {
    tap(onSingle: () => void) {
      if (timer !== null) { cancel(); onDouble(); return; }
      pending = onSingle;
      timer = setTimeout(() => {
        const action = pending;
        cancel();
        action?.();
      }, delay);
    },
    cancel,
    flush() { const action = pending; cancel(); action?.(); },
  };
}
