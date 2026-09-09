"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Screen =
  | "home"
  | "manual"
  | "category-menu"
  | "category"
  | "free-input";

type InputMode = "initial" | "direct" | "english-initial";
type InitialStage = "groups" | "letters" | "suggestions";
type EnglishInitialStage = "groups" | "group4-subgroups" | "letters" | "suggestions";

type InputSegmentType = "literal" | "ko-initial" | "en-initial";
type InputSegment = { type: InputSegmentType; text: string };

type DirectStage =
  | "root"
  | "initial-groups"
  | "initial-letters"
  | "vowel-groups"
  | "vowel-letters"
  | "final-groups"
  | "final-letters"
  | "english-groups"
  | "english-group4-subgroups"
  | "english-letters"
  | "suggestions";

type Direction = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";
type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

type Category = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  phrases: string[];
};

type RadialItem = {
  direction: Direction;
  label: string;
  helper?: string;
  action: () => void;
  longAction?: () => void;
  tone?: "normal" | "primary" | "danger";
};

type SyllableState = {
  initial: string;
  vowel: string;
  final: string;
};

const EMPTY_SYLLABLE: SyllableState = {
  initial: "",
  vowel: "",
  final: "",
};

const CATEGORIES: Category[] = [
  {
    id: "food",
    title: "식사 · 음료",
    subtitle: "배고픔, 갈증, 식사 요청",
    icon: "🥣",
    phrases: [
      "배고파요.",
      "물 주세요.",
      "식사하고 싶어요.",
      "목이 말라요.",
      "천천히 주세요.",
      "지금은 먹고 싶지 않아요.",
    ],
  },
  {
    id: "symptom",
    title: "증상 · 상태",
    subtitle: "통증과 불편감 표현",
    icon: "🩺",
    phrases: [
      "아파요.",
      "머리가 아파요.",
      "어지러워요.",
      "숨쉬기가 불편해요.",
      "흡인이 필요해요.",
      "자세를 바꿔주세요.",
    ],
  },
  {
    id: "emotion",
    title: "감정 표현",
    subtitle: "기분과 정서 표현",
    icon: "🙂",
    phrases: [
      "기뻐요.",
      "불안해요.",
      "무서워요.",
      "답답해요.",
      "외로워요.",
      "고마워요.",
    ],
  },
  {
    id: "answer",
    title: "예 · 아니오",
    subtitle: "빠르고 간단한 응답",
    icon: "✓",
    phrases: [
      "네.",
      "아니오.",
      "맞아요.",
      "괜찮아요.",
      "잘 모르겠어요.",
      "다시 말씀해 주세요.",
    ],
  },
  {
    id: "favorite",
    title: "즐겨찾기",
    subtitle: "자주 사용하는 표현",
    icon: "★",
    phrases: [
      "보호자를 불러주세요.",
      "간호사 선생님을 불러주세요.",
      "자세를 바꿔주세요.",
      "조명을 꺼주세요.",
      "TV를 켜주세요.",
      "잠시 쉬고 싶어요.",
    ],
  },
  {
    id: "gesture",
    title: "커스텀 제스처",
    subtitle: "등록된 빠른 동작",
    icon: "◉",
    phrases: [
      "도와주세요.",
      "잠시 기다려주세요.",
      "네, 맞아요.",
      "아니오.",
      "다시 말씀해 주세요.",
      "휴식하고 싶어요.",
    ],
  },
];

const EMERGENCY_MESSAGES = [
  "숨쉬기가 너무 힘들어요.",
  "흡인이 필요해요.",
  "보호자를 바로 불러주세요.",
] as const;

const INITIAL_GROUP_MAP = {
  "ㄱ": ["ㄱ", "ㅋ", "ㄴ", "ㄹ"],
  "ㅁ": ["ㅁ", "ㅂ", "ㅍ", "ㄷ"],
  "ㅅ": ["ㅅ", "ㅈ", "ㅊ", "ㅌ"],
  "ㅇ": ["ㅇ", "ㅎ"],
} as const;

type InitialGroup = keyof typeof INITIAL_GROUP_MAP;

const VOWEL_GROUP_MAP = {
  "ㅡ": ["ㅡ", "ㅗ", "ㅜ", "ㅘ", "ㅝ", "ㅙ", "ㅞ"],
  "ㅣ": ["ㅣ", "ㅓ", "ㅏ", "ㅔ", "ㅐ"],
  "ㅛ": ["ㅛ", "ㅠ", "ㅚ", "ㅟ", "ㅢ"],
  "ㅕ": ["ㅕ", "ㅑ", "ㅒ", "ㅖ"],
} as const;

type VowelGroup = keyof typeof VOWEL_GROUP_MAP;

const FINAL_GROUP_MAP = {
  "ㄴ": ["ㄴ", "ㄹ", "ㅁ", "ㄱ", "ㄲ", "ㄵ", "ㄶ", "ㄺ", "ㄻ"],
  "ㅂ": ["ㅂ", "ㅅ", "ㅆ", "ㅇ", "ㄷ", "ㅄ", "ㄼ", "ㄽ", "ㄾ"],
  "ㅈ": ["ㅈ", "ㅍ", "ㅊ", "ㄳ", "ㄿ", "ㅀ"],
  "ㅋ": ["ㅋ", "ㅌ", "ㅎ"],
} as const;

type FinalGroup = keyof typeof FINAL_GROUP_MAP;

const ENGLISH_GROUP_MAP = {
  Group1: ["E", "T", "A", "O", "I"],
  Group2: ["N", "S", "H", "R", "D"],
  Group3: ["L", "C", "U", "M", "W"],
  Group4: ["X", "Q", "Z", "B", "V", "K", "J", "F", "G", "Y", "P"],
} as const;

const ENGLISH_GROUP4_SUBGROUP_MAP = {
  "X · Q · Z": ["X", "Q", "Z"],
  "B · V · K · J": ["B", "V", "K", "J"],
  "F · G · Y · P": ["F", "G", "Y", "P"],
} as const;

type EnglishGroup = keyof typeof ENGLISH_GROUP_MAP;
type EnglishGroup4Subgroup = keyof typeof ENGLISH_GROUP4_SUBGROUP_MAP;

const DOUBLE_CONSONANT_MAP: Record<string, string> = {
  "ㅅ": "ㅆ",
  "ㅈ": "ㅉ",
  "ㅂ": "ㅃ",
  "ㄷ": "ㄸ",
  "ㄱ": "ㄲ",
};

const INITIAL_SENTENCE_MAP: Record<string, string[]> = {
  "ㅁㅇㄴㅁㅁㅅㄱㅅㅇㅇ": [
    "물이 너무 마시고 싶어요.",
    "물을 너무 마시고 싶어요.",
    "물을 너무 마시기 싫어요.",
    "물이 너무 무섭고 싫어요.",
    "말이 너무 무섭고 싫어요.",
    "문이 너무 무섭고 싫어요.",
  ],
};

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const JUNGSEONG = [
  "ㅏ",
  "ㅐ",
  "ㅑ",
  "ㅒ",
  "ㅓ",
  "ㅔ",
  "ㅕ",
  "ㅖ",
  "ㅗ",
  "ㅘ",
  "ㅙ",
  "ㅚ",
  "ㅛ",
  "ㅜ",
  "ㅝ",
  "ㅞ",
  "ㅟ",
  "ㅠ",
  "ㅡ",
  "ㅢ",
  "ㅣ",
];

const JONGSEONG = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

const SLOT_ORDER: Array<Direction | "center"> = [
  "nw",
  "n",
  "ne",
  "w",
  "center",
  "e",
  "sw",
  "s",
  "se",
];

const INPUT_DIRECTION_ORDER: Direction[] = ["nw", "n", "ne", "w"];
const SIX_DIRECTION_ORDER: Direction[] = ["nw", "n", "ne", "w", "e", "sw"];

const DIRECTION_LABEL: Record<Direction, string> = {
  nw: "왼쪽 위",
  n: "위",
  ne: "오른쪽 위",
  w: "왼쪽",
  e: "오른쪽",
  sw: "왼쪽 아래",
  s: "아래",
  se: "오른쪽 아래",
};

const DIRECTION_KEY_LABEL: Record<Direction, string> = {
  nw: "↑ + ←",
  n: "↑",
  ne: "↑ + →",
  w: "←",
  e: "→",
  sw: "↓ + ←",
  s: "↓",
  se: "↓ + →",
};



function appendInputSegment(segments: InputSegment[], type: InputSegmentType, text: string): InputSegment[] {
  if (!text) return segments;
  const next = [...segments];
  const last = next[next.length - 1];
  if (last && last.type === type) {
    next[next.length - 1] = { ...last, text: last.text + text };
  } else {
    next.push({ type, text });
  }
  return next;
}

function deleteLastInputSegmentCharacter(segments: InputSegment[]): InputSegment[] {
  if (segments.length === 0) return segments;
  const next = [...segments];
  const last = next[next.length - 1];
  const chars = Array.from(last.text);
  chars.pop();
  if (chars.length === 0) next.pop();
  else next[next.length - 1] = { ...last, text: chars.join("") };
  return next;
}

