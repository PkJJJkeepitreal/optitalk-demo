"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import styles from "./interface.module.css";

export type Direction = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
export type DirectionMode = "8" | "4";
export type RadialItem = {
  direction: Direction;
  label: string;
  helper?: string;
  action: () => void;
  longAction?: () => void;
  tone?: "normal" | "primary" | "danger";
  utility?: boolean;
};
type DynamicOverlayDirection = "n" | "e" | "s" | "w";
type DynamicOverlayOption = { direction: DynamicOverlayDirection; label: string; helper?: string; action: () => void; longAction?: () => void };
type DynamicOverlayConfig = { anchorDirection: Direction; title: string; options: DynamicOverlayOption[]; onDismiss: () => void };

export function InterfaceIcon({ name, className }: { name: "spark" | "grid" | "write" | "arrow" | "settings" | "guide" | "pause" | "sound" | "home"; className?: string }) {
  const paths = {
    home: <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8" />,
    spark: <><path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8" /><circle cx="12" cy="12" r="3" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><path d="M14 17.5h7m-3.5-3.5v7" /></>,
    write: <><path d="M13.5 5.5 18.5 10.5M4 20l5-1 11-11a3.5 3.5 0 0 0-5-5L4 14zM13 21h8" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" /><circle cx="16" cy="17" r="3" fill="currentColor" /></>,
    guide: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2M12 16v.1" /></>,
    pause: <><path d="M9 5v14m6-14v14" /></>,
    sound: <><path d="M11 4 5 9H2v6h3l6 5zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  };
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function HomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-native-controls
      onClick={onClick}
      className={styles.navButton}
    >
      <InterfaceIcon name="home" />Home
    </button>
  );
}

