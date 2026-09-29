"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./interface.module.css";
import { GestureGuide } from "./gesture-guide";
import { createBlinkSequence } from "./blink-sequence";
import { ConversationPanel } from "./conversation-panel";
import { useConversation } from "./use-conversation";
import { useSpeech } from "./use-speech";
import { getRecommendationContext } from "./conversation-model";

type Screen =
  | "home"
  | "manual"
  | "settings"
  | "conversation"
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
  | "cheonjiin-initial-groups"
  | "cheonjiin-initial-letters"
  | "cheonjiin-vowels"
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

type DirectionMode = "8" | "4";
type KoreanDirectLayout = "group" | "cheonjiin";

type DynamicOverlayDirection = "n" | "e" | "s" | "w";

type DynamicOverlayOption = {
  direction: DynamicOverlayDirection;
  label: string;
  helper?: string;
  action: () => void;
  longAction?: () => void;
};

type DynamicOverlayConfig = {
  anchorDirection: Direction;
  title: string;
  options: DynamicOverlayOption[];
  onDismiss: () => void;
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

const CHEONJIIN_INITIAL_GROUP_MAP = {
  "ㄱ·ㅋ·ㄴ·ㄹ": ["ㄱ", "ㅋ", "ㄴ", "ㄹ"],
  "ㄷ·ㅌ·ㅅ·ㅎ": ["ㄷ", "ㅌ", "ㅅ", "ㅎ"],
  "ㅂ·ㅍ·ㅁ·ㅇ": ["ㅂ", "ㅍ", "ㅁ", "ㅇ"],
  "ㅈ·ㅊ": ["ㅈ", "ㅊ"],
} as const;

type CheonjiinInitialGroup = keyof typeof CHEONJIIN_INITIAL_GROUP_MAP;

const CHEONJIIN_VOWEL_MAP: Record<string, string> = {
  "ㅣ": "ㅣ",
  "ㅡ": "ㅡ",
  "ㅣㆍ": "ㅏ",
  "ㆍㅣ": "ㅓ",
  "ㆍㅡ": "ㅗ",
  "ㅡㆍ": "ㅜ",
  "ㅣㆍㆍ": "ㅑ",
  "ㆍㆍㅣ": "ㅕ",
  "ㆍㆍㅡ": "ㅛ",
  "ㅡㆍㆍ": "ㅠ",
  "ㅣㆍㅣ": "ㅐ",
  "ㆍㅣㅣ": "ㅔ",
  "ㅣㆍㆍㅣ": "ㅒ",
  "ㆍㆍㅣㅣ": "ㅖ",
  "ㆍㅡㅣ": "ㅚ",
  "ㆍㅡㅣㆍ": "ㅘ",
  "ㆍㅡㅣㆍㅣ": "ㅙ",
  "ㅡㆍㅣ": "ㅟ",
  "ㅡㆍㆍㅣ": "ㅝ",
  "ㅡㆍㆍㅣㅣ": "ㅞ",
  "ㅡㅣ": "ㅢ",
};

const CHEONJIIN_VOWEL_PREFIXES = new Set(
  Object.keys(CHEONJIIN_VOWEL_MAP).flatMap((sequence) =>
    Array.from({ length: sequence.length }, (_, index) =>
      sequence.slice(0, index + 1)
    )
  )
);

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

const FOUR_WAY_DIRECTIONS: Direction[] = ["n", "e", "s", "w"];
const FOUR_WAY_PAGED_DIRECTIONS: Direction[] = ["n", "e", "w"];

function isFourWayUtilityItem(item: RadialItem) {
  const label = item.label.trim();

  return (
    label === "지우기" ||
    label === "뒤로" ||
    label === "홈" ||
    label === "그룹으로" ||
    label === "띄어쓰기" ||
    label === "추천" ||
    label === "문장 추천" ||
    label === "추천 새로고침" ||
    label === "생성 중..." ||
    label === "말하기" ||
    label === "자모 입력" ||
    label === "초성 입력" ||
    label === "초성 모드" ||
    label === "초성 다시 선택" ||
    label === "완전 자유 입력" ||
    label === "이전" ||
    label === "다음" ||
    label === "한 획 지우기" ||
    label === "모음 초기화" ||
    label.startsWith("확정 ")
  );
}



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

function InterfaceIcon({ name, className }: { name: "spark" | "grid" | "write" | "arrow" | "settings" | "guide" | "pause" | "sound"; className?: string }) {
  const paths = {
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

function HomeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-native-controls
      onClick={onClick}
      className={styles.navButton}
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
  centerTitle = "나의 문장",
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
  }, [dynamicOverlay?.title, isResting]);

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
          {item.label}
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
          aria-label="펼쳐진 초성 그룹 닫기"
          onClick={dynamicOverlay.onDismiss}
          className="absolute inset-0 z-40 rounded-3xl bg-slate-900/10 backdrop-blur-[1px]"
        />

        <div
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
    <div className={"relative " + styles.pad}>
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
              <span className={styles.centerBadge}>{isResting ? "잠시 쉬어가요" : isSpeaking ? "말하는 중" : centerTitle}</span>
              <div className={styles.centerText}>{isResting ? "휴식 중입니다." : centerText}</div>
              {isResting ? <span className={styles.centerHint}>휴식 마치기</span> : !isSpeaking && centerHelper ? <span className={styles.centerHint}>{centerHelper}</span> : null}
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


export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const conversationReturnRef = useRef<Screen>("home");
  const [inputMode, setInputMode] = useState<InputMode>("initial");
  const [committedInputSegments, setCommittedInputSegments] = useState<InputSegment[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [recommendedSentences, setRecommendedSentences] = useState<string[]>([]);
  const [isRecommendationLoading, setIsRecommendationLoading] =
    useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [isResting, setIsResting] = useState(false);
  const [directionMode, setDirectionMode] = useState<DirectionMode>("8");
  const [koreanDirectLayout, setKoreanDirectLayout] =
    useState<KoreanDirectLayout>("group");
  const [fourWayUtilityOpen, setFourWayUtilityOpen] = useState(false);
  const [fourWayPage, setFourWayPage] = useState(0);

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
  const [selectedCheonjiinInitialGroup, setSelectedCheonjiinInitialGroup] =
    useState<CheonjiinInitialGroup | null>(null);
  const [cheonjiinVowelSequence, setCheonjiinVowelSequence] = useState("");
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
  const messages = useConversation();
  const { speak, stopSpeech, isSpeaking, speechError, speakingDurationMs, speechAnimationKey } = useSpeech();
  const [shareContext, setShareContext] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<string | null>(null);
  const gestureActionRef = useRef<(gesture: "double" | "frown" | "brows" | "left" | "right") => void>(() => undefined);
  const shortBlinkRef = useRef<ReturnType<typeof createBlinkSequence> | null>(null);

  const activeDirection = useMemo(
    () => getDirectionFromKeys(heldArrowKeys),
    [heldArrowKeys]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedDirectionMode = window.localStorage.getItem("glim-direction-mode");
    const savedKoreanLayout = window.localStorage.getItem("glim-korean-direct-layout");

    if (savedDirectionMode === "4" || savedDirectionMode === "8") {
      setDirectionMode(savedDirectionMode);
    }

    if (savedKoreanLayout === "group" || savedKoreanLayout === "cheonjiin") {
      setKoreanDirectLayout(savedKoreanLayout);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("glim-direction-mode", directionMode);
  }, [directionMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("glim-korean-direct-layout", koreanDirectLayout);
  }, [koreanDirectLayout]);

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
      setSelectedCheonjiinInitialGroup(null);
      setCheonjiinVowelSequence("");
      setSelectedVowelGroup(null);
      setSelectedFinalGroup(null);
      setSelectedEnglishGroup(null);
      setSelectedEnglishGroup4Subgroup(null);
      setVowelPage(0);
      setFinalPage(0);
      setEnglishPage(0);
    }
  };

  // Every explicit utterance follows one path; speaking never destroys the draft.


  const resetAllInput = () => {
    setQuickRepliesOpen(false);
    setEditingSentence(null);
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
    setSelectedCheonjiinInitialGroup(null);
    setCheonjiinVowelSequence("");
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

  const openConversation = () => {
    conversationReturnRef.current = screen;
    clearDirectionSequence();
    clearRestHoldTimer();
    blinkStartRef.current = null;
    blinkDirectionRef.current = null;
    setIsBlinkPressed(false);
    screenRef.current = "conversation";
    setScreen("conversation");
  };

  const closeConversation = () => {
    clearDirectionSequence();
    screenRef.current = conversationReturnRef.current;
    setScreen(conversationReturnRef.current);
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
    setSelectedCheonjiinInitialGroup(null);
    setCheonjiinVowelSequence("");
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
    setSelectedCheonjiinInitialGroup(null);
    setCheonjiinVowelSequence("");
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
        context: shareContext ? getRecommendationContext(messages) : [],
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

  const startKoreanInitialInput = () => {
    setSelectedDirectInitialGroup(null);
    setSelectedCheonjiinInitialGroup(null);
    setCheonjiinVowelSequence("");
    setDirectStage(
      koreanDirectLayout === "cheonjiin"
        ? "cheonjiin-initial-groups"
        : "initial-groups"
    );
  };

  const startKoreanVowelInput = () => {
    setSelectedVowelGroup(null);
    setVowelPage(0);
    setCheonjiinVowelSequence("");
    setDirectStage(
      koreanDirectLayout === "cheonjiin" ? "cheonjiin-vowels" : "vowel-groups"
    );
  };

  const appendCheonjiinVowelStroke = (stroke: "ㅣ" | "ㆍ" | "ㅡ") => {
    setSelectedSentence("");
    setCheonjiinVowelSequence((previous) => {
      const candidate = previous + stroke;

      if (CHEONJIIN_VOWEL_PREFIXES.has(candidate)) {
        return candidate;
      }

      return CHEONJIIN_VOWEL_PREFIXES.has(stroke) ? stroke : previous;
    });
  };

  const confirmCheonjiinVowel = () => {
    const vowel = CHEONJIIN_VOWEL_MAP[cheonjiinVowelSequence];
    if (!vowel) return;

    addVowelToDirect(vowel);
    setCheonjiinVowelSequence("");
    setDirectStage("root");
  };

  const selectDirectInitialLetter = (letter: string, longBlink: boolean) => {
    const selected =
      longBlink && DOUBLE_CONSONANT_MAP[letter]
        ? DOUBLE_CONSONANT_MAP[letter]
        : letter;

    addInitialToDirect(selected);
    setSelectedDirectInitialGroup(null);

    // 초성을 선택하면 설정된 한글 입력 방식의 모음 단계로 자동 이동합니다.
    startKoreanVowelInput();
  };

  const commitSyllableAndReturnToStart = () => {
    const current = composeSyllable(syllable);

    if (current) {
      setDirectText((previous) => previous + current);
    }

    setSyllable(EMPTY_SYLLABLE);
    setSelectedSentence("");
    setSelectedDirectInitialGroup(null);

    // 받침 없이 다음 글자로 넘어갈 때는 설정된 한글 입력 방식의
    // 다음 초성 선택 화면으로 바로 이동합니다.
    startKoreanInitialInput();
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
  let dynamicInitialOverlay: DynamicOverlayConfig | null = null;

  if (screen === "home") {
    radialItems = [
      { direction: "nw", label: "대화 기록", action: openConversation },
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
        direction: "ne",
        label: "설정",
        helper: "4방향 · 천지인 설정",
        action: () => {
          setIsResting(false);
          setScreen("settings");
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
    const manualDirections: Direction[] =
      directionMode === "4"
        ? ["n", "e", "s", "w"]
        : (Object.keys(DIRECTION_LABEL) as Direction[]);

    radialItems = manualDirections.map(
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
        action: goHome,
      },
      {
        direction: "se",
        label: "자유 입력",
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
          ? "선택됨"
          : undefined,
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
        action: () => {
          setSelectedSentence("");
          setScreen("category-menu");
        },
      },
      {
        direction: "se",
        label: "말하기",
        action: () => speak(selectedSentence),
        tone: "primary",
      }
    );
  }

  if (screen === "free-input" && inputMode === "initial") {
    if (initialStage === "groups" || initialStage === "letters") {
      const groups = Object.keys(INITIAL_GROUP_MAP) as InitialGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group + " 그룹",
        helper: INITIAL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedInitialGroup(group);
          setInitialStage("letters");
        },
        tone:
          selectedInitialGroup === group && initialStage === "letters"
            ? "primary"
            : "normal",
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          action: () => {
            if (initialInput) {
              setInitialInput((previous) => previous.slice(0, -1));
            } else {
              setCommittedInputSegments((previous) =>
                deleteLastInputSegmentCharacter(previous)
              );
            }
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "완전 자유 입력",
          action: switchToDirectInput,
          tone: "primary",
        },
        {
          direction: "s",
          label: "문장 추천",
          action: () => {
            void loadInitialRecommendations();
          },
        },
        {
          direction: "se",
          label: "홈",
          action: goHome,
        }
      );

      if (initialStage === "letters" && selectedInitialGroup) {
        const letters = INITIAL_GROUP_MAP[selectedInitialGroup];
        const groupIndex = groups.indexOf(selectedInitialGroup);
        const anchorDirection =
          directionMode === "4"
            ? FOUR_WAY_DIRECTIONS[groupIndex]
            : INPUT_DIRECTION_ORDER[groupIndex];
        const fourWayDirections: DynamicOverlayDirection[] = ["n", "e", "s", "w"];
        const twoWayDirections: DynamicOverlayDirection[] = ["n", "s"];
        const overlayDirections =
          letters.length <= 2 ? twoWayDirections : fourWayDirections;

        dynamicInitialOverlay = {
          anchorDirection,
          title: selectedInitialGroup,
          onDismiss: () => {
            setSelectedInitialGroup(null);
            setInitialStage("groups");
          },
          options: letters.map((letter, index) => ({
            direction: overlayDirections[index],
            label: letter,
            helper: DOUBLE_CONSONANT_MAP[letter]
              ? DOUBLE_CONSONANT_MAP[letter]
              : undefined,
            action: () => selectInitialLetter(letter, false),
            longAction: DOUBLE_CONSONANT_MAP[letter]
              ? () => selectInitialLetter(letter, true)
              : undefined,
          })),
        };
      }
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
            ? "선택됨"
            : undefined,
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
            ? "문장 생성 중"
            : selectedSentence
              ? undefined
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
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "English 자유 입력",
          action: switchToDirectInput,
        },
        {
          direction: "s",
          label: "한글 초성 입력",
          action: switchToInitialInput,
        },
        {
          direction: "se",
          label: "추천",
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
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "그룹으로",
          action: () => {
            setSelectedEnglishInitialGroup(null);
            setSelectedEnglishInitialGroup4Subgroup(null);
            setEnglishInitialStage("groups");
          },
        },
        {
          direction: "s",
          label: "English 자유 입력",
          action: switchToDirectInput,
        },
        {
          direction: "se",
          label: "추천",
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
          action: () => {
            if (englishInitialInput) setEnglishInitialInput((previous) => previous.slice(0, -1));
            else setCommittedInputSegments((previous) => deleteLastInputSegmentCharacter(previous));
            setSelectedSentence("");
          },
        },
        {
          direction: "sw",
          label: "English 자유 입력",
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
        helper: selectedSentence === sentence ? "선택됨" : undefined,
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
          helper: isRecommendationLoading ? "문장 생성 중" : selectedSentence ? undefined : "새 문장 6개 생성",
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
            helper:
              koreanDirectLayout === "cheonjiin"
                ? "천지인 자음 그룹"
                : "ㄱ · ㅁ · ㅅ · ㅇ",
            action: startKoreanInitialInput,
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
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 모드",
            action: switchToInitialInput,
          },
          {
            direction: "s",
            label: "띄어쓰기",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
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
            helper:
              koreanDirectLayout === "cheonjiin"
                ? "ㅣ · ㆍ · ㅡ 천지인 조합"
                : "ㅡ · ㅣ · ㅛ · ㅕ",
            action: startKoreanVowelInput,
            tone: "primary",
          },
          {
            direction: "e",
            label: "지우기",
            longAction: clearCurrentWorkZone,
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 다시 선택",
            action: startKoreanInitialInput,
          },
          {
            direction: "s",
            label: "띄어쓰기",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
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
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "초성 모드",
            action: switchToInitialInput,
          },
          {
            direction: "s",
            label: "띄어쓰기",
            action: addSpace,
          },
          {
            direction: "se",
            label: "문장 추천",
            action: () => {
              void loadDirectRecommendations();
            },
            tone: "primary",
          },
        ];
      }
    }

    if (directStage === "cheonjiin-initial-groups") {
      const groups = Object.keys(
        CHEONJIIN_INITIAL_GROUP_MAP
      ) as CheonjiinInitialGroup[];

      radialItems = groups.map((group, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: group,
        helper: CHEONJIIN_INITIAL_GROUP_MAP[group].join(" · "),
        action: () => {
          setSelectedCheonjiinInitialGroup(group);
          setDirectStage("cheonjiin-initial-letters");
        },
      }));

      radialItems.push(
        {
          direction: "e",
          label: "지우기",
          longAction: clearCurrentWorkZone,
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (
      directStage === "cheonjiin-initial-letters" &&
      selectedCheonjiinInitialGroup
    ) {
      const letters = CHEONJIIN_INITIAL_GROUP_MAP[selectedCheonjiinInitialGroup];

      radialItems = letters.map((letter, index) => ({
        direction: INPUT_DIRECTION_ORDER[index],
        label: letter,
        helper: DOUBLE_CONSONANT_MAP[letter]
          ? DOUBLE_CONSONANT_MAP[letter]
          : undefined,
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "그룹으로",
          action: () => {
            setSelectedCheonjiinInitialGroup(null);
            setDirectStage("cheonjiin-initial-groups");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "cheonjiin-vowels") {
      const resolvedVowel = CHEONJIIN_VOWEL_MAP[cheonjiinVowelSequence] ?? "";
      const sequenceHelper = cheonjiinVowelSequence
        ? `현재 ${cheonjiinVowelSequence}${resolvedVowel ? ` → ${resolvedVowel}` : ""}`
        : "천 · 지 · 인 기본 획";

      radialItems = [
        {
          direction: "nw",
          label: "ㅣ",
          helper: sequenceHelper,
          action: () => appendCheonjiinVowelStroke("ㅣ"),
        },
        {
          direction: "n",
          label: "ㆍ",
          helper: sequenceHelper,
          action: () => appendCheonjiinVowelStroke("ㆍ"),
        },
        {
          direction: "ne",
          label: "ㅡ",
          helper: sequenceHelper,
          action: () => appendCheonjiinVowelStroke("ㅡ"),
        },
        {
          direction: "e",
          label: resolvedVowel ? `확정 ${resolvedVowel}` : "모음 초기화",
          action: resolvedVowel
            ? confirmCheonjiinVowel
            : () => setCheonjiinVowelSequence(""),
          tone: resolvedVowel ? "primary" : "normal",
        },
        {
          direction: "w",
          label: "한 획 지우기",
          action: () => {
            if (cheonjiinVowelSequence) {
              setCheonjiinVowelSequence((previous) => previous.slice(0, -1));
            } else {
              deleteDirectCharacter();
            }
          },
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => {
            setCheonjiinVowelSequence("");
            setDirectStage("root");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          action: () => {
            void loadDirectRecommendations();
          },
        },
      ];
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
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
          ? DOUBLE_CONSONANT_MAP[letter]
          : undefined,
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "그룹으로",
          action: () => {
            setSelectedDirectInitialGroup(null);
            setDirectStage("initial-groups");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
          action: () => {
            void loadDirectRecommendations();
          },
        }
      );
    }

    if (directStage === "final-letters" && selectedFinalGroup) {
      const letters = FINAL_GROUP_MAP[selectedFinalGroup];

      if (directionMode === "4") {
        // 4방향에서는 받침 글자 페이지 이동을 기능 레이어와 분리합니다.
        // 모든 받침 후보를 content item으로 넘기고, 아래의 4방향 공통
        // pagination이 3개 후보 + 아래쪽 '다음 페이지' 형태로 처리합니다.
        // 따라서 기능 레이어를 열어 '다음/이전'을 누른 뒤 페이지와
        // 레이어 상태가 엇갈리는 문제가 발생하지 않습니다.
        radialItems = letters.map((letter, index) => ({
          direction: INPUT_DIRECTION_ORDER[index % INPUT_DIRECTION_ORDER.length],
          label: letter,
          action: () => {
            commitFinalAndReturnToStart(letter);
          },
        }));

        radialItems.push(
          {
            direction: "e",
            label: "지우기",
            longAction: clearCurrentWorkZone,
            action: deleteDirectCharacter,
          },
          {
            direction: "sw",
            label: "띄어쓰기",
            helper: "받침 없이 현재 글자 확정",
            action: addSpace,
          },
          {
            direction: "s",
            label: "그룹으로",
            action: () => {
              setSelectedFinalGroup(null);
              setFinalPage(0);
              setFourWayPage(0);
              setDirectStage("final-groups");
            },
          },
          {
            direction: "se",
            label: "추천",
            action: () => {
              void loadDirectRecommendations();
            },
          }
        );
      } else {
        // 8방향은 기존 받침 페이지 동작을 그대로 유지합니다.
        const pageSize = 4;
        const pageStart = finalPage * pageSize;
        const remainingLetters = letters.slice(pageStart);
        const pageLetters = remainingLetters.slice(0, pageSize);
        const fifthFinal =
          remainingLetters.length === 5 ? remainingLetters[4] : null;
        const hasNext = remainingLetters.length > pageSize && !fifthFinal;

        radialItems = pageLetters.map((letter, index) => ({
          direction: INPUT_DIRECTION_ORDER[index],
          label: letter,
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
            action: () => {
              setSelectedFinalGroup(null);
              setFinalPage(0);
              setDirectStage("final-groups");
            },
          },
          fifthFinal
            ? {
                direction: "se",
                label: fifthFinal,
                action: () => {
                  commitFinalAndReturnToStart(fifthFinal);
                },
              }
            : {
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "뒤로",
          action: () => setDirectStage("root"),
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "그룹으로",
          action: () => {
            setSelectedEnglishGroup(null);
            setSelectedEnglishGroup4Subgroup(null);
            setDirectStage("english-groups");
          },
        },
        {
          direction: "s",
          label: "띄어쓰기",
          action: addSpace,
        },
        {
          direction: "se",
          label: "추천",
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
          action: deleteDirectCharacter,
        },
        {
          direction: "sw",
          label: "띄어쓰기",
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
            ? "선택됨"
            : undefined,
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
            ? "문장 생성 중"
            : selectedSentence
              ? undefined
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

  if (quickRepliesOpen) {
    dynamicInitialOverlay = null;
    radialItems = [
      { direction: "n", label: "네", action: () => speak("네.") },
      { direction: "e", label: "아니요", action: () => speak("아니요.") },
      { direction: "w", label: "잠깐만요", action: () => speak("잠깐만요.") },
      { direction: "s", label: "계속 쓰기", action: () => setQuickRepliesOpen(false) },
    ];
  }

  const fourWayEnabled = directionMode === "4" && screen !== "home" && screen !== "settings";
  const fourWayUtilityItems = radialItems.filter(isFourWayUtilityItem);
  const fourWayContentItems = radialItems.filter(
    (item) => !isFourWayUtilityItem(item)
  );
  const fourWayHasUtilities = fourWayUtilityItems.length > 0;

  const getFourWayItems = () => {
    if (quickRepliesOpen || !fourWayEnabled) return radialItems;

    const preferredSource = fourWayUtilityOpen
      ? fourWayUtilityItems
      : fourWayContentItems;
    const source =
      preferredSource.length > 0
        ? preferredSource
        : fourWayUtilityOpen
          ? fourWayContentItems
          : fourWayUtilityItems;

    if (source.length <= 4) {
      return source.map((item, index) => ({
        ...item,
        direction: FOUR_WAY_DIRECTIONS[index],
      }));
    }

    const pageCount = Math.ceil(source.length / 3);
    const safePage = fourWayPage % pageCount;
    const start = safePage * 3;
    const pageItems = source.slice(start, start + 3).map((item, index) => ({
      ...item,
      direction: FOUR_WAY_PAGED_DIRECTIONS[index],
    }));

    pageItems.push({
      direction: "s",
      label: safePage + 1 < pageCount ? "다음 페이지" : "첫 페이지",
      helper: `${safePage + 1} / ${pageCount}`,
      action: () => setFourWayPage((previous) => (previous + 1) % pageCount),
    });

    return pageItems;
  };

  const displayRadialItems = getFourWayItems();

  const interactionItems: RadialItem[] = dynamicInitialOverlay
    ? dynamicInitialOverlay.options.map((option) => ({
        direction: option.direction,
        label: option.label,
        helper: option.helper,
        action: option.action,
        longAction: option.longAction,
      }))
    : displayRadialItems;

  const radialItemsRef = useRef<RadialItem[]>(interactionItems);
  const activeDirectionRef = useRef<Direction | null>(activeDirection);
  const isRestingRef = useRef(isResting);
  const screenRef = useRef(screen);
  const inputModeRef = useRef(inputMode);
  const directionModeRef = useRef(directionMode);
  const fourWayHasUtilitiesRef = useRef(fourWayHasUtilities);
  const dynamicOverlayOpenRef = useRef(Boolean(dynamicInitialOverlay));

  useEffect(() => {
    radialItemsRef.current = interactionItems;
    activeDirectionRef.current = activeDirection;
    isRestingRef.current = isResting;
    screenRef.current = screen;
    inputModeRef.current = inputMode;
    directionModeRef.current = directionMode;
    fourWayHasUtilitiesRef.current = fourWayHasUtilities;
    dynamicOverlayOpenRef.current = Boolean(dynamicInitialOverlay);
  });

  useEffect(() => {
    gestureActionRef.current = (gesture) => {
      clearDirectionSequence();
      if (screen === "manual") {
        const descriptions = { double: ["더블 블링크", "Space 두 번"], frown: ["강하게 찡그림", "F"], brows: ["눈썹 올리기", "R"], left: ["왼쪽 윙크", "C"], right: ["오른쪽 윙크", "M"] };
        const [name, key] = descriptions[gesture];
        setManualMessage(name + " 동작이 감지되었습니다.\n\n" + key + " 입력입니다.");
        return;
      }
      if (gesture === "brows") { if (screen === "conversation") closeConversation(); else openConversation(); return; }
      if (gesture === "double") {
        if (screen !== "conversation" && !quickRepliesOpen) speak(selectedSentence || (inputMode === "direct" ? currentInputText.trim() : ""));
        return;
      }
      if (gesture === "frown") {
        stopSpeech();
        if (screen === "conversation") { closeConversation(); return; }
        if (editingSentence !== null) { setEditingSentence(null); return; }
        if (quickRepliesOpen) { setQuickRepliesOpen(false); return; }
        if (dynamicInitialOverlay) { dynamicInitialOverlay.onDismiss(); return; }
        setFourWayUtilityOpen(false);
        setSelectedSentence("");
      }
    };
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

    const clearDelay =
      screenRef.current === "free-input" && inputModeRef.current === "initial"
        ? 1850
        : 1500;

    directionClearTimerRef.current = setTimeout(() => {
      directionClearTimerRef.current = null;
      directionSequenceRef.current = [];
      setHeldArrowKeys([]);
    }, clearDelay);
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
    const shortBlink = createBlinkSequence(() => {
      clearDirectionSequence();
      if (!isRestingRef.current) gestureActionRef.current("double");
    });
    shortBlinkRef.current = shortBlink;
    const nativeControl = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest("[data-native-controls], input, textarea, select, [contenteditable=true]"));
    const usesNativeKeyboard = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return true;
      if (!nativeControl(target)) return false;
      // Native buttons retain Enter/Space activation, while arrows can start AAC selection.
      return !event.key.startsWith("Arrow") && !(event.code === "Space" && directionSequenceRef.current.length > 0);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const editing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]");
      if (!editing && !event.repeat && !isRestingRef.current) {
        const gesture = event.code === "KeyC" ? "left" : event.code === "KeyM" ? "right" : event.code === "KeyF" ? "frown" : event.code === "KeyR" ? "brows" : null;
        if (gesture) {
          // The history screen owns wink scrolling; avoid a parent rerender
          // replacing its event listener in the middle of this key event.
          if (screenRef.current === "conversation" && (gesture === "left" || gesture === "right")) return;
          event.preventDefault();
          shortBlink.cancel();
          clearRestHoldTimer();
          blinkStartRef.current = null;
          blinkDirectionRef.current = null;
          setIsBlinkPressed(false);
          gestureActionRef.current(gesture);
          return;
        }
      }
      if (screenRef.current === "conversation") return;
      if (usesNativeKeyboard(event)) return;
      if (isRestingRef.current && event.code !== "Space") return;
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();

        if (event.repeat) return;

        shortBlink.flush();
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


    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (screenRef.current === "conversation") return;
      if (usesNativeKeyboard(event)) return;
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
        if (startedAt === null) return;
        const duration = Date.now() - startedAt;
        const longBlink = duration >= 1500;

        blinkStartRef.current = null;
        setIsBlinkPressed(false);
        clearRestHoldTimer();

        const direction = blinkDirectionRef.current;
        blinkDirectionRef.current = null;

        const performBlink = () => {
        if (!direction) {
          clearDirectionSequence();

          // 1.5초 타이머가 끝난 경우에만 이미 휴식 전환이 실행됩니다.
          // 짧게 누르고 뗀 Space는 아무 기능도 실행하지 않습니다.
          if (restHoldTriggeredRef.current) {
            restHoldTriggeredRef.current = false;
            return;
          }

          if (dynamicOverlayOpenRef.current) {
            setSelectedInitialGroup(null);
            setInitialStage("groups");
            return;
          }

          if (
            directionModeRef.current === "4" &&
            screenRef.current !== "home" &&
            screenRef.current !== "settings" &&
            fourWayHasUtilitiesRef.current
          ) {
            setFourWayUtilityOpen((previous) => !previous);
            setFourWayPage(0);
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
        };
        if (longBlink) { shortBlink.cancel(); performBlink(); }
        else shortBlink.tap(performBlink);
      }
    };

    const handleBlur = () => {
      shortBlink.cancel();
      clearDirectionSequence();
      clearRestHoldTimer();
      restHoldTriggeredRef.current = false;
      blinkDirectionRef.current = null;
      setIsBlinkPressed(false);
      blinkStartRef.current = null;
    };

    const handleFocus = (event: FocusEvent) => { if (nativeControl(event.target)) handleBlur(); };
    window.addEventListener("focusin", handleFocus);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      shortBlink.cancel();
      window.removeEventListener("focusin", handleFocus);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      clearDirectionTimer();
      clearRestHoldTimer();
    };
  }, []);

  useEffect(() => {
    const longGazeEnabled =
      !quickRepliesOpen && screen === "free-input" && inputMode === "initial";

    if (
      !longGazeEnabled ||
      !activeDirection ||
      isBlinkPressed ||
      isResting
    ) {
      return;
    }

    const targetDirection = activeDirection;
    const target = radialItemsRef.current.find(
      (candidate) => candidate.direction === targetDirection
    );

    if (!target) return;

    const timer = setTimeout(() => {
      const latestTarget = radialItemsRef.current.find(
        (candidate) => candidate.direction === targetDirection
      );

      if (!latestTarget || isRestingRef.current || blinkStartRef.current !== null) return;

      latestTarget.action();
      clearDirectionSequence();
    }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [
    activeDirection,
    isBlinkPressed,
    isResting,
    screen,
    inputMode,
    initialStage,
    selectedInitialGroup,
    quickRepliesOpen,
  ]);

  useEffect(() => {
    clearDirectionSequence();
    shortBlinkRef.current?.cancel();
    setFourWayUtilityOpen(false);
    setFourWayPage(0);
  }, [screen, initialStage, englishInitialStage, directStage, inputMode, directionMode, quickRepliesOpen]);

  const statusBox = (
    <div className={styles.status}>
      <span className={styles.statusReady}><span className={styles.statusDot} />{isResting ? "쉬어가는 중" : isSpeaking ? "말하는 중" : "대화 준비 완료"}</span>
      <span className={styles.statusPill}>{directionMode}방향</span>
      <span className={styles.statusPill}>ver.3-1</span>
      {screen === "manual" && <span className={styles.statusPill}>{activeDirection ? DIRECTION_KEY_LABEL[activeDirection] : "정면"} · {isBlinkPressed ? "Blink 감지" : "대기"}</span>}
      {screen === "free-input" && inputMode === "direct" && <span className={styles.statusPill}>{koreanDirectLayout === "cheonjiin" ? "천지인" : "그룹 입력"}</span>}
    </div>
  );

  if (screen === "home") {
    const categoryActive = activeDirection === "w";
    const inputActive = activeDirection === "e";
    const manualActive = activeDirection === "n";
    const settingsActive = activeDirection === "ne";
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
      <main className={styles.shell}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.brandMark}><InterfaceIcon name="spark" /></span>
              <span className={styles.brandName}>Glim<span className="font-normal text-[#789184]"> · AAC</span></span>
            </div>
            <nav className={styles.nav} aria-label="도움말과 설정" data-native-controls>
              <button type="button" disabled={isResting} onClick={openManual} className={styles.navButton} data-active={manualActive}><InterfaceIcon name="guide" />사용설명서</button>
              <button type="button" disabled={isResting} onClick={() => { setIsResting(false); setScreen("settings"); }} className={styles.navButton} data-active={settingsActive}><InterfaceIcon name="settings" />설정</button>
            </nav>
          </header>
          <div className={styles.intro}>

            <h1>지금, 어떤 이야기를 나눌까요?</h1>

          </div>
          {statusBox}
          <section className={styles.homeCards} aria-label="대화 시작">
            <button type="button" disabled={isResting} onClick={openCategoryMenu} className={styles.homeCard} data-active={categoryActive}>
              <span className={styles.cardIcon}><InterfaceIcon name="grid" /></span>
              <h2>카테고리 선택</h2>

              <InterfaceIcon name="arrow" className={styles.cardArrow} />
            </button>
            <button type="button" disabled={isResting} onClick={openFreeInput} className={styles.homeCard + " " + styles.inputCard} data-active={inputActive}>
              <span className={styles.cardIcon}><InterfaceIcon name="write" /></span>
              <h2>자유 입력</h2>

              <InterfaceIcon name="arrow" className={styles.cardArrow} />
            </button>
          </section>
          <section className={styles.emergency} aria-label="긴급 표현">
            <h2 className={styles.sectionTitle}><InterfaceIcon name="sound" />긴급 표현</h2>
            <div className={styles.emergencyGrid}>
              {EMERGENCY_MESSAGES.map((message, index) => (
                <button key={message} type="button" disabled={isResting} onClick={() => speak(message)} className={styles.emergencyButton} data-active={activeDirection === emergencyDirections[index]}>
                  <span>{message}</span><InterfaceIcon name="sound" />
                </button>
              ))}
            </div>
          </section>
          <button type="button" onClick={toggleRestFromHome} className={styles.rest} data-active={isResting || (!activeDirection && isBlinkPressed)}><InterfaceIcon name="pause" />{isResting ? "휴식 마치기" : "잠시 쉬기"}</button>
          <button type="button" data-native-controls disabled={isResting} onClick={openConversation} className={styles.historyEntry} data-active={activeDirection === "nw"}>대화 기록 <span>{messages.length}</span></button>
          <footer className={styles.footer}><span>GLIM · AAC</span><span>나의 속도로, 나의 목소리로</span></footer>
        </div>
      </main>
    );
  }

  if (screen === "conversation") {
    return <main className={styles.historyShell}><ConversationPanel messages={messages} onSpeak={speak} disabled={isResting} shareContext={shareContext} onShareContext={setShareContext} onBack={closeConversation} /></main>;
  }

  if (screen === "settings") {
    return (
      <main className={styles.shell} data-native-controls>
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-teal-600">GLIM-AAC SETTINGS</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">설정</h1>
              <p className="mt-2 text-sm text-slate-500">
                선택한 설정은 이 브라우저에 저장됩니다.
              </p>
            </div>
            <HomeButton onClick={goHome} />
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-teal-600">DIRECTION LAYOUT</p>
              <h2 className="mt-1 text-xl font-bold">입력 방향</h2>
              <p className="mt-2 text-sm text-slate-500">
                편안하게 사용할 방향 수를 선택하세요.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(["8", "4"] as DirectionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setDirectionMode(mode);
                      setFourWayUtilityOpen(false);
                      setFourWayPage(0);
                    }}
                    className={
                      "touch-manipulation rounded-2xl border-2 p-4 text-left transition " +
                      (directionMode === mode
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-800")
                    }
                  >
                    <span className="block text-2xl font-black">{mode}방향</span>
                    <span className={
                      "mt-1 block text-xs " +
                      (directionMode === mode ? "text-teal-100" : "text-slate-500")
                    }>
                      {mode === "8" ? "상하좌우 + 대각선" : "상 · 하 · 좌 · 우"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-teal-600">KOREAN DIRECT INPUT</p>
              <h2 className="mt-1 text-xl font-bold">한글 자유 입력 방식</h2>
              <p className="mt-2 text-sm text-slate-500">
                초성과 모음의 입력 방식입니다. 받침은 그룹으로 선택합니다.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKoreanDirectLayout("group")}
                  className={
                    "touch-manipulation rounded-2xl border-2 p-4 text-left transition " +
                    (koreanDirectLayout === "group"
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800")
                  }
                >
                  <span className="block text-lg font-bold">기존 그룹 입력</span>
                  <span className={
                    "mt-1 block text-xs " +
                    (koreanDirectLayout === "group" ? "text-teal-100" : "text-slate-500")
                  }>ㄱ·ㅁ·ㅅ·ㅇ / ㅡ·ㅣ·ㅛ·ㅕ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKoreanDirectLayout("cheonjiin")}
                  className={
                    "touch-manipulation rounded-2xl border-2 p-4 text-left transition " +
                    (koreanDirectLayout === "cheonjiin"
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-800")
                  }
                >
                  <span className="block text-lg font-bold">천지인 입력</span>
                  <span className={
                    "mt-1 block text-xs " +
                    (koreanDirectLayout === "cheonjiin" ? "text-teal-100" : "text-slate-500")
                  }>자음 그룹 + ㅣ · ㆍ · ㅡ 조합</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (screen === "manual") {
    return (
      <main className={styles.shell}>
        <div className={styles.container}>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5 sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-600">DEMO GUIDE</p>
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
              centerText={manualMessage.replace(/\.\s+(?=\S)/g, ".\n\n")}
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
              layoutMode={directionMode}
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

          <GestureGuide />
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
    workZoneText = "문장을 생각하고 있어요…";
  } else if (recommendationError && !selectedSentence) {
    workZoneText = recommendationError;
  } else if (selectedSentence) {
    workZoneText = selectedSentence;
  } else if (
    inputMode === "direct" &&
    directStage === "cheonjiin-vowels" &&
    cheonjiinVowelSequence
  ) {
    const resolved = CHEONJIIN_VOWEL_MAP[cheonjiinVowelSequence];
    workZoneText = (
      <div>
        {currentInputSegments.length > 0 && renderInputSegments(currentInputSegments)}
        <div className="mt-2 text-sm font-semibold text-teal-800">
          천지인 모음: {cheonjiinVowelSequence}
          {resolved ? ` → ${resolved}` : " · 조합 중"}
        </div>
      </div>
    );
  } else if (currentInputSegments.length > 0) {
    workZoneText = renderInputSegments(currentInputSegments);
  } else if (inputMode === "initial") {
    workZoneText = "어떤 말을 전할까요?";
  } else if (inputMode === "english-initial") {
    workZoneText = "어떤 말을 전할까요?";
  } else {
    workZoneText = "자모를 입력하세요.";
  }

  return (
    <main className={styles.shell}>
      <div className={styles.workspace}>
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-5 sm:gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-600">GLIM · AAC</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{pageTitle}</h1>

          </div>
          <HomeButton onClick={goHome} />
        </header>

        {statusBox}

        <div className={styles.conversationLayout}>
        <div className="min-w-0">
          <div className={styles.conversationTools} data-native-controls>
            <button type="button" disabled={isResting} onClick={openConversation}>대화 기록</button>
            <button type="button" disabled={isResting} data-active={quickRepliesOpen} onClick={() => setQuickRepliesOpen(previous => !previous)}>{quickRepliesOpen ? "계속 쓰기" : "빠른 응답"}</button>
            <button type="button" disabled={isResting || !(selectedSentence || (inputMode === "direct" && currentInputText))} onClick={() => setEditingSentence(selectedSentence || currentInputText)}>문장 수정</button>
            <button type="button" className={styles.speakButton} disabled={isResting || !(selectedSentence || (inputMode === "direct" && currentInputText))} onClick={() => speak(selectedSentence || currentInputText)}>말하기</button>
            {screen === "free-input" && <button type="button" disabled={isResting || isRecommendationLoading || !currentInputText.trim()} onClick={() => { setQuickRepliesOpen(false); void (inputMode === "direct" ? loadDirectRecommendations() : inputMode === "english-initial" ? loadEnglishInitialRecommendations() : loadInitialRecommendations()); }}>{isRecommendationLoading ? "추천 생성 중" : "새 추천"}</button>}
            {isSpeaking && <button type="button" onClick={stopSpeech}>음성 멈추기</button>}
            <button type="button" aria-pressed={showTyping} data-active={showTyping} onClick={() => setShowTyping(previous => !previous)}>작성 중 표시</button>
          </div>
          {showTyping && (currentInputText || selectedSentence) && <p className={styles.typingIndicator} role="status">말을 작성하고 있어요. 잠시 기다려 주세요.</p>}
          {speechError && <p className={styles.speechError} role="alert">{speechError}</p>}
          {editingSentence !== null && <form className={styles.sentenceEditor} data-native-controls onSubmit={event => { event.preventDefault(); if (!editingSentence.trim() || isResting) return; setSelectedSentence(editingSentence.trim()); setEditingSentence(null); }}>
            <label htmlFor="sentence-edit">전하고 싶은 문장</label>
            <textarea id="sentence-edit" value={editingSentence} onChange={event => setEditingSentence(event.target.value)} maxLength={500} rows={3} disabled={isResting} />
            <div className={styles.conversationTools}><button type="submit" disabled={isResting || !editingSentence.trim()}>수정 적용</button><button type="button" onClick={() => setEditingSentence(null)}>취소</button></div>
          </form>}
        <section className="mt-3 sm:mt-5">
          <RadialPad
            items={displayRadialItems}
            activeDirection={activeDirection}
            isResting={isResting}
            isBlinkPressed={isBlinkPressed}
            centerText={quickRepliesOpen ? "짧게 답하고, 이어서 쓰세요." : workZoneText}
            centerTitle={
              quickRepliesOpen ? "빠른 응답" : fourWayEnabled && fourWayUtilityOpen
                ? "기능"
                : "나의 문장"
            }
            centerHelper={!quickRepliesOpen && fourWayEnabled && fourWayHasUtilities ? (fourWayUtilityOpen ? "기능 선택" : "글자 · 문장 선택") : undefined}
            isSpeaking={isSpeaking}
            speakingDurationMs={speakingDurationMs}
            speechAnimationKey={speechAnimationKey}
            enableDwellSelection={
              !quickRepliesOpen && screen === "free-input" && inputMode === "initial"
            }
            dwellMs={1500}
            dynamicOverlay={dynamicInitialOverlay}
            layoutMode={quickRepliesOpen || fourWayEnabled ? "4" : "8"}
            onCenter={() => {
              if (quickRepliesOpen) { setQuickRepliesOpen(false); return; }
              if (fourWayEnabled && fourWayHasUtilities) {
                setFourWayUtilityOpen((previous) => !previous);
                setFourWayPage(0);
                return;
              }
              setIsResting((previous) => !previous);
            }}
            onCenterLong={() => setIsResting((previous) => !previous)}
          />
        </section>
        </div>
        </div>

        <style jsx global>{`
          html {
            -webkit-text-size-adjust: 100%;
          }

          button {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }

          @keyframes glimDwellProgress {
            from {
              transform: scaleX(0);
            }
            to {
              transform: scaleX(1);
            }
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

        <footer className={styles.footer}><span>GLIM · AAC</span><span>나의 속도로, 나의 목소리로</span></footer>
      </div>
    </main>
  );
}