function renderLiteralSegment(text: string): ReactNode {
  const parts = text.split(/([A-Za-z][A-Za-z0-9'’.-]*)/g);
  return parts.map((part, index) =>
    /^[A-Za-z][A-Za-z0-9'’.-]*$/.test(part) ? (
      <span key={index} className="underline decoration-2 underline-offset-4">{part}</span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function renderInputSegments(segments: InputSegment[]): ReactNode {
  return segments.map((segment, index) => (
    <span key={`${segment.type}-${index}`}>
      {segment.type === "literal" ? renderLiteralSegment(segment.text) : segment.text}
    </span>
  ));
}

function getSpeechLanguage(text: string): "ko-KR" | "en-US" {
  const hangul = (text.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) ?? []).length;
  const english = (text.match(/[A-Za-z]/g) ?? []).length;
  return english > hangul ? "en-US" : "ko-KR";
}

function composeSyllable(syllable: SyllableState): string {
  if (!syllable.initial && !syllable.vowel && !syllable.final) {
    return "";
  }

  if (!syllable.initial || !syllable.vowel) {
    return syllable.initial + syllable.vowel + syllable.final;
  }

  const initialIndex = CHOSEONG.indexOf(syllable.initial);
  const vowelIndex = JUNGSEONG.indexOf(syllable.vowel);
  const finalIndex = JONGSEONG.indexOf(syllable.final);

  if (initialIndex === -1 || vowelIndex === -1 || finalIndex === -1) {
    return syllable.initial + syllable.vowel + syllable.final;
  }

  const unicode =
    0xac00 + initialIndex * 21 * 28 + vowelIndex * 28 + finalIndex;

  return String.fromCharCode(unicode);
}

function getDirectionFromKeys(keys: string[]): Direction | null {
  const up = keys.includes("ArrowUp");
  const down = keys.includes("ArrowDown");
  const left = keys.includes("ArrowLeft");
  const right = keys.includes("ArrowRight");

  if ((up && down) || (left && right)) {
    return null;
  }

  if (up && left) return "nw";
  if (up && right) return "ne";
  if (down && left) return "sw";
  if (down && right) return "se";
  if (up) return "n";
  if (down) return "s";
  if (left) return "w";
  if (right) return "e";

  return null;
}

function HomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-manipulation rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700"
    >
      ← 홈으로
    </button>
  );
}

function RadialPad({
  items,
  activeDirection,
  isResting,
  isBlinkPressed,
  centerText,
  onCenter,
  onCenterLong,
  centerTitle = "WORK / REST ZONE",
  centerHelper = "Space를 1.5초 이상 길게 눌러 휴식 전환",
  isSpeaking = false,
  speakingDurationMs = 2600,
  speechAnimationKey = 0,
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
}) {
  const pointerStartRef = useRef<Partial<Record<Direction, number>>>({});
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

    const direction = item.direction;
    pointerStartRef.current[direction] = Date.now();
    setPointerDirection(direction);
    setPointerLongReadyDirection(null);
    clearPointerLongReadyTimer(direction);

    // 지우기 버튼을 1.5초 이상 누르면 즉시 실행하지 않고,
    // "놓으면 전체 삭제" 준비 상태만 빨간색으로 표시합니다.
    if (item.label === "지우기" && item.longAction) {
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

    // 짧은 탭은 브라우저의 표준 click 이벤트에서 처리합니다.
    // 1.5초 이상 누른 경우에는 누르고 있는 동안 빨간색 준비 상태가 보이고,
    // 손가락/마우스를 떼는 순간 longAction이 실행됩니다.
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

  const activeKeyboardItem = activeDirection
    ? items.find((candidate) => candidate.direction === activeDirection)
    : undefined;
  const keyboardCanPrepareClear =
    activeKeyboardItem?.label === "지우기" && Boolean(activeKeyboardItem.longAction);

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

  const renderDirectionalSlot = (
    direction: Direction,
    sizeClass: string
  ) => {
    const item = items.find((candidate) => candidate.direction === direction);

    if (!item) {
      return (
        <div
          key={direction}
          className={`${sizeClass} rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50`}
        />
      );
    }

    const isKeyboardActive = activeDirection === direction;
    const isPointerActive = pointerDirection === direction;
    const isActive = isKeyboardActive || isPointerActive;
    const isConfirming = isKeyboardActive && isBlinkPressed;
    const isClearReady =
      pointerLongReadyDirection === direction ||
      keyboardLongReadyDirection === direction;

    const normalClass =
      item.tone === "primary"
        ? "border-blue-500 bg-blue-600 text-white"
        : item.tone === "danger"
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-slate-200 bg-white text-slate-900";

    return (
      <button
        key={direction}
        type="button"
        disabled={isResting}
        onClick={() => {
          const suppressUntil = suppressClickUntilRef.current[item.direction] ?? 0;
          if (Date.now() < suppressUntil) return;
          item.action();
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) =>
          handlePointerDown(event, item)
        }
        onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) =>
          finishPointerPress(event, item)
        }
        onPointerCancel={() => cancelPointerPress(item.direction)}
        onContextMenu={(event) => event.preventDefault()}
        className={
          `flex ${sizeClass} min-w-0 touch-manipulation select-none flex-col items-center justify-center rounded-2xl border-2 p-1.5 text-center transition sm:p-2.5 disabled:cursor-not-allowed disabled:opacity-30 ` +
          (isClearReady && !isResting
            ? "scale-110 border-red-700 bg-red-600 text-white shadow-xl"
            : isActive && !isResting
              ? isConfirming || isPointerActive
                ? "scale-110 border-blue-700 bg-blue-700 text-white shadow-xl"
                : "scale-105 border-blue-600 bg-blue-600 text-white shadow-lg"
              : normalClass)
        }
      >
        <span className="break-words text-[clamp(0.82rem,3.6vw,1.125rem)] font-bold leading-tight">
          {item.label}
        </span>

        {item.helper && (
          <span
            className={
              "mt-1 break-words text-[clamp(0.62rem,2.5vw,0.75rem)] leading-tight sm:mt-1.5 " +
              (isClearReady
                ? "text-red-100"
                : isActive
                  ? "text-blue-100"
                  : item.tone === "primary"
                    ? "text-blue-100"
                    : "text-slate-500")
            }
          >
            {item.helper}
          </span>
        )}

        <span
          className={
            "mt-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:mt-2 sm:px-2 sm:py-1 sm:text-[10px] " +
            (isActive
              ? "bg-white/20 text-white"
              : item.tone === "primary"
                ? "bg-white/15 text-white"
                : "bg-slate-100 text-slate-500")
          }
        >
          {DIRECTION_KEY_LABEL[direction]}
        </span>
      </button>
    );
  };

  const centerIsPressed = !activeDirection && isBlinkPressed;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* 폭은 화면에 따라 자연스럽게 줄고, 높이는 viewport 높이에 맞춰 조절됩니다. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {renderDirectionalSlot("nw", "min-h-[clamp(4.25rem,11vh,6rem)]")}
        {renderDirectionalSlot("n", "min-h-[clamp(4.25rem,11vh,6rem)]")}
        {renderDirectionalSlot("ne", "min-h-[clamp(4.25rem,11vh,6rem)]")}
      </div>

      {/* 세로 화면에서는 좁게, 가로 화면에서는 여유 있게 늘어나는 3열 구조 */}
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
          className={
            "relative flex min-h-[clamp(11rem,42vh,19rem)] min-w-0 touch-manipulation select-none flex-col items-center justify-center overflow-hidden rounded-3xl border-2 px-3 py-5 text-center transition sm:px-5 sm:py-7 md:px-8 md:py-10 " +
            (isResting
              ? "border-emerald-500 bg-emerald-600 text-white"
              : centerIsPressed
                ? "scale-[1.03] border-blue-600 bg-slate-800 text-white shadow-xl"
                : isSpeaking
                  ? "border-blue-500 bg-blue-100 text-slate-950"
                  : "border-slate-700 bg-slate-900 text-white")
          }
        >
          {isSpeaking && !isResting && (
            <div
              key={speechAnimationKey}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent"
              style={{
                animation: `optitalkSpeechSweep ${speakingDurationMs}ms linear forwards`,
              }}
            />
          )}

          <div className="relative z-10 flex w-full flex-col items-center">
            <span
              className={
                "rounded-full px-3 py-1 text-xs font-bold tracking-wide " +
                (isResting
                  ? "bg-white/20 text-white"
                  : isSpeaking
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-slate-200")
              }
            >
              {isResting ? "REST MODE" : isSpeaking ? "SPEAKING" : centerTitle}
            </span>

            <p className="mt-3 max-w-full whitespace-pre-line break-words text-[clamp(1.15rem,5vw,2.25rem)] font-bold leading-relaxed sm:mt-5">
              {isResting ? "휴식 중입니다." : centerText}
            </p>

            <span
              className={
                "mt-3 break-words text-[clamp(0.62rem,2.5vw,0.875rem)] font-semibold sm:mt-5 " +
                (isResting
                  ? "text-emerald-100"
                  : isSpeaking
                    ? "text-blue-800"
                    : "text-slate-300")
              }
            >
              {isResting
                ? "Space를 1.5초 이상 길게 눌러 휴식 해제 · 클릭 가능"
                : isSpeaking
                  ? "음성 출력이 끝나면 Work Zone이 초기화됩니다."
                  : centerHelper + " · 클릭 가능"}
            </span>
          </div>
        </button>

        {renderDirectionalSlot("e", "min-h-[clamp(11rem,42vh,19rem)]")}
      </div>

      {/* 하단 3개 칸도 동일한 너비 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {renderDirectionalSlot("sw", "min-h-[clamp(4.25rem,11vh,6rem)]")}
        {renderDirectionalSlot("s", "min-h-[clamp(4.25rem,11vh,6rem)]")}
        {renderDirectionalSlot("se", "min-h-[clamp(4.25rem,11vh,6rem)]")}
      </div>
    </div>
  );
}


export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [inputMode, setInputMode] = useState<InputMode>("initial");
  const [committedInputSegments, setCommittedInputSegments] = useState<InputSegment[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [recommendedSentences, setRecommendedSentences] = useState<string[]>([]);
  const [isRecommendationLoading, setIsRecommendationLoading] =
    useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [isResting, setIsResting] = useState(false);

  const [initialStage, setInitialStage] = useState<InitialStage>("groups");
  const [selectedInitialGroup, setSelectedInitialGroup] =
    useState<InitialGroup | null>(null);
  const [initialInput, setInitialInput] = useState("");

  const [englishInitialStage, setEnglishInitialStage] = useState<EnglishInitialStage>("groups");
  const [englishInitialInput, setEnglishInitialInput] = useState("");
  const [selectedEnglishInitialGroup, setSelectedEnglishInitialGroup] = useState<EnglishGroup | null>(null);
  const [selectedEnglishInitialGroup4Subgroup, setSelectedEnglishInitialGroup4Subgroup] = useState<EnglishGroup4Subgroup | null>(null);
  const [englishInitialPage, setEnglishInitialPage] = useState(0);

  const [directStage, setDirectStage] = useState<DirectStage>("root");
  const [selectedDirectInitialGroup, setSelectedDirectInitialGroup] =
    useState<InitialGroup | null>(null);
  const [selectedVowelGroup, setSelectedVowelGroup] =
    useState<VowelGroup | null>(null);
  const [selectedFinalGroup, setSelectedFinalGroup] =
    useState<FinalGroup | null>(null);
  const [selectedEnglishGroup, setSelectedEnglishGroup] =
    useState<EnglishGroup | null>(null);
  const [selectedEnglishGroup4Subgroup, setSelectedEnglishGroup4Subgroup] =
    useState<EnglishGroup4Subgroup | null>(null);
  const [vowelPage, setVowelPage] = useState(0);
  const [finalPage, setFinalPage] = useState(0);
  const [englishPage, setEnglishPage] = useState(0);
  const [directText, setDirectText] = useState("");
  const [syllable, setSyllable] = useState<SyllableState>(EMPTY_SYLLABLE);

  const [heldArrowKeys, setHeldArrowKeys] = useState<string[]>([]);
  const [isBlinkPressed, setIsBlinkPressed] = useState(false);
  const [manualSelectedDirection, setManualSelectedDirection] =
    useState<Direction | null>(null);
  const [manualMessage, setManualMessage] = useState(
    "방향키를 순서대로 누른 뒤 Space를 눌러보세요."
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingDurationMs, setSpeakingDurationMs] = useState(2600);
  const [speechAnimationKey, setSpeechAnimationKey] = useState(0);
  const speakingTimerRef = useRef<number | null>(null);
  const convergeSpeakRef = useRef<(text: string) => void>(() => undefined);

  const activeDirection = useMemo(
    () => getDirectionFromKeys(heldArrowKeys),
    [heldArrowKeys]
  );

  const directOutput = directText + composeSyllable(syllable);
  const committedInputText = useMemo(
    () => committedInputSegments.map((segment) => segment.text).join(""),
    [committedInputSegments]
  );

  const currentInputSegments = useMemo(() => {
    if (inputMode === "initial" && initialInput) {
      return appendInputSegment(committedInputSegments, "ko-initial", initialInput);
    }
    if (inputMode === "english-initial" && englishInitialInput) {
      return appendInputSegment(committedInputSegments, "en-initial", englishInitialInput);
    }
    if (inputMode === "direct" && directOutput) {
      return appendInputSegment(committedInputSegments, "literal", directOutput);
    }
    return committedInputSegments;
  }, [committedInputSegments, directOutput, englishInitialInput, initialInput, inputMode]);

  const currentInputText =
    committedInputText +
    (inputMode === "initial"
      ? initialInput
      : inputMode === "english-initial"
        ? englishInitialInput
        : directOutput);

  const initialFallbackSuggestions = useMemo(() => {
    const matched = INITIAL_SENTENCE_MAP[currentInputText];

    if (matched) return matched;

    if (!currentInputText) {
      return [
        "물을 주세요.",
        "자세를 바꿔주세요.",
        "보호자를 불러주세요.",
        "잠시 쉬고 싶어요.",
        "숨쉬기가 불편해요.",
        "도와주셔서 감사해요.",
      ];
    }

    return [
      currentInputText + "에 맞는 추천 문장 1",
      currentInputText + "에 맞는 추천 문장 2",
      currentInputText + "에 맞는 추천 문장 3",
      currentInputText + "에 맞는 추천 문장 4",
      currentInputText + "에 맞는 추천 문장 5",
      currentInputText + "에 맞는 추천 문장 6",
    ];
  }, [currentInputText]);

  const directFallbackSuggestions = useMemo(() => {
    const text = currentInputText.trim();

    if (!text) {
      return [
        "물을 주세요.",
        "자세를 바꿔주세요.",
        "보호자를 불러주세요.",
        "잠시 쉬고 싶어요.",
        "조명을 꺼주세요.",
        "도와주셔서 감사해요.",
      ];
    }

    return [
      text,
      text + " 주세요.",
      text + " 도와주세요.",
      "지금 " + text,
      "저는 " + text,
      text + " 감사합니다.",
    ];
  }, [currentInputText]);

  useEffect(() => {
    setRecommendedSentences([]);
    setRecommendationError("");
  }, [currentInputText, inputMode]);

  const speak = (text: string) => {
    if (!text || typeof window === "undefined") return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLanguage(text);
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
  };

  const clearCurrentWorkZone = () => {
    setSelectedSentence("");
    setRecommendedSentences([]);
    setRecommendationError("");
    setIsRecommendationLoading(false);

    if (screen === "category") {
      return;
    }

    if (screen === "free-input" && inputMode === "initial") {
      setCommittedInputSegments([]);
      setInitialInput("");
      setInitialStage("groups");
      setSelectedInitialGroup(null);
      setDirectText("");
      setSyllable(EMPTY_SYLLABLE);
      return;
    }

    if (screen === "free-input" && inputMode === "english-initial") {
      setCommittedInputSegments([]);
      setInitialInput("");
      setEnglishInitialInput("");
      setEnglishInitialStage("groups");
      setSelectedEnglishInitialGroup(null);
      setSelectedEnglishInitialGroup4Subgroup(null);
      setEnglishInitialPage(0);
      setDirectText("");
      setSyllable(EMPTY_SYLLABLE);
      return;
    }

    if (screen === "free-input" && inputMode === "direct") {
      setCommittedInputSegments([]);
      setInitialInput("");
      setDirectText("");
      setSyllable(EMPTY_SYLLABLE);
      setDirectStage("root");
      setSelectedDirectInitialGroup(null);
      setSelectedVowelGroup(null);
      setSelectedFinalGroup(null);
      setSelectedEnglishGroup(null);
      setSelectedEnglishGroup4Subgroup(null);
      setVowelPage(0);
      setFinalPage(0);
      setEnglishPage(0);
    }
  };

  const convergeSpeak = (text: string) => {
    const trimmed = text.trim();

    if (!trimmed || typeof window === "undefined") return;

    if (speakingTimerRef.current !== null) {
      window.clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    window.speechSynthesis.cancel();

    const duration = Math.min(
      4600,
      Math.max(2200, 1900 + trimmed.length * 55)
    );

    const startedAt = Date.now();
    let completed = false;

    setSpeakingDurationMs(duration);
    setSpeechAnimationKey((previous) => previous + 1);
    setIsSpeaking(true);

    const completeAfterMinimumDuration = () => {
      if (completed) return;
      completed = true;

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, duration - elapsed);

      speakingTimerRef.current = window.setTimeout(() => {
        setIsSpeaking(false);
        clearCurrentWorkZone();
        speakingTimerRef.current = null;
      }, remaining);
    };

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = getSpeechLanguage(trimmed);
    utterance.rate = 0.9;
    utterance.onend = completeAfterMinimumDuration;
    utterance.onerror = completeAfterMinimumDuration;

    window.speechSynthesis.speak(utterance);

    speakingTimerRef.current = window.setTimeout(
      completeAfterMinimumDuration,
      duration + 1800
    );
  };

  convergeSpeakRef.current = convergeSpeak;

  const stopSpeech = () => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();

      if (speakingTimerRef.current !== null) {
        window.clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    }

    setIsSpeaking(false);
  };

  const resetAllInput = () => {
    setCommittedInputSegments([]);
    setSelectedSentence("");
    setRecommendedSentences([]);
    setRecommendationError("");
    setIsRecommendationLoading(false);
    setInitialInput("");
    setInitialStage("groups");
    setSelectedInitialGroup(null);
    setEnglishInitialInput("");
    setEnglishInitialStage("groups");
    setSelectedEnglishInitialGroup(null);
    setSelectedEnglishInitialGroup4Subgroup(null);
    setEnglishInitialPage(0);

    setDirectText("");
    setSyllable(EMPTY_SYLLABLE);
    setDirectStage("root");
    setSelectedDirectInitialGroup(null);
    setSelectedVowelGroup(null);
    setSelectedFinalGroup(null);
    setSelectedEnglishGroup(null);
    setSelectedEnglishGroup4Subgroup(null);
    setVowelPage(0);
    setFinalPage(0);
    setEnglishPage(0);
  };

  const goHome = () => {
    stopSpeech();
    resetAllInput();
    setActiveCategory(null);
    setIsResting(false);
    setManualSelectedDirection(null);
    setScreen("home");
  };

  const openFreeInput = () => {
    stopSpeech();
    resetAllInput();
    setInputMode("initial");
    setIsResting(false);
    setScreen("free-input");
  };

  const switchToDirectInput = () => {
    if (inputMode === "initial" && initialInput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "ko-initial", initialInput));
    }
    if (inputMode === "english-initial" && englishInitialInput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "en-initial", englishInitialInput));
    }

    setInitialInput("");
    setEnglishInitialInput("");
    setSelectedInitialGroup(null);
    setInitialStage("groups");
    setEnglishInitialStage("groups");
    setSelectedEnglishInitialGroup(null);
    setSelectedEnglishInitialGroup4Subgroup(null);
    setEnglishInitialPage(0);
    setInputMode("direct");
    setDirectStage("root");
    setSelectedSentence("");
  };

  const switchToInitialInput = () => {
    if (inputMode === "direct" && directOutput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "literal", directOutput));
    }
    if (inputMode === "english-initial" && englishInitialInput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "en-initial", englishInitialInput));
    }

    setDirectText("");
    setSyllable(EMPTY_SYLLABLE);
    setEnglishInitialInput("");
    setSelectedDirectInitialGroup(null);
    setSelectedVowelGroup(null);
    setSelectedFinalGroup(null);
    setSelectedEnglishGroup(null);
    setSelectedEnglishGroup4Subgroup(null);
    setSelectedEnglishInitialGroup(null);
    setSelectedEnglishInitialGroup4Subgroup(null);
    setVowelPage(0);
    setFinalPage(0);
    setEnglishPage(0);
    setEnglishInitialPage(0);
    setInputMode("initial");
    setInitialStage("groups");
    setSelectedSentence("");
  };

  const switchToEnglishInitialInput = () => {
    if (inputMode === "direct" && directOutput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "literal", directOutput));
    }
    if (inputMode === "initial" && initialInput) {
      setCommittedInputSegments((previous) => appendInputSegment(previous, "ko-initial", initialInput));
    }

    setDirectText("");
    setSyllable(EMPTY_SYLLABLE);
    setInitialInput("");
    setSelectedDirectInitialGroup(null);
    setSelectedVowelGroup(null);
    setSelectedFinalGroup(null);
    setSelectedEnglishGroup(null);
    setSelectedEnglishGroup4Subgroup(null);
    setSelectedInitialGroup(null);
    setVowelPage(0);
    setFinalPage(0);
    setEnglishPage(0);
    setInputMode("english-initial");
    setEnglishInitialStage("groups");
    setSelectedEnglishInitialGroup(null);
    setSelectedEnglishInitialGroup4Subgroup(null);
    setEnglishInitialPage(0);
    setSelectedSentence("");
  };

  const commitCurrentSyllable = () => {
    const current = composeSyllable(syllable);

    if (current) {
      setDirectText((previous) => previous + current);
      setSyllable(EMPTY_SYLLABLE);
    }
  };

  const addInitialToDirect = (letter: string) => {
    setSelectedSentence("");

    if (syllable.initial && syllable.vowel) {
      setDirectText((previous) => previous + composeSyllable(syllable));
      setSyllable({ initial: letter, vowel: "", final: "" });
      return;
    }

    setSyllable({ initial: letter, vowel: syllable.vowel, final: "" });
  };

  const addVowelToDirect = (letter: string) => {
    setSelectedSentence("");

    if (syllable.vowel) {
      setDirectText((previous) => previous + composeSyllable(syllable));
      setSyllable({ initial: "ㅇ", vowel: letter, final: "" });
      return;
    }

    setSyllable({ initial: syllable.initial || "ㅇ", vowel: letter, final: "" });
  };

  const addFinalToDirect = (letter: string) => {
    setSelectedSentence("");

    if (syllable.initial && syllable.vowel) {
      setSyllable({ ...syllable, final: letter });
      return;
    }

    setDirectText((previous) => previous + letter);
  };

  const addEnglishLetter = (letter: string) => {
    setSelectedSentence("");
    const current = composeSyllable(syllable);
    setDirectText((previous) => previous + current + letter);
    setSyllable(EMPTY_SYLLABLE);
  };

  const addSpace = () => {
    setSelectedSentence("");
    const current = composeSyllable(syllable);
    setDirectText((previous) => previous + current + " ");
    setSyllable(EMPTY_SYLLABLE);
  };

  const deleteDirectCharacter = () => {
    setSelectedSentence("");

    if (syllable.final) {
      setSyllable({ ...syllable, final: "" });
      return;
    }

    if (syllable.vowel) {
      setSyllable({ ...syllable, vowel: "" });
      return;
    }

    if (syllable.initial) {
      setSyllable(EMPTY_SYLLABLE);
      return;
    }

    if (directText) {
      setDirectText((previous) => previous.slice(0, -1));
      return;
    }

    setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
  };

  const requestRecommendations = async (
    input: string,
    mode: "initial" | "direct" | "mixed",
    segments: InputSegment[] = currentInputSegments
  ): Promise<string[]> => {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input,
        mode,
        segments,
      }),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      const message =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : "추천 문장을 불러오지 못했습니다.";

      throw new Error(message);
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("suggestions" in data) ||
      !Array.isArray(data.suggestions)
    ) {
      throw new Error("추천 문장 형식이 올바르지 않습니다.");
    }

    const suggestions = data.suggestions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (suggestions.length !== 6) {
      throw new Error("추천 문장 6개를 받지 못했습니다.");
    }

    return suggestions;
  };

  const loadInitialRecommendations = async () => {
    const input = currentInputText.trim();

    if (!input) {
      setRecommendationError("먼저 초성을 한 글자 이상 입력해 주세요.");
      setRecommendedSentences([]);
      return;
    }

    if (isRecommendationLoading) return;

    setSelectedSentence("");
    setRecommendedSentences([]);
    setRecommendationError("");
    setIsRecommendationLoading(true);
    setInitialStage("suggestions");

    try {
      const suggestions = await requestRecommendations(input, "mixed", currentInputSegments);
      setRecommendedSentences(suggestions);
    } catch (error) {
      setRecommendedSentences(initialFallbackSuggestions);
      setRecommendationError(
        error instanceof Error
          ? `${error.message} 기본 추천 문장을 표시합니다.`
          : "Gemini 추천에 실패해 기본 추천 문장을 표시합니다."
      );
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const loadDirectRecommendations = async () => {
    const input = currentInputText.trim();

    if (!input) {
      setRecommendationError("먼저 글자나 문장을 입력해 주세요.");
      setRecommendedSentences([]);
      return;
    }

    if (isRecommendationLoading) return;

    setSelectedSentence("");
    setRecommendedSentences([]);
    setRecommendationError("");
    setIsRecommendationLoading(true);
    setDirectStage("suggestions");

    try {
      const suggestions = await requestRecommendations(input, "mixed", currentInputSegments);
      setRecommendedSentences(suggestions);
    } catch (error) {
      setRecommendedSentences(directFallbackSuggestions);
      setRecommendationError(
        error instanceof Error
          ? `${error.message} 기본 추천 문장을 표시합니다.`
          : "Gemini 추천에 실패해 기본 추천 문장을 표시합니다."
      );
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const loadEnglishInitialRecommendations = async () => {
    const input = currentInputText.trim();
    if (!input) {
      setRecommendationError("먼저 영어 초성을 한 글자 이상 입력해 주세요.");
      setRecommendedSentences([]);
      return;
    }
    if (isRecommendationLoading) return;

    setSelectedSentence("");
    setRecommendedSentences([]);
    setRecommendationError("");
    setIsRecommendationLoading(true);
    setEnglishInitialStage("suggestions");

    try {
      const suggestions = await requestRecommendations(input, "mixed", currentInputSegments);
      setRecommendedSentences(suggestions);
    } catch (error) {
      setRecommendedSentences([
        "I want water.",
        "I need help.",
        "Please stay here.",
        "I feel uncomfortable.",
        "Can you help me?",
        "Thank you for helping me.",
      ]);
      setRecommendationError(
        error instanceof Error
          ? `${error.message} 기본 영어 추천 문장을 표시합니다.`
          : "Gemini 추천에 실패해 기본 영어 추천 문장을 표시합니다."
      );
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const selectInitialLetter = (letter: string, longBlink: boolean) => {
    const selected =
      longBlink && DOUBLE_CONSONANT_MAP[letter]
        ? DOUBLE_CONSONANT_MAP[letter]
        : letter;

    setInitialInput((previous) => previous + selected);
    setSelectedSentence("");
    setSelectedInitialGroup(null);
    setInitialStage("groups");
  };

  const selectEnglishInitialLetter = (letter: string) => {
    // English 자유 입력과 동일하게, 한 글자를 고른 뒤에도
    // 현재 ESCG 알파벳 선택 화면을 유지합니다.
    setEnglishInitialInput((previous) => previous + letter.toUpperCase());
    setSelectedSentence("");
  };

  const selectDirectInitialLetter = (letter: string, longBlink: boolean) => {
    const selected =
      longBlink && DOUBLE_CONSONANT_MAP[letter]
        ? DOUBLE_CONSONANT_MAP[letter]
        : letter;

    addInitialToDirect(selected);
    setSelectedDirectInitialGroup(null);

    // 초성을 선택하면 다음 입력은 반드시 중성이므로
    // 모음 그룹 선택 화면으로 자동 이동합니다.
    setDirectStage("vowel-groups");
  };

  const commitSyllableAndReturnToStart = () => {
    const current = composeSyllable(syllable);

    if (current) {
      setDirectText((previous) => previous + current);
    }

    setSyllable(EMPTY_SYLLABLE);
    setSelectedSentence("");
    setSelectedDirectInitialGroup(null);

    // 받침 없이 다음 글자로 넘어갈 때는 English 선택 화면을 거치지 않고
    // 곧바로 다음 한글 글자의 초성 그룹 선택 화면으로 이동합니다.
    setDirectStage("initial-groups");
  };

  const commitFinalAndReturnToStart = (letter: string) => {
    const completedSyllable = composeSyllable({
      ...syllable,
      final: letter,
    });

    setDirectText((previous) => previous + completedSyllable);
    setSyllable(EMPTY_SYLLABLE);
    setSelectedSentence("");
    setSelectedFinalGroup(null);
    setFinalPage(0);
    setDirectStage("root");
  };

  const handleManualDirection = (direction: Direction, longBlink: boolean) => {
    setManualSelectedDirection(direction);
    setManualMessage(
      DIRECTION_LABEL[direction] +
        " 시선 + " +
        (longBlink ? "Long blink" : "눈 깜빡임") +
        "이 감지되었습니다."
    );
  };

  let radialItems: RadialItem[] = [];

  if (screen === "home") {
    radialItems = [
      {
        direction: "n",
        label: "사용설명서",
        helper: "Demo 입력 연습",
        action: () => {
          setManualMessage("방향키를 순서대로 누른 뒤 Space를 눌러보세요.");
          setManualSelectedDirection(null);
          setIsResting(false);
          setScreen("manual");
        },
      },
      {
        direction: "w",
        label: "카테고리 선택",
        helper: "자주 사용하는 표현",
        action: () => {
          setSelectedSentence("");
          setIsResting(false);
          setScreen("category-menu");
        },
      },
      {
        direction: "e",
        label: "자유 입력",
        helper: "초성 입력부터 시작",
        action: openFreeInput,
        tone: "primary",
      },
      {
        direction: "sw",
        label: EMERGENCY_MESSAGES[0],
        helper: "긴급 문장 즉시 출력",
        action: () => speak(EMERGENCY_MESSAGES[0]),
        tone: "danger",
      },
      {
        direction: "s",
        label: EMERGENCY_MESSAGES[1],
        helper: "긴급 문장 즉시 출력",
        action: () => speak(EMERGENCY_MESSAGES[1]),
        tone: "danger",
      },
      {
        direction: "se",
        label: EMERGENCY_MESSAGES[2],
        helper: "긴급 문장 즉시 출력",
        action: () => speak(EMERGENCY_MESSAGES[2]),
        tone: "danger",
      },
    ];
  }

  if (screen === "manual") {
    radialItems = (Object.keys(DIRECTION_LABEL) as Direction[]).map(
      (direction) => ({
        direction,
        label: DIRECTION_LABEL[direction],
        helper:
          direction === "nw" ||
          direction === "ne" ||
          direction === "sw" ||
          direction === "se"
            ? DIRECTION_KEY_LABEL[direction] + " · 순서대로 누른 뒤 Space"
            : DIRECTION_KEY_LABEL[direction] + " · 누른 뒤 Space",
        action: () => handleManualDirection(direction, false),
        longAction: () => handleManualDirection(direction, true),
        tone: manualSelectedDirection === direction ? "primary" : "normal",
      })
    );
  }

  if (screen === "category-menu") {
    radialItems = CATEGORIES.map((category, index) => ({
      direction: SIX_DIRECTION_ORDER[index],
      label: category.icon + " " + category.title,
      helper: category.subtitle,
      action: () => {
        setActiveCategory(category);
        setSelectedSentence("");
        setScreen("category");
      },
    }));

    radialItems.push(
      {
        direction: "s",
        label: "홈",
        helper: "첫 화면으로",
        action: goHome,
      },
      {
        direction: "se",
        label: "자유 입력",
        helper: "초성 입력 시작",
        action: openFreeInput,
        tone: "primary",
      }
    );
  }

  if (screen === "category" && activeCategory) {
    radialItems = activeCategory.phrases.map((phrase, index) => ({
      direction: SIX_DIRECTION_ORDER[index],
      label: phrase,
      helper:
        selectedSentence === phrase
          ? "선택됨 · 다시 선택하면 말하기"
          : "문장 선택",
      action: () => {
        if (selectedSentence === phrase) {
          speak(phrase);
        } else {
          setSelectedSentence(phrase);
        }
      },
      longAction: () => speak(phrase),
      tone: selectedSentence === phrase ? "primary" : "normal",
    }));

    radialItems.push(
      {
        direction: "s",
        label: "뒤로",
        helper: "카테고리 목록",
        action: () => {
          setSelectedSentence("");
          setScreen("category-menu");
        },
      },
      {
        direction: "se",
        label: "말하기",
        helper: "Enter · Converge",
        action: () => speak(selectedSentence),
        tone: "primary",
      }
    );
  }

  if (screen === "free-input" && inputMode === "initial") {
    if (initialStage === "groups") {
      const groups = Object.keys(INITIAL_GROUP_MAP) as InitialGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group + " 그룹",
        helper: INITIAL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedInitialGroup(group);
          setInitialStage("letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "초성 한 글자 삭제",
          action: () => {
            if (initialInput) {
              setInitialInput((previous) => previous.slice(0, -1));
            } else {
              setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            }
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "완전 자유 입력",
          helper: "현재 문장을 유지하고 자모 입력",
          action: switchToDirectInput,
          tone: "primary",
        },
        {
          direction: "s",
          label: "문장 추천",
          helper: "입력한 초성으로 시작하는 문장 완성",
          action: () => {
            void loadInitialRecommendations();
          },
        },
        {
          direction: "se",
          label: "홈",
          helper: "첫 화면으로",
          action: goHome,
        }
      );
    }

    if (initialStage === "letters" && selectedInitialGroup) {
      const letters = INITIAL_GROUP_MAP[selectedInitialGroup];

      radialItems = letters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper: DOUBLE_CONSONANT_MAP[letter]
          ? "짧게: " + letter + " · 1.5초 이상: " + DOUBLE_CONSONANT_MAP[letter]
          : "짧게 눌러 선택",
        action: () => selectInitialLetter(letter, false),
        longAction: DOUBLE_CONSONANT_MAP[letter]
          ? () => selectInitialLetter(letter, true)
          : undefined,
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "초성 한 글자 삭제",
          action: () => {
            if (initialInput) {
              setInitialInput((previous) => previous.slice(0, -1));
            } else {
              setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            }
          },
        },
        {
          direction: "sw",
          label: "그룹으로",
          helper: "이전 단계",
          action: () => {
            setSelectedInitialGroup(null);
            setInitialStage("groups");
          },
        },
        {
          direction: "s",
          label: "문장 추천",
          helper: "추천 문장 보기",
          action: () => {
            void loadInitialRecommendations();
          },
        },
        {
          direction: "se",
          label: "완전 자유 입력",
          helper: "현재 문장을 유지하고 자모 입력",
          action: switchToDirectInput,
          tone: "primary",
        }
      );
    }

    if (initialStage === "suggestions") {
      const suggestionsToShow =
        recommendedSentences.length === 6
          ? recommendedSentences
          : initialFallbackSuggestions;

      radialItems = isRecommendationLoading
        ? []
        : suggestionsToShow.map((sentence, index) => ({
        direction: SIX_DIRECTION_ORDER[index],
        label: sentence,
        helper:
          selectedSentence === sentence
            ? "선택됨 · 다시 선택하면 말하기"
            : "추천 문장",
        action: () => {
          if (selectedSentence === sentence) {
            speak(sentence);
          } else {
            setSelectedSentence(sentence);
          }
        },
        longAction: () => speak(sentence),
        tone: selectedSentence === sentence ? "primary" : "normal",
      }));

      radialItems.push(
        {
          direction: "s",
          label: "초성 입력",
          helper: "입력 화면으로",
          action: () => {
            setSelectedSentence("");
            setRecommendedSentences([]);
            setRecommendationError("");
            setInitialStage("groups");
          },
        },
        {
          direction: "se",
          label: isRecommendationLoading
            ? "생성 중..."
            : selectedSentence
              ? "말하기"
              : "추천 새로고침",
          helper: isRecommendationLoading
            ? "Gemini 응답 대기"
            : selectedSentence
              ? "Enter · Converge"
              : "새 문장 6개 생성",
          action: () => {
            if (isRecommendationLoading) return;

            if (selectedSentence) {
              speak(selectedSentence);
            } else {
              void loadInitialRecommendations();
            }
          },
          tone: selectedSentence ? "primary" : "normal",
        }
      );
    }
  }

  if (screen === "free-input" && inputMode === "english-initial") {
    // English 초성 입력과 English 자유 입력은 같은 ESCG 그룹/알파벳 배치를 사용합니다.
    // 차이는 선택한 알파벳을 "단어의 첫 글자"로 저장하느냐, 실제 철자로 저장하느냐뿐입니다.
    if (englishInitialStage === "groups") {
      const groups = Object.keys(ENGLISH_GROUP_MAP) as EnglishGroup[];
      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group,
        helper:
          group === "Group4"
            ? "XQZ · BVKJ · FGYP의 3개 하위 그룹"
            : ENGLISH_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedEnglishInitialGroup(group);
          setSelectedEnglishInitialGroup4Subgroup(null);
          setEnglishInitialPage(0);
          setEnglishInitialStage(group === "Group4" ? "group4-subgroups" : "letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "영어 초성 한 글자 삭제",
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "English 자유 입력",
          helper: "고유명사를 직접 입력",
          action: switchToDirectInput,
        },
        {
          direction: "s",
          label: "한글 초성 입력",
          helper: "현재 입력을 유지하고 전환",
          action: switchToInitialInput,
        },
        {
          direction: "se",
          label: "추천",
          helper: "영어 초성으로 문장 완성",
          action: () => void loadEnglishInitialRecommendations(),
          tone: "primary",
        }
      );
    }

    if (englishInitialStage === "group4-subgroups") {
      const subgroups = Object.keys(ENGLISH_GROUP4_SUBGROUP_MAP) as EnglishGroup4Subgroup[];
      radialItems = subgroups.map((subgroup, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: subgroup,
        helper: "Group4 하위 그룹",
        action: () => {
          setSelectedEnglishInitialGroup("Group4");
          setSelectedEnglishInitialGroup4Subgroup(subgroup);
          setEnglishInitialPage(0);
          setEnglishInitialStage("letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "영어 초성 한 글자 삭제",
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "그룹으로",
          helper: "ESCG 그룹 선택",
          action: () => {
            setSelectedEnglishInitialGroup(null);
            setSelectedEnglishInitialGroup4Subgroup(null);
            setEnglishInitialStage("groups");
          },
        },
        {
          direction: "s",
          label: "English 자유 입력",
          helper: "고유명사를 직접 입력",
          action: switchToDirectInput,
        },
        {
          direction: "se",
          label: "추천",
          helper: "영어 초성으로 문장 완성",
          action: () => void loadEnglishInitialRecommendations(),
        }
      );
    }

    if (englishInitialStage === "letters" && selectedEnglishInitialGroup) {
      const letters =
        selectedEnglishInitialGroup === "Group4" && selectedEnglishInitialGroup4Subgroup
          ? ENGLISH_GROUP4_SUBGROUP_MAP[selectedEnglishInitialGroup4Subgroup]
          : ENGLISH_GROUP_MAP[selectedEnglishInitialGroup];

      // Group1~3은 5글자이므로 네 글자 + "다음" 대신
      // 다섯 번째 글자(I 등)를 우하단 버튼에 바로 표시합니다.
      const primaryLetters = letters.slice(0, 4);
      const fifthLetter = letters.length === 5 ? letters[4] : undefined;

      radialItems = primaryLetters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper:
          selectedEnglishInitialGroup === "Group4" && selectedEnglishInitialGroup4Subgroup
            ? selectedEnglishInitialGroup4Subgroup
            : selectedEnglishInitialGroup,
        action: () => selectEnglishInitialLetter(letter),
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "영어 초성 한 글자 삭제",
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "English 자유 입력",
          helper: "고유명사를 직접 입력",
          action: switchToDirectInput,
        },
        {
          direction: "s",
          label: "그룹으로",
          helper:
            selectedEnglishInitialGroup === "Group4"
              ? "Group4 하위 그룹 선택"
              : "ESCG 그룹 선택",
          action: () => {
            setEnglishInitialPage(0);
            if (selectedEnglishInitialGroup === "Group4") {
              setSelectedEnglishInitialGroup4Subgroup(null);
              setEnglishInitialStage("group4-subgroups");
            } else {
              setSelectedEnglishInitialGroup(null);
              setEnglishInitialStage("groups");
            }
          },
        },
        fifthLetter
          ? {
              direction: "se",
              label: fifthLetter,
              helper: selectedEnglishInitialGroup,
              action: () => selectEnglishInitialLetter(fifthLetter),
            }
          : {
              direction: "se",
              label: "추천",
              helper: "영어 초성으로 문장 완성",
              action: () => void loadEnglishInitialRecommendations(),
            }
      );
    }

    if (englishInitialStage === "suggestions") {
      const englishFallback = [
        "I want water.", "I need help.", "Please stay here.",
        "I feel uncomfortable.", "Can you help me?", "Thank you for helping me."
      ];
      const suggestionsToShow = recommendedSentences.length === 6 ? recommendedSentences : englishFallback;
      radialItems = isRecommendationLoading ? [] : suggestionsToShow.map((sentence, index) => ({
        direction: SIX_DIRECTION_ORDER[index],
        label: sentence,
        helper: selectedSentence === sentence ? "선택됨 · 다시 선택하면 말하기" : "추천 문장",
        action: () => {
          if (selectedSentence === sentence) speak(sentence);
          else setSelectedSentence(sentence);
        },
        longAction: () => speak(sentence),
        tone: selectedSentence === sentence ? "primary" : "normal",
      }));
      radialItems.push(
        {
          direction: "s",
          label: "English 초성 입력",
          helper: "입력 화면으로",
          action: () => {
            setSelectedSentence("");
            setRecommendedSentences([]);
            setRecommendationError("");
            setEnglishInitialStage("groups");
          },
        },
        {
          direction: "se",
          label: isRecommendationLoading ? "생성 중..." : selectedSentence ? "말하기" : "추천 새로고침",
          helper: isRecommendationLoading ? "Gemini 응답 대기" : selectedSentence ? "Enter · Converge" : "새 문장 6개 생성",
          action: () => {
            if (isRecommendationLoading) return;
            if (selectedSentence) speak(selectedSentence);
            else void loadEnglishInitialRecommendations();
          },
          tone: selectedSentence ? "primary" : "normal",
        }
      );
    }
  }

  if (screen === "free-input" && inputMode === "direct") {
    if (directStage === "root") {
      const hasInitial = Boolean(syllable.initial);
      const hasVowel = Boolean(syllable.vowel);

      if (!hasInitial) {
        // 새 글자를 시작할 때는 초성 또는 English만 먼저 보여줍니다.
        radialItems = [
          {
            direction: "n",
            label: "초성 자음",
            helper: "ㄱ · ㅁ · ㅅ · ㅇ",
            action: () => setDirectStage("initial-groups"),
          },
          {
            direction: "ne",
            label: "English 자유 입력",
            helper: "고유명사 · ESCG 그룹 입력",
            action: () => setDirectStage("english-groups"),
          },
          {
            direction: "w",
            label: "English 초성 입력",
            helper: "단어 첫 글자 · ESCG 그룹",
            action: switchToEnglishInitialInput,
            tone: "primary",
          },
          {
            direction: "e",
            label: "지우기",
            longAction: clearCurrentWorkZone,
            helper: "마지막 글자 삭제",
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 모드",
            helper: "현재 문장을 유지하고 초성 입력",
            action: switchToInitialInput,
          },
          {
            direction: "s",
            label: "띄어쓰기",
            helper: "공백 입력",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
            helper: "입력 문장 확장",
            action: () => {
              void loadDirectRecommendations();
            },
            tone: "primary",
          },
        ];
      } else if (!hasVowel) {
        // 초성이 입력된 상태에서는 중성 입력만 진행합니다.
        radialItems = [
          {
            direction: "nw",
            label: "중성 모음",
            helper: "ㅡ · ㅣ · ㅛ · ㅕ",
            action: () => setDirectStage("vowel-groups"),
            tone: "primary",
          },
          {
            direction: "e",
            label: "지우기",
            longAction: clearCurrentWorkZone,
            helper: "입력한 초성 삭제",
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 다시 선택",
            helper: "초성 그룹으로",
            action: () => setDirectStage("initial-groups"),
          },
          {
            direction: "s",
            label: "띄어쓰기",
            helper: "현재 입력 확정",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
            helper: "입력 문장 확장",
            action: () => {
              void loadDirectRecommendations();
            },
          },
        ];
      } else {
        // 초성과 중성이 완성되면 받침 선택 여부를 결정합니다.
        radialItems = [
          {
            direction: "n",
            label: "받침 자음",
            helper: "ㄴ · ㅂ · ㅈ · ㅋ",
            action: () => setDirectStage("final-groups"),
            tone: "primary",
          },
          {
            direction: "ne",
            label: "다음 글자",
            helper: "받침 없이 글자 확정",
            action: commitSyllableAndReturnToStart,
          },
          {
            direction: "e",
            label: "지우기",
            longAction: clearCurrentWorkZone,
            helper: "입력한 모음 삭제",
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 모드",
            helper: "현재 문장을 유지하고 초성 입력",
            action: switchToInitialInput,
          },
          {
            direction: "s",
            label: "띄어쓰기",
            helper: "현재 글자 확정 후 공백",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
            helper: "입력 문장 확장",
            action: () => {
              void loadDirectRecommendations();
            },
            tone: "primary",
          },
        ];
      }
    }

    if (directStage === "initial-groups") {
      const groups = Object.keys(INITIAL_GROUP_MAP) as InitialGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group + " 그룹",
        helper: INITIAL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedDirectInitialGroup(group);
          setDirectStage("initial-letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          helper: "자유 입력 메뉴",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "현재 글자 확정",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문장 추천 보기",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "initial-letters" && selectedDirectInitialGroup) {
      const letters = INITIAL_GROUP_MAP[selectedDirectInitialGroup];

      radialItems = letters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper: DOUBLE_CONSONANT_MAP[letter]
          ? "짧게: " + letter + " · 1.5초 이상: " + DOUBLE_CONSONANT_MAP[letter]
          : "초성 선택",
        action: () => selectDirectInitialLetter(letter, false),
        longAction: DOUBLE_CONSONANT_MAP[letter]
          ? () => selectDirectInitialLetter(letter, true)
          : undefined,
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "그룹으로",
          helper: "초성 그룹 선택",
          action: () => {
            setSelectedDirectInitialGroup(null);
            setDirectStage("initial-groups");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "현재 글자 확정",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문장 추천 보기",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "vowel-groups") {
      const groups = Object.keys(VOWEL_GROUP_MAP) as VowelGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group + " 그룹",
        helper: VOWEL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedVowelGroup(group);
          setVowelPage(0);
          setDirectStage("vowel-letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          helper: "자유 입력 메뉴",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "현재 글자 확정",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문장 추천 보기",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "vowel-letters" && selectedVowelGroup) {
      const letters = VOWEL_GROUP_MAP[selectedVowelGroup];
      const pageSize = 4;
      const pageStart = vowelPage * pageSize;
      const pageLetters = letters.slice(pageStart, pageStart + pageSize);
      const hasNext = pageStart + pageSize < letters.length;

      // 모음이 정확히 5개인 그룹(ㅣ, ㅛ)은 English 그룹과 동일하게
      // 첫 네 모음 + 다섯 번째 모음을 우하단에 바로 표시합니다.
      const fifthVowel = vowelPage === 0 && letters.length === 5 ? letters[4] : undefined;

      radialItems = pageLetters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper: "중성 모음",
        action: () => {
          addVowelToDirect(letter);
          setSelectedVowelGroup(null);
          setVowelPage(0);
          setDirectStage("root");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: vowelPage > 0 ? "이전" : "띄어쓰기",
          helper: vowelPage > 0 ? "이전 모음" : "현재 글자 확정",
          action: () => {
            if (vowelPage > 0) {
              setVowelPage((previous) => Math.max(previous - 1, 0));
            } else {
              addSpace();
            }
          },
        },
        {
          direction: "s",
          label: "그룹으로",
          helper: "모음 그룹 선택",
          action: () => {
            setSelectedVowelGroup(null);
            setVowelPage(0);
            setDirectStage("vowel-groups");
          },
        },
        fifthVowel
          ? {
              direction: "se",
              label: fifthVowel,
              helper: "중성 모음",
              action: () => {
                addVowelToDirect(fifthVowel);
                setSelectedVowelGroup(null);
                setVowelPage(0);
                setDirectStage("root");
              },
            }
          : {
              direction: "se",
              label: hasNext ? "다음" : "추천",
              helper: hasNext ? "다음 모음" : "문장 추천",
              action: () => {
                if (hasNext) {
                  setVowelPage((previous) => previous + 1);
                } else {
                  void loadDirectRecommendations();
                }
              },
            }
      );
    }

    if (directStage === "final-groups") {
      const groups = Object.keys(FINAL_GROUP_MAP) as FinalGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group + " 그룹",
        helper: FINAL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedFinalGroup(group);
          setFinalPage(0);
          setDirectStage("final-letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          helper: "자유 입력 메뉴",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "현재 글자 확정",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문맥 기반 문장 추천",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "final-letters" && selectedFinalGroup) {
      const letters = FINAL_GROUP_MAP[selectedFinalGroup];
      const pageSize = 4;
      const pageStart = finalPage * pageSize;
      const pageLetters = letters.slice(pageStart, pageStart + pageSize);
      const hasNext = pageStart + pageSize < letters.length;

      radialItems = pageLetters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper: letter.length > 1 ? "문맥 기반 복합 받침" : "받침 선택",
        action: () => {
          // 받침까지 선택되면 현재 글자를 완성하고
          // 다음 글자의 초성 또는 English 선택 화면으로 돌아갑니다.
          commitFinalAndReturnToStart(letter);
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 자모 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: finalPage > 0 ? "이전" : "띄어쓰기",
          helper: finalPage > 0 ? "이전 받침" : "현재 글자 확정",
          action: () => {
            if (finalPage > 0) {
              setFinalPage((previous) => Math.max(previous - 1, 0));
            } else {
              addSpace();
            }
          },
        },
        {
          direction: "s",
          label: "그룹으로",
          helper: "받침 그룹 선택",
          action: () => {
            setSelectedFinalGroup(null);
            setFinalPage(0);
            setDirectStage("final-groups");
          },
        },
        {
          direction: "se",
          label: hasNext ? "다음" : "추천",
          helper: hasNext ? "다음 받침" : "문장 추천",
          action: () => {
            if (hasNext) {
              setFinalPage((previous) => previous + 1);
            } else {
              void loadDirectRecommendations();
            }
          },
        }
      );
    }

    if (directStage === "english-groups") {
      const groups = Object.keys(ENGLISH_GROUP_MAP) as EnglishGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group,
        helper:
          group === "Group4"
            ? "XQZ · BVKJ · FGYP의 3개 하위 그룹"
            : ENGLISH_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedEnglishGroup(group);
          setSelectedEnglishGroup4Subgroup(null);
          setEnglishPage(0);
          setDirectStage(
            group === "Group4"
              ? "english-group4-subgroups"
              : "english-letters"
          );
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 글자 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          helper: "자유 입력 메뉴",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "Space 입력",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문장 추천 보기",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "english-group4-subgroups") {
      const subgroupEntries = Object.keys(
        ENGLISH_GROUP4_SUBGROUP_MAP
      ) as EnglishGroup4Subgroup[];

      radialItems = subgroupEntries.map((subgroup, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: subgroup,
        helper: "Group4 하위 그룹",
        action: () => {
          setSelectedEnglishGroup("Group4");
          setSelectedEnglishGroup4Subgroup(subgroup);
          setEnglishPage(0);
          setDirectStage("english-letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 글자 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "그룹으로",
          helper: "ESCG 그룹 선택",
          action: () => {
            setSelectedEnglishGroup(null);
            setSelectedEnglishGroup4Subgroup(null);
            setDirectStage("english-groups");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          helper: "Space 입력",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          helper: "문장 추천 보기",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "english-letters" && selectedEnglishGroup) {
      const letters =
        selectedEnglishGroup === "Group4" && selectedEnglishGroup4Subgroup
          ? ENGLISH_GROUP4_SUBGROUP_MAP[selectedEnglishGroup4Subgroup]
          : ENGLISH_GROUP_MAP[selectedEnglishGroup];

      // English 초성 입력과 동일한 알파벳 배치를 사용합니다.
      // Group1~3의 다섯 번째 알파벳은 "다음"을 누르지 않고 우하단에 바로 표시합니다.
      const primaryLetters = letters.slice(0, 4);
      const fifthLetter = letters.length === 5 ? letters[4] : undefined;

      radialItems = primaryLetters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper:
          selectedEnglishGroup === "Group4" && selectedEnglishGroup4Subgroup
            ? selectedEnglishGroup4Subgroup
            : selectedEnglishGroup,
        action: () => addEnglishLetter(letter),
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          helper: "마지막 글자 삭제",
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "띄어쓰기",
          helper: "Space 입력",
          action: addSpace,
        },
        {
          direction: "s",
          label: "그룹으로",
          helper:
            selectedEnglishGroup === "Group4"
              ? "Group4 하위 그룹 선택"
              : "ESCG 그룹 선택",
          action: () => {
            setEnglishPage(0);

            if (selectedEnglishGroup === "Group4") {
              setSelectedEnglishGroup4Subgroup(null);
              setDirectStage("english-group4-subgroups");
            } else {
              setSelectedEnglishGroup(null);
              setDirectStage("english-groups");
            }
          },
        },
        fifthLetter
          ? {
              direction: "se",
              label: fifthLetter,
              helper: selectedEnglishGroup,
              action: () => addEnglishLetter(fifthLetter),
            }
          : {
              direction: "se",
              label: "추천",
              helper: "문장 추천",
              action: () => {
                void loadDirectRecommendations();
              },
            }
      );
    }

    if (directStage === "suggestions") {
      const suggestionsToShow =
        recommendedSentences.length === 6
          ? recommendedSentences
          : directFallbackSuggestions;

      radialItems = isRecommendationLoading
        ? []
        : suggestionsToShow.map((sentence, index) => ({
        direction: SIX_DIRECTION_ORDER[index],
        label: sentence,
        helper:
          selectedSentence === sentence
            ? "선택됨 · 다시 선택하면 말하기"
            : "추천 문장",
        action: () => {
          if (selectedSentence === sentence) {
            speak(sentence);
          } else {
            setSelectedSentence(sentence);
          }
        },
        longAction: () => speak(sentence),
        tone: selectedSentence === sentence ? "primary" : "normal",
      }));

      radialItems.push(
        {
          direction: "s",
          label: "자모 입력",
          helper: "입력 화면으로",
          action: () => {
            setSelectedSentence("");
            setRecommendedSentences([]);
            setRecommendationError("");
            setDirectStage("root");
          },
        },
        {
          direction: "se",
          label: isRecommendationLoading
            ? "생성 중..."
            : selectedSentence
              ? "말하기"
              : "추천 새로고침",
          helper: isRecommendationLoading
            ? "Gemini 응답 대기"
            : selectedSentence
              ? "Enter · Converge"
              : "새 문장 6개 생성",
          action: () => {
            if (isRecommendationLoading) return;

            if (selectedSentence) {
              speak(selectedSentence);
            } else {
              void loadDirectRecommendations();
            }
          },
          tone: selectedSentence ? "primary" : "normal",
        }
      );
    }
  }

  const radialItemsRef = useRef<RadialItem[]>(radialItems);
  const activeDirectionRef = useRef<Direction | null>(activeDirection);
  const isRestingRef = useRef(isResting);
  const screenRef = useRef(screen);
  const inputModeRef = useRef(inputMode);
  const selectedSentenceRef = useRef(selectedSentence);
  const directOutputRef = useRef(currentInputText);

  useEffect(() => {
    radialItemsRef.current = radialItems;
    activeDirectionRef.current = activeDirection;
    isRestingRef.current = isResting;
    screenRef.current = screen;
    inputModeRef.current = inputMode;
    selectedSentenceRef.current = selectedSentence;
    directOutputRef.current = currentInputText;
  });

  const blinkStartRef = useRef<number | null>(null);
  const restHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restHoldTriggeredRef = useRef(false);
  const directionSequenceRef = useRef<ArrowKey[]>([]);
  const blinkDirectionRef = useRef<Direction | null>(null);
  const directionClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearDirectionTimer = () => {
    if (directionClearTimerRef.current !== null) {
      clearTimeout(directionClearTimerRef.current);
      directionClearTimerRef.current = null;
    }
  };

  const clearRestHoldTimer = () => {
    if (restHoldTimerRef.current !== null) {
      clearTimeout(restHoldTimerRef.current);
      restHoldTimerRef.current = null;
    }
  };

  const clearDirectionSequence = () => {
    clearDirectionTimer();
    directionSequenceRef.current = [];
    setHeldArrowKeys([]);
  };

  const scheduleDirectionSequenceClear = () => {
    clearDirectionTimer();

    directionClearTimerRef.current = setTimeout(() => {
      directionClearTimerRef.current = null;
      directionSequenceRef.current = [];
      setHeldArrowKeys([]);
    }, 1500);
  };

  const appendDirectionKey = (key: ArrowKey) => {
    const previous = directionSequenceRef.current;
    let next: ArrowKey[];

    if (previous.length === 0) {
      next = [key];
    } else if (previous.length === 1) {
      const first = previous[0];

      if (first === key) {
        next = [key];
      } else {
        const candidate: ArrowKey[] = [first, key];
        const candidateDirection = getDirectionFromKeys(candidate);

        next = candidateDirection ? candidate : [key];
      }
    } else {
      next = [key];
    }

    directionSequenceRef.current = next;
    setHeldArrowKeys(next);

    // 마지막 방향키 입력 이후 1.5초 동안 새 입력이 없으면
    // 저장된 방향과 버튼 강조를 자동으로 해제합니다.
    scheduleDirectionSequenceClear();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();

        if (event.repeat) return;

        appendDirectionKey(event.key as ArrowKey);
        return;
      }

      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        blinkStartRef.current = Date.now();
        restHoldTriggeredRef.current = false;

        // Space도 새로운 입력이므로 선택 중에는
        // 1.5초 방향 초기화 타이머를 잠시 중단합니다.
        clearDirectionTimer();
        clearRestHoldTimer();

        // 방향키는 동시에 누르고 있을 필요가 없습니다.
        // 두 방향키가 순서대로 입력되어 대각선이 만들어졌다면,
        // 그 뒤 Space를 눌렀을 때 해당 모서리 버튼을 선택합니다.
        const direction = getDirectionFromKeys(directionSequenceRef.current);
        blinkDirectionRef.current = direction;

        // 방향 입력이 전혀 없는 정면 깜빡임에서만 1.5초 타이머를 시작합니다.
        // 타이머가 실제로 끝나기 전에는 휴식 모드가 절대 바뀌지 않습니다.
        if (!direction) {
          restHoldTimerRef.current = setTimeout(() => {
            restHoldTimerRef.current = null;
            restHoldTriggeredRef.current = true;

            const nextResting = !isRestingRef.current;
            setIsResting(nextResting);

            if (screenRef.current === "manual") {
              setManualMessage(
                nextResting
                  ? "Space를 1.5초 이상 눌러 휴식 모드에 들어갔습니다."
                  : "Space를 1.5초 이상 눌러 휴식 모드를 해제했습니다."
              );
            }
          }, 1500);
        }

        setIsBlinkPressed(true);
        return;
      }

      if (event.key === "Enter" && !event.repeat) {
        event.preventDefault();

        if (screenRef.current === "manual") {
          setManualMessage("Converge 동작이 감지되었습니다. Enter 입력입니다.");
          clearDirectionSequence();
          return;
        }

        const sentence = selectedSentenceRef.current;

        if (sentence) {
          convergeSpeakRef.current(sentence);
          clearDirectionSequence();
          return;
        }

        if (
          screenRef.current === "free-input" &&
          inputModeRef.current === "direct"
        ) {
          convergeSpeakRef.current(directOutputRef.current.trim());
          clearDirectionSequence();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();

        // 대각선 입력은 방향키를 순서대로 기억하므로,
        // 방향키를 떼어도 Space 입력 전까지 선택 방향을 유지합니다.
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();

        const startedAt = blinkStartRef.current;
        const duration = startedAt === null ? 0 : Date.now() - startedAt;
        const longBlink = duration >= 1500;

        blinkStartRef.current = null;
        setIsBlinkPressed(false);
        clearRestHoldTimer();

        const direction = blinkDirectionRef.current;
        blinkDirectionRef.current = null;

        if (!direction) {
          clearDirectionSequence();

          // 1.5초 타이머가 끝난 경우에만 이미 휴식 전환이 실행됩니다.
          // 짧게 누르고 뗀 Space는 아무 기능도 실행하지 않습니다.
          if (restHoldTriggeredRef.current) {
            restHoldTriggeredRef.current = false;
            return;
          }

          if (screenRef.current === "manual") {
            setManualMessage(
              "짧은 정면 깜빡임이 감지되었습니다. 휴식 전환은 Space를 1.5초 이상 길게 눌러주세요."
            );
          }

          return;
        }

        if (isRestingRef.current) {
          clearDirectionSequence();
          return;
        }

        const item = radialItemsRef.current.find(
          (candidate) => candidate.direction === direction
        );

        clearDirectionSequence();

        if (!item) return;

        if (longBlink && item.longAction) {
          item.longAction();
        } else {
          item.action();
        }
      }
    };

    const handleBlur = () => {
      clearDirectionSequence();
      clearRestHoldTimer();
      restHoldTriggeredRef.current = false;
      blinkDirectionRef.current = null;
      setIsBlinkPressed(false);
      blinkStartRef.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      clearDirectionTimer();
      clearRestHoldTimer();
    };
  }, []);

  useEffect(() => {
    clearDirectionSequence();
  }, [screen, initialStage, englishInitialStage, directStage, inputMode]);

  const statusBox = (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
      <span className="font-semibold">현재 방향:</span>{" "}
      {activeDirection ? DIRECTION_KEY_LABEL[activeDirection] : "정면"}
      {" · "}
      <span className="font-semibold">Blink:</span>{" "}
      {isBlinkPressed ? "감지됨" : "대기"}
      {" · "}
      <span className="font-semibold">상태:</span>{" "}
      {isResting ? "휴식" : "입력 가능"}
    </div>
  );

  if (screen === "home") {
    const categoryActive = activeDirection === "w";
    const inputActive = activeDirection === "e";
    const manualActive = activeDirection === "n";
    const emergencyDirections: Direction[] = ["sw", "s", "se"];

    const openManual = () => {
      setManualMessage("방향키를 순서대로 누른 뒤 Space를 눌러보세요.");
      setManualSelectedDirection(null);
      setIsResting(false);
      setScreen("manual");
    };

    const openCategoryMenu = () => {
      setSelectedSentence("");
      setIsResting(false);
      setScreen("category-menu");
    };

    const toggleRestFromHome = () => {
      setIsResting((previous) => !previous);
    };

    return (
      <main className="min-h-[100dvh] bg-slate-100 p-2 text-slate-900 sm:p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                EOG · EMG · LLM 기반 AAC
              </p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Glim-AAC</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                눈의 움직임으로 원하는 표현을 선택하세요.
              </p>
            </div>

            <button
              type="button"
              disabled={isResting}
              onClick={openManual}
              className={
                "rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-30 " +
                (manualActive
                  ? "scale-105 border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-400")
              }
            >
              Demo 사용설명서 · ↑
            </button>
          </header>

          {statusBox}

          <section className="mt-4 grid grid-cols-1 gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-5">
            <button
              type="button"
              disabled={isResting}
              onClick={openCategoryMenu}
              className={
                "min-h-44 touch-manipulation rounded-3xl border-2 p-5 text-left shadow-sm transition sm:min-h-64 sm:p-7 md:min-h-80 md:p-8 disabled:opacity-30 " +
                (categoryActive
                  ? "scale-105 border-blue-800 bg-blue-800 text-white shadow-xl"
                  : "border-blue-500 bg-blue-600 text-white hover:-translate-y-1 hover:bg-blue-700")
              }
            >
              <span
                className={
                  "flex h-16 w-16 items-center justify-center rounded-2xl text-4xl sm:h-20 sm:w-20 sm:rounded-3xl sm:text-5xl md:h-24 md:w-24 md:text-6xl " +
                  "bg-white/15"
                }
              >
                ◫
              </span>
              <p className="mt-6 text-2xl font-bold sm:mt-8 sm:text-3xl md:mt-10">카테고리 선택</p>
              <p
                className={
                  "mt-3 text-lg " +
                  "text-blue-100"
                }
              >
                왼쪽 방향키 + Space
              </p>
            </button>

            <button
              type="button"
              disabled={isResting}
              onClick={openFreeInput}
              className={
                "min-h-44 touch-manipulation rounded-3xl border-2 p-5 text-left text-white shadow-sm transition sm:min-h-64 sm:p-7 md:min-h-80 md:p-8 disabled:opacity-30 " +
                (inputActive
                  ? "scale-105 border-blue-800 bg-blue-800 shadow-xl"
                  : "border-blue-500 bg-blue-600 hover:-translate-y-1 hover:bg-blue-700")
              }
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl sm:h-20 sm:w-20 sm:rounded-3xl sm:text-5xl md:h-24 md:w-24 md:text-6xl">
                ⌨
              </span>
              <p className="mt-6 text-2xl font-bold sm:mt-8 sm:text-3xl md:mt-10">자유 입력</p>
              <p className="mt-3 text-lg text-blue-100">
                오른쪽 방향키 + Space
              </p>
            </button>
          </section>

          <section className="mt-6 rounded-3xl border-2 border-red-200 bg-red-50 p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-red-600">
                EMERGENCY EXPRESSIONS
              </p>
              <h2 className="mt-1 text-xl font-bold text-red-900">
                긴급 표현
              </h2>
              <p className="mt-1 text-sm text-red-700">
                고정 문장을 즉시 음성으로 출력합니다. 좌하단·하단·우하단 방향으로도 선택할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {EMERGENCY_MESSAGES.map((message, index) => {
                const direction = emergencyDirections[index];
                const isActive = activeDirection === direction;

                return (
                  <button
                    key={message}
                    type="button"
                    disabled={isResting}
                    onClick={() => speak(message)}
                    className={
                      "min-h-20 touch-manipulation rounded-2xl border-2 px-4 py-3 text-left font-bold transition sm:min-h-24 sm:py-4 disabled:opacity-30 " +
                      (isActive
                        ? "scale-105 border-red-800 bg-red-800 text-white shadow-lg"
                        : "border-red-500 bg-red-600 text-white hover:bg-red-700")
                    }
                  >
                    <span className="block text-base md:text-lg">{message}</span>
                    <span className="mt-2 block text-xs font-semibold text-red-100">
                      {DIRECTION_KEY_LABEL[direction]} + Space
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="button"
            onClick={toggleRestFromHome}
            className={
              "mt-6 w-full touch-manipulation rounded-2xl border-2 p-4 text-center font-semibold transition " +
              (isResting
                ? "border-emerald-500 bg-emerald-600 text-white"
                : !activeDirection && isBlinkPressed
                  ? "scale-[1.01] border-blue-500 bg-slate-800 text-white"
                  : "border-slate-700 bg-slate-900 text-white")
            }
          >
            {isResting
              ? "휴식 중 · Space를 1.5초 이상 길게 누르거나 클릭하여 해제"
              : "휴식 Zone · Space를 1.5초 이상 길게 누르거나 클릭"}
          </button>
        </div>
      </main>
    );
  }

  if (screen === "manual") {
    return (
      <main className="min-h-[100dvh] bg-slate-100 p-2 text-slate-900 sm:p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5 sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600">DEMO GUIDE</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Demo 사용설명서</h1>
              <p className="mt-2 text-sm text-slate-500">
                모바일에서는 화면의 버튼을 직접 터치해 선택할 수 있습니다.
              </p>
            </div>
            <HomeButton onClick={goHome} />
          </header>

          {statusBox}

          <section className="mt-3 sm:mt-5">
            <RadialPad
              items={radialItems}
              activeDirection={activeDirection}
              isResting={isResting}
              isBlinkPressed={isBlinkPressed}
              centerText={manualMessage}
              centerTitle="PRACTICE / REST ZONE"
              centerHelper="정면에서 Space를 1.5초 이상 길게 눌러 휴식 전환"
              onCenter={() => {
                const nextResting = !isResting;
                setIsResting(nextResting);
                setManualMessage(
                  nextResting
                    ? "가운데 Zone을 터치하거나 클릭해 휴식 모드에 들어갔습니다."
                    : "가운데 Zone을 터치하거나 클릭해 휴식 모드를 해제했습니다."
                );
              }}
              onCenterLong={() => {
                const nextResting = !isResting;
                setIsResting(nextResting);
                setManualMessage(
                  nextResting
                    ? "가운데 Zone을 길게 눌러 휴식 모드에 들어갔습니다."
                    : "가운데 Zone을 길게 눌러 휴식 모드를 해제했습니다."
                );
              }}
            />
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-blue-600">눈 깜빡임</p>
              <p className="mt-2 text-2xl font-bold">Space</p>
              <p className="mt-3 text-sm text-slate-500">
                한 방향은 방향키 1개를 누른 뒤 Space로 선택합니다. 대각선은
                두 방향키를 순서대로 누른 뒤 Space로 선택합니다.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-blue-600">Long blink</p>
              <p className="mt-2 text-2xl font-bold">Space 1.5초 이상</p>
              <p className="mt-3 text-sm text-slate-500">
                초성 입력에서 ㄱ·ㄷ·ㅂ·ㅅ·ㅈ을 각각 ㄲ·ㄸ·ㅃ·ㅆ·ㅉ으로
                입력합니다. 가운데 Work/Rest Zone에서는 방향 없이 1.5초 이상 길게 누르면 휴식 모드가 켜지거나 꺼집니다.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-blue-600">Converge</p>
              <p className="mt-2 text-2xl font-bold">Enter</p>
              <p className="mt-3 text-sm text-slate-500">
                선택한 문장 또는 입력 중인 문장을 음성으로 출력합니다.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const pageTitle =
    screen === "category-menu"
      ? "카테고리 선택"
      : screen === "category"
        ? activeCategory?.title || "카테고리"
        : inputMode === "initial"
          ? "초성 입력 모드"
          : inputMode === "english-initial"
            ? "영어 초성 입력 모드"
            : "완전 자유 입력 모드";

  let workZoneText: ReactNode = "";

  if (screen === "category-menu") {
    workZoneText = "원하는 표현의 종류를 선택하세요.";
  } else if (screen === "category") {
    workZoneText = selectedSentence || "원하는 문장을 선택하세요.";
  } else if (isRecommendationLoading) {
    workZoneText = "Gemini가 추천 문장을 만들고 있습니다...";
  } else if (recommendationError && !selectedSentence) {
    workZoneText = recommendationError;
  } else if (selectedSentence) {
    workZoneText = selectedSentence;
  } else if (currentInputSegments.length > 0) {
    workZoneText = renderInputSegments(currentInputSegments);
  } else if (inputMode === "initial") {
    workZoneText = `초성을 입력하세요\n예: 물 주세요 → ㅁㅈㅅㅇ`;
  } else if (inputMode === "english-initial") {
    workZoneText = `영어 초성을 입력하세요\n예: I want water → IWW`;
  } else {
    workZoneText = "자모를 입력하세요.";
  }

  return (
    <main className="min-h-[100dvh] bg-slate-100 p-2 text-slate-900 sm:p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-5 sm:gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">GLIM-AAC DEMO</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">
              방향키를 누른 뒤 Space를 누르면 선택됩니다. 대각선은 두 방향키를 순서대로 입력합니다.
            </p>
          </div>
          <HomeButton onClick={goHome} />
        </header>

        {statusBox}

        <section className="mt-3 sm:mt-5">
          <RadialPad
            items={radialItems}
            activeDirection={activeDirection}
            isResting={isResting}
            isBlinkPressed={isBlinkPressed}
            centerText={workZoneText}
            centerTitle="WORK / REST ZONE"
            centerHelper={
              selectedSentence
                ? "Enter로 말하기 · Space를 1.5초 이상 길게 눌러 휴식 전환"
                : "Space를 1.5초 이상 길게 눌러 휴식 전환"
            }
            isSpeaking={isSpeaking}
            speakingDurationMs={speakingDurationMs}
            speechAnimationKey={speechAnimationKey}
            onCenter={() => setIsResting((previous) => !previous)}
            onCenterLong={() => setIsResting((previous) => !previous)}
          />
        </section>

        <style jsx global>{`
          html {
            -webkit-text-size-adjust: 100%;
          }

          button {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          @keyframes optitalkSpeechSweep {
            0% {
              transform: translateX(-130%);
              opacity: 0.15;
            }
            18% {
              opacity: 1;
            }
            82% {
              opacity: 1;
            }
            100% {
              transform: translateX(260%);
              opacity: 0.15;
            }
          }
        `}</style>

        <footer className="mt-5 text-center text-sm text-slate-500">
          Gemini 추천 연결 · 외곽 버튼 클릭 가능 · 정면 Long blink는 휴식 전환 · Enter는 Converge
        </footer>
      </div>
    </main>
  );
}