export function RadialPad({
  items,
  activeDirection,
  isResting,
  isBlinkPressed,
  centerText,
  onCenter,
  onCenterLong,
  centerTitle = "Your message",
  centerHelper,
  isSpeaking = false,
  speakingDurationMs = 2600,
  speechAnimationKey = 0,
  enableDwellSelection = false,
  dwellMs = 1500,
  dynamicOverlay = null,
  layoutMode = "8",
}: {
  items: RadialItem[];
  activeDirection: Direction | null;
  isResting: boolean;
  isBlinkPressed: boolean;
  centerText: ReactNode;
  onCenter: () => void;
  onCenterLong?: () => void;
  centerTitle?: string;
  centerHelper?: string;
  isSpeaking?: boolean;
  speakingDurationMs?: number;
  speechAnimationKey?: number;
  enableDwellSelection?: boolean;
  dwellMs?: number;
  dynamicOverlay?: DynamicOverlayConfig | null;
  layoutMode?: DirectionMode;
}) {
  const pointerStartRef = useRef<Partial<Record<Direction, number>>>({});
  const padRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Partial<Record<Direction, HTMLButtonElement | null>>>({});
  const anchorDirection = dynamicOverlay?.anchorDirection;

  useLayoutEffect(() => {
    if (!anchorDirection) return;
    const positionWheel = () => {
      const pad = padRef.current;
      const wheel = wheelRef.current;
      const anchor = slotRefs.current[anchorDirection];
      if (!pad || !wheel || !anchor) return;
      const bounds = pad.getBoundingClientRect();
      const target = anchor.getBoundingClientRect();
      const half = wheel.offsetWidth / 2;
      // Stay centered on the chosen group; only shift at viewport edges.
      const x = Math.max(half + 10, Math.min(document.documentElement.clientWidth - half - 10, target.left + target.width / 2));
      const y = Math.max(half + 10, Math.min(window.innerHeight - half - 10, target.top + target.height / 2));
      wheel.style.left = `${x - bounds.left - pad.clientLeft}px`;
      wheel.style.top = `${y - bounds.top - pad.clientTop}px`;
    };
    positionWheel();
    const observer = new ResizeObserver(positionWheel);
    if (padRef.current) observer.observe(padRef.current);
    window.addEventListener("resize", positionWheel);
    window.addEventListener("scroll", positionWheel, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionWheel);
      window.removeEventListener("scroll", positionWheel, true);
    };
  }, [anchorDirection, layoutMode]);
  const pointerLongReadyTimerRef = useRef<
    Partial<Record<Direction, ReturnType<typeof setTimeout>>>
  >({});
  const suppressClickUntilRef = useRef<Partial<Record<Direction, number>>>({});
  const centerPointerStartRef = useRef<number | null>(null);
  const centerSuppressClickUntilRef = useRef(0);
  const [pointerDirection, setPointerDirection] = useState<Direction | null>(null);
  const [pointerLongReadyDirection, setPointerLongReadyDirection] =
    useState<Direction | null>(null);
  const [keyboardLongReadyDirection, setKeyboardLongReadyDirection] =
    useState<Direction | null>(null);

  const hoverDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverDwellDirection, setHoverDwellDirection] =
    useState<Direction | null>(null);
  const [hoverDwellKey, setHoverDwellKey] = useState(0);

  const overlayPointerStartRef = useRef<
    Partial<Record<DynamicOverlayDirection, number>>
  >({});
  const overlaySuppressClickUntilRef = useRef<
    Partial<Record<DynamicOverlayDirection, number>>
  >({});
  const overlayHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayPressedDirection, setOverlayPressedDirection] =
    useState<DynamicOverlayDirection | null>(null);
  const [overlayHoverDirection, setOverlayHoverDirection] =
    useState<DynamicOverlayDirection | null>(null);
  const [overlayDwellKey, setOverlayDwellKey] = useState(0);

  const itemSignature = items.map(item => item.direction + ":" + item.label).join("|");

  const clearHoverDwell = () => {
    if (hoverDwellTimerRef.current !== null) {
      clearTimeout(hoverDwellTimerRef.current);
      hoverDwellTimerRef.current = null;
    }
    setHoverDwellDirection(null);
  };

  const clearOverlayHoverDwell = () => {
    if (overlayHoverTimerRef.current !== null) {
      clearTimeout(overlayHoverTimerRef.current);
      overlayHoverTimerRef.current = null;
    }
    setOverlayHoverDirection(null);
  };

  useEffect(() => {
    return () => {
      if (hoverDwellTimerRef.current !== null) {
        clearTimeout(hoverDwellTimerRef.current);
      }
      if (overlayHoverTimerRef.current !== null) {
        clearTimeout(overlayHoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    clearHoverDwell();
    clearOverlayHoverDwell();
  }, [dynamicOverlay?.title, isResting, enableDwellSelection, itemSignature]);

  const startHoverDwell = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: RadialItem
  ) => {
    if (
      !enableDwellSelection ||
      dynamicOverlay ||
      isResting ||
      event.pointerType === "touch"
    ) {
      return;
    }

    clearHoverDwell();
    setHoverDwellDirection(item.direction);
    setHoverDwellKey((previous) => previous + 1);

    hoverDwellTimerRef.current = setTimeout(() => {
      hoverDwellTimerRef.current = null;
      setHoverDwellDirection(null);
      suppressClickUntilRef.current[item.direction] = Date.now() + 700;
      item.action();
    }, dwellMs);
  };

  const startOverlayHoverDwell = (
    event: ReactPointerEvent<HTMLButtonElement>,
    option: DynamicOverlayOption
  ) => {
    if (
      !enableDwellSelection ||
      isResting ||
      event.pointerType === "touch"
    ) {
      return;
    }

    clearOverlayHoverDwell();
    setOverlayHoverDirection(option.direction);
    setOverlayDwellKey((previous) => previous + 1);

    overlayHoverTimerRef.current = setTimeout(() => {
      overlayHoverTimerRef.current = null;
      setOverlayHoverDirection(null);
      overlaySuppressClickUntilRef.current[option.direction] = Date.now() + 700;
      option.action();
    }, dwellMs);
  };

  const clearPointerLongReadyTimer = (direction: Direction) => {
    const timer = pointerLongReadyTimerRef.current[direction];

    if (timer !== undefined) {
      clearTimeout(timer);
      delete pointerLongReadyTimerRef.current[direction];
    }
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: RadialItem
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    clearHoverDwell();
    const direction = item.direction;
    pointerStartRef.current[direction] = Date.now();
    setPointerDirection(direction);
    setPointerLongReadyDirection(null);
    clearPointerLongReadyTimer(direction);

    if (item.label === "Delete" && item.longAction) {
      pointerLongReadyTimerRef.current[direction] = setTimeout(() => {
        delete pointerLongReadyTimerRef.current[direction];
        setPointerLongReadyDirection(direction);
      }, 1500);
    }
  };

  const finishPointerPress = (
    event: ReactPointerEvent<HTMLButtonElement>,
    item: RadialItem
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const startedAt = pointerStartRef.current[item.direction];
    delete pointerStartRef.current[item.direction];
    clearPointerLongReadyTimer(item.direction);
    setPointerDirection(null);
    setPointerLongReadyDirection(null);

    if (startedAt === undefined || isResting) return;

    const duration = Date.now() - startedAt;

    if (duration >= 1500 && item.longAction) {
      suppressClickUntilRef.current[item.direction] = Date.now() + 1000;
      item.longAction();
    }
  };

  const cancelPointerPress = (direction: Direction) => {
    delete pointerStartRef.current[direction];
    clearPointerLongReadyTimer(direction);
    setPointerDirection(null);
    setPointerLongReadyDirection(null);
  };

  const activeKeyboardItem =
    !dynamicOverlay && activeDirection
      ? items.find((candidate) => candidate.direction === activeDirection)
      : undefined;
  const keyboardCanPrepareClear =
    activeKeyboardItem?.label === "Delete" && Boolean(activeKeyboardItem.longAction);

  useEffect(() => {
    if (
      !activeDirection ||
      !isBlinkPressed ||
      isResting ||
      !keyboardCanPrepareClear
    ) {
      setKeyboardLongReadyDirection(null);
      return;
    }

    const direction = activeDirection;
    const timer = setTimeout(() => {
      setKeyboardLongReadyDirection(direction);
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [
    activeDirection,
    isBlinkPressed,
    isResting,
    keyboardCanPrepareClear,
  ]);

  const renderDwellProgress = (key: number) => (
    <span className="pointer-events-none absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-teal-100/80">
      <span
        key={key}
        className="block h-full origin-left bg-teal-600"
        style={{ animation: `glimDwellProgress ${dwellMs}ms linear forwards` }}
      />
    </span>
  );

  const renderDirectionalSlot = (
    direction: Direction,
    sizeClass: string
  ) => {
    const item = items.find((candidate) => candidate.direction === direction);

    if (!item) {
      return (
        <div
          key={direction}
          className={`${sizeClass} ${styles.emptySlot}`}
        />
      );
    }

    const isKeyboardActive = !dynamicOverlay && activeDirection === direction;
    const isPointerActive = pointerDirection === direction;
    const isHoverDwell = hoverDwellDirection === direction;
    const isActive = isKeyboardActive || isPointerActive || isHoverDwell;
    const isConfirming = isKeyboardActive && isBlinkPressed;
    const isClearReady =
      pointerLongReadyDirection === direction ||
      keyboardLongReadyDirection === direction;
    const showKeyboardDwell =
      enableDwellSelection &&
      !dynamicOverlay &&
      isKeyboardActive &&
      !isBlinkPressed &&
      !isResting;

    return (
      <button
        key={direction}
        ref={element => { slotRefs.current[direction] = element; }}
        type="button"
        disabled={isResting}
        onClick={() => {
          clearHoverDwell();
          const suppressUntil = suppressClickUntilRef.current[item.direction] ?? 0;
          if (Date.now() < suppressUntil) return;
          item.action();
        }}
        onPointerEnter={(event) => startHoverDwell(event, item)}
        onPointerLeave={() => clearHoverDwell()}
        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) =>
          handlePointerDown(event, item)
        }
        onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) =>
          finishPointerPress(event, item)
        }
        onPointerCancel={() => cancelPointerPress(item.direction)}
        onContextMenu={(event) => event.preventDefault()}
        data-tone={item.tone ?? "normal"}
        data-active={isActive && !isResting}
        data-confirming={(isConfirming || isPointerActive) && !isResting}
        data-clear={isClearReady && !isResting}
        className={
          styles.slot + " relative flex " + sizeClass + " min-w-0 touch-manipulation select-none flex-col items-center justify-center overflow-hidden p-2 text-center sm:p-4 disabled:cursor-not-allowed disabled:opacity-30"
        }
      >
        <span className={styles.slotLabel}>
          {item.label === "Home" && <InterfaceIcon name="home" className="inline-block align-middle mr-2" />}{item.label}
        </span>

        {item.helper && (
          <span
            className={styles.slotHelper}
          >
            {item.helper}
          </span>
        )}

        {(isHoverDwell || showKeyboardDwell) &&
          renderDwellProgress(
            isHoverDwell ? hoverDwellKey : hoverDwellKey + 10000 + direction.charCodeAt(0)
          )}
      </button>
    );
  };

  const renderDynamicOverlay = () => {
    if (!dynamicOverlay) return null;

    return (
      <>
        <button
          type="button"
          aria-label="Close letter group"
          onClick={dynamicOverlay.onDismiss}
          className="absolute inset-0 z-40 rounded-3xl bg-slate-900/10 backdrop-blur-[1px]"
        />

        <div
          ref={wheelRef}
          className={
            styles.initialWheel
          }
        >
          <svg width="0" height="0" aria-hidden="true"><defs><clipPath id="initial-sector" clipPathUnits="objectBoundingBox"><path d="M .22 .13 A .465 .465 0 0 1 .78 .13 Q .80 .15 .78 .18 L .64 .35 Q .62 .37 .60 .36 A .18 .18 0 0 0 .40 .36 Q .38 .37 .36 .35 L .22 .18 Q .20 .15 .22 .13 Z" /></clipPath></defs></svg>
          <button
            type="button"
            onClick={dynamicOverlay.onDismiss}
            className={styles.initialWheelCenter}
          >
            {dynamicOverlay.title}
          </button>

          {dynamicOverlay.options.map((option) => {
            const isKeyboardActive = activeDirection === option.direction;
            const isHover = overlayHoverDirection === option.direction;
            const isPressed = overlayPressedDirection === option.direction;
            const isActive = isKeyboardActive || isHover || isPressed;
            const showKeyboardDwell =
              enableDwellSelection &&
              isKeyboardActive &&
              !isBlinkPressed &&
              !isResting;

            return (
              <button
                key={`${dynamicOverlay.title}-${option.direction}-${option.label}`}
                type="button"
                disabled={isResting}
                onClick={() => {
                  clearOverlayHoverDwell();
                  const suppressUntil =
                    overlaySuppressClickUntilRef.current[option.direction] ?? 0;
                  if (Date.now() < suppressUntil) return;
                  option.action();
                }}
                onPointerEnter={(event) => startOverlayHoverDwell(event, option)}
                onPointerLeave={() => clearOverlayHoverDwell()}
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse" && event.button !== 0) return;
                  clearOverlayHoverDwell();
                  overlayPointerStartRef.current[option.direction] = Date.now();
                  setOverlayPressedDirection(option.direction);
                }}
                onPointerUp={(event) => {
                  if (event.pointerType === "mouse" && event.button !== 0) return;
                  const startedAt = overlayPointerStartRef.current[option.direction];
                  delete overlayPointerStartRef.current[option.direction];
                  setOverlayPressedDirection(null);
                  if (startedAt === undefined || isResting) return;
                  const duration = Date.now() - startedAt;
                  if (duration >= 1500 && option.longAction) {
                    overlaySuppressClickUntilRef.current[option.direction] =
                      Date.now() + 1000;
                    option.longAction();
                  }
                }}
                onPointerCancel={() => {
                  delete overlayPointerStartRef.current[option.direction];
                  setOverlayPressedDirection(null);
                  clearOverlayHoverDwell();
                }}
                onContextMenu={(event) => event.preventDefault()}
                className={styles.initialSector}
                data-direction={option.direction}
                data-active={isActive}
              >
                <span className={styles.initialSectorContent}><span className={styles.initialSectorLabel}>{option.label}</span>
                {option.helper && (
                  <span
                    className={
                      "mt-0.5 max-w-[90%] truncate text-sm " +
                      (isActive ? "text-teal-100" : "text-slate-400")
                    }
                  >
                    {option.helper}
                  </span>
                )}
                {(isHover || showKeyboardDwell) && <span key={overlayDwellKey} className={styles.initialProgress} style={{ animation: `glimDwellProgress ${dwellMs}ms linear forwards` }} />}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const centerIsPressed = !activeDirection && isBlinkPressed;

  return (
    <div ref={padRef} className={"relative " + styles.pad}>
      <div className="space-y-2 sm:space-y-3">
        {layoutMode === "8" ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {renderDirectionalSlot("nw", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            {renderDirectionalSlot("n", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            {renderDirectionalSlot("ne", "min-h-[clamp(4.25rem,11vh,6rem)]")}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(4.25rem,0.85fr)_minmax(0,2.3fr)_minmax(4.25rem,0.85fr)] gap-2 sm:gap-3">
            <div />
            {renderDirectionalSlot("n", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            <div />
          </div>
        )}

        <div className="grid grid-cols-[minmax(4.25rem,0.85fr)_minmax(0,2.3fr)_minmax(4.25rem,0.85fr)] items-stretch gap-2 sm:gap-3">
          {renderDirectionalSlot("w", "min-h-[clamp(11rem,42vh,19rem)]")}

          <button
            type="button"
            onClick={() => {
              if (Date.now() < centerSuppressClickUntilRef.current) return;
              onCenter();
            }}
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              centerPointerStartRef.current = Date.now();
            }}
            onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;

              const startedAt = centerPointerStartRef.current;
              centerPointerStartRef.current = null;

              if (startedAt === null) return;

              const duration = Date.now() - startedAt;

              if (duration >= 1500 && onCenterLong) {
                centerSuppressClickUntilRef.current = Date.now() + 1000;
                onCenterLong();
              }
            }}
            onPointerCancel={() => {
              centerPointerStartRef.current = null;
            }}
            onContextMenu={(event) => event.preventDefault()}
            data-resting={isResting}
            data-speaking={isSpeaking}
            data-pressed={centerIsPressed}
            className={styles.center + " relative flex min-h-[clamp(11rem,42vh,19rem)] min-w-0 touch-manipulation select-none flex-col items-center justify-center overflow-hidden px-3 py-5 text-center sm:px-5 sm:py-7"}
          >
            {isSpeaking && !isResting && (
              <div
                key={speechAnimationKey}
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-teal-400/60 to-transparent"
                style={{
                  animation: `optitalkSpeechSweep ${speakingDurationMs}ms linear forwards`,
                }}
              />
            )}

            <div className="relative z-10 flex w-full flex-col items-center">
              <span className={styles.centerBadge}>{isResting ? "Take a break" : isSpeaking ? "Speaking" : centerTitle}</span>
              <div className={styles.centerText}>{isResting ? "Rest mode is on." : centerText}</div>
              {isResting ? <span className={styles.centerHint}>Resume</span> : !isSpeaking && centerHelper ? <span className={styles.centerHint}>{centerHelper}</span> : null}
            </div>
          </button>

          {renderDirectionalSlot("e", "min-h-[clamp(11rem,42vh,19rem)]")}
        </div>

        {layoutMode === "8" ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {renderDirectionalSlot("sw", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            {renderDirectionalSlot("s", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            {renderDirectionalSlot("se", "min-h-[clamp(4.25rem,11vh,6rem)]")}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(4.25rem,0.85fr)_minmax(0,2.3fr)_minmax(4.25rem,0.85fr)] gap-2 sm:gap-3">
            <div />
            {renderDirectionalSlot("s", "min-h-[clamp(4.25rem,11vh,6rem)]")}
            <div />
          </div>
        )}
      </div>

      {renderDynamicOverlay()}
    </div>
  );
}


