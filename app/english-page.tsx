"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./interface.module.css";
import { HomeButton, InterfaceIcon, RadialPad, type Direction, type DirectionMode, type DynamicOverlayConfig, type RadialItem } from "./radial-pad";
import { GestureGuide, type Gesture } from "./gesture-guide";
import { useWinkToolbar } from "./use-wink-toolbar";
import { createBlinkSequence } from "./blink-sequence";
import { ConversationPanel } from "./conversation-panel";
import { useConversation } from "./use-conversation";
import { useSpeech } from "./use-speech";
import { getRecommendationContext } from "./conversation-model";

type Screen = "home" | "manual" | "settings" | "conversation" | "categories" | "phrases" | "compose";
type InputMode = "initials" | "spelling";
type Stage = "groups" | "subgroups" | "letters" | "symbols" | "suggestions";
type Segment = { type: "en-initial" | "literal"; text: string };
type Category = { title: string; icon: string; phrases: string[] };
type ActionGesture = Exclude<Gesture, "blink" | "long">;

const GROUPS = {
  "Group 1": ["E", "T", "A", "O", "I"],
  "Group 2": ["N", "S", "H", "R", "D"],
  "Group 3": ["L", "C", "U", "M", "W"],
  "Group 4": ["X", "Q", "Z", "B", "V", "K", "J", "F", "G", "Y", "P"],
};
const SUBGROUPS = {
  "X · Q · Z": ["X", "Q", "Z"],
  "B · V · K · J": ["B", "V", "K", "J"],
  "F · G · Y · P": ["F", "G", "Y", "P"],
};
type Group = keyof typeof GROUPS;
type Subgroup = keyof typeof SUBGROUPS;
const INPUT_DIRECTIONS: Direction[] = ["nw", "n", "ne", "w"];
const PHRASE_DIRECTIONS: Direction[] = ["nw", "n", "ne", "w", "e", "sw"];
const FOUR_DIRECTIONS: Direction[] = ["n", "e", "s", "w"];
const SUBGROUP_DIRECTIONS = ["n", "e", "s", "w"] as const;
const PAGE_DIRECTIONS: Direction[] = ["n", "e", "w"];
const DIRECTIONS: Record<Direction, string> = {
  nw: "Up left", n: "Up", ne: "Up right", w: "Left", e: "Right", sw: "Down left", s: "Down", se: "Down right",
};
const DIRECTION_KEYS: Record<Direction, string> = {
  nw: "↑ + ←", n: "↑", ne: "↑ + →", w: "←", e: "→", sw: "↓ + ←", s: "↓", se: "↓ + →",
};
const URGENT_PHRASES = ["I'm having trouble breathing.", "I need suctioning.", "Please get my caregiver now."];
const CATEGORIES: Category[] = [
  { title: "Food & drinks", icon: "🥣", phrases: ["I'm hungry.", "I'd like some water, please.", "I'd like something to eat.", "I'm thirsty.", "Please go slowly.", "I don't feel like eating right now."] },
  { title: "Health & comfort", icon: "🩺", phrases: ["I'm in pain.", "I have a headache.", "I feel dizzy.", "I'm having trouble breathing.", "I need suctioning.", "Please help me change position."] },
  { title: "Feelings", icon: "🙂", phrases: ["I'm happy.", "I feel anxious.", "I'm scared.", "I feel frustrated.", "I feel lonely.", "Thank you."] },
  { title: "Quick answers", icon: "✓", phrases: ["Yes.", "No.", "That's right.", "I'm okay.", "I'm not sure.", "Could you say that again?"] },
  { title: "Everyday needs", icon: "★", phrases: ["Please call my caregiver.", "Please get the nurse.", "Please help me change position.", "Please turn off the light.", "Please turn on the TV.", "I'd like to take a break."] },
  { title: "Conversation", icon: "💬", phrases: ["How are you?", "I'd like to tell you something.", "Please give me a moment.", "I'd like to ask a question.", "It's good to see you.", "Thank you for listening."] },
];
const QUICK_REPLIES = ["Yes.", "No.", "One moment, please."];
const COMMON_PHRASES = [
  "I'd like some water, please.", "I need help.", "Please stay here.",
  "I feel uncomfortable.", "Could you help me?", "Thank you for helping me.",
];
const GESTURE_NAMES: Record<ActionGesture, string> = {
  double: "Double blink", converge: "Converge", left: "Left wink", right: "Right wink", frown: "Strong frown", brows: "Eyebrow raise",
};
const GESTURE_KEYS: Record<ActionGesture, string> = { double: "Space twice", converge: "G", left: "C", right: "M", frown: "Enter", brows: "R" };

function directionFrom(keys: string[]): Direction | null {
  const up = keys.includes("ArrowUp"), down = keys.includes("ArrowDown");
  const left = keys.includes("ArrowLeft"), right = keys.includes("ArrowRight");
  if ((up && down) || (left && right)) return null;
  if (up && left) return "nw";
  if (up && right) return "ne";
  if (down && left) return "sw";
  if (down && right) return "se";
  return up ? "n" : down ? "s" : left ? "w" : right ? "e" : null;
}

function renderInputSegments(segments: Segment[]) {
  return segments.map((segment, index) => (
    <span key={`${segment.type}-${index}`}>
      {segment.type === "literal"
        ? segment.text.split(/([A-Za-z][A-Za-z0-9'’.-]*)/g).map((part, partIndex) => (
          <span key={partIndex} className={/^[A-Za-z][A-Za-z0-9'’.-]*$/.test(part) ? styles.spelledInput : undefined}>{part}</span>
        ))
        : segment.text}
    </span>
  ));
}

export default function EnglishHome() {
  const toolbar = useWinkToolbar();
  const messages = useConversation();
  const { speak, stopSpeech, isSpeaking, speechError, speakingDurationMs, speechAnimationKey } = useSpeech();
  const [screen, setScreen] = useState<Screen>("home");
  const returnScreen = useRef<Screen>("home");
  const [directionMode, setDirectionMode] = useState<DirectionMode>("8");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [homeHoverDirection, setHomeHoverDirection] = useState<"w" | "e" | null>(null);
  const [isBlinkPressed, setIsBlinkPressed] = useState(false);
  const [manualGesture, setManualGesture] = useState<Gesture | null>(null);
  const [manualMessage, setManualMessage] = useState("Choose a direction, then blink to select.");
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [mode, setMode] = useState<InputMode>("initials");
  const [stage, setStage] = useState<Stage>("groups");
  const [group, setGroup] = useState<Group | null>(null);
  const [subgroup, setSubgroup] = useState<Subgroup | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [editingSentence, setEditingSentence] = useState<string | null>(null);
  const [shareContext, setShareContext] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [page, setPage] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const currentInput = segments.map(segment => segment.text).join("");
  const fourWay = directionMode === "4" && (screen === "compose" || screen === "categories" || screen === "phrases");
  const clearDirection = () => setActiveDirection(null);
  const flashGesture = (gesture: Gesture) => {
    if (manualTimer.current) clearTimeout(manualTimer.current);
    setManualGesture(gesture);
    manualTimer.current = setTimeout(() => setManualGesture(null), 700);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("glim-en-direction-mode");
      if (saved === "4" || saved === "8") setDirectionMode(saved);
    } catch { /* Preferences are optional. */ }
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (preferencesLoaded) {
      try { localStorage.setItem("glim-en-direction-mode", directionMode); } catch { /* Continue without persistence. */ }
    }
  }, [directionMode, preferencesLoaded]);
  useEffect(() => () => {
    requestRef.current?.abort();
    if (manualTimer.current) clearTimeout(manualTimer.current);
  }, []);

  const invalidateSuggestions = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setSuggestions([]);
    setRecommendationError("");
    setSelectedSentence("");
  };
  const resetLetterSelection = () => { setGroup(null); setSubgroup(null); setStage("groups"); };
  const append = (text: string, type: Segment["type"] = mode === "initials" ? "en-initial" : "literal") => {
    if (currentInput.length + text.length > 120) return;
    invalidateSuggestions();
    setSegments(previous => {
      const last = previous[previous.length - 1];
      return last?.type === type
        ? [...previous.slice(0, -1), { type, text: last.text + text }]
        : [...previous, { type, text }];
    });
    clearDirection();
  };
  const deleteCharacter = () => {
    invalidateSuggestions();
    setSegments(previous => {
      const last = previous[previous.length - 1];
      if (!last) return previous;
      const text = last.text.slice(0, -1);
      return text ? [...previous.slice(0, -1), { ...last, text }] : previous.slice(0, -1);
    });
    clearDirection();
  };
  const clearDraft = () => { invalidateSuggestions(); setSegments([]); resetLetterSelection(); };
  const goHome = () => {
    stopSpeech(); invalidateSuggestions(); setSegments([]); resetLetterSelection();
    setQuickRepliesOpen(false); setEditingSentence(null); setIsResting(false); setScreen("home");
  };
  const openCompose = () => {
    clearDraft(); setMode("initials"); setQuickRepliesOpen(false); setScreen("compose");
  };
  const switchMode = () => {
    invalidateSuggestions(); setMode(previous => previous === "initials" ? "spelling" : "initials"); resetLetterSelection();
  };
  const openHistory = () => { toolbar.clear(); clearDirection(); returnScreen.current = screen; setScreen("conversation"); };
  const closeHistory = () => { clearDirection(); setScreen(returnScreen.current); };
  const speakDraft = () => {
    if (screen === "compose" || screen === "phrases") {
      speak(selectedSentence || (mode === "spelling" && screen === "compose" ? currentInput : ""));
    }
  };
  const loadRecommendations = async () => {
    if (!currentInput.trim() || loading) return;
    invalidateSuggestions();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setStage("suggestions");
    try {
      const response = await fetch("/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ mode: "mixed", segments, context: shareContext ? getRecommendationContext(messages) : [] }),
      });
      const result = await response.json() as { suggestions?: string[]; error?: string };
      if (!response.ok || !Array.isArray(result.suggestions) || result.suggestions.length === 0) {
        throw new Error(result.error || "We couldn't generate suggestions. Please try again.");
      }
      if (requestRef.current !== controller) return;
      setSuggestions(result.suggestions);
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setSuggestions(COMMON_PHRASES);
      setRecommendationError(`${error instanceof Error ? error.message : "We couldn't generate suggestions. Please try again."} Common phrases are shown below.`);
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  };

  const item = (direction: Direction, label: string, action: () => void, extra: Partial<RadialItem> = {}): RadialItem => ({ direction, label, action, ...extra });
  const utility = (direction: Direction, label: string, action: () => void, extra: Partial<RadialItem> = {}) => item(direction, label, action, { utility: true, ...extra });
  const phraseItems = (phrases: string[]) => phrases.map((phrase, index) => item(PHRASE_DIRECTIONS[index], phrase, () => {
    if (selectedSentence === phrase) speak(phrase); else setSelectedSentence(phrase);
  }, { helper: selectedSentence === phrase ? "Selected" : undefined, longAction: () => speak(phrase), tone: selectedSentence === phrase ? "primary" : "normal" }));
  let radialItems: RadialItem[] = [];
  if (screen === "home") radialItems = [
    item("nw", "Conversation history", openHistory), item("n", "User guide", () => setScreen("manual")),
    item("ne", "Settings", () => setScreen("settings")), item("w", "Categories", () => setScreen("categories")),
    item("e", "Free input", openCompose), ...URGENT_PHRASES.map((phrase, index) => item((["sw", "s", "se"] as Direction[])[index], phrase, () => speak(phrase))),
  ];
  if (screen === "manual") radialItems = (directionMode === "4" ? FOUR_DIRECTIONS : Object.keys(DIRECTIONS) as Direction[]).map(direction => item(direction, DIRECTIONS[direction], () => {
    flashGesture("blink"); setManualMessage(`${DIRECTIONS[direction]} selected.\n\nBlink detected.`);
  }, { helper: DIRECTION_KEYS[direction] }));
  if (screen === "categories") radialItems = [
    ...CATEGORIES.map((entry, index) => item(PHRASE_DIRECTIONS[index], `${entry.icon} ${entry.title}`, () => { setCategory(entry); setSelectedSentence(""); setScreen("phrases"); })),
    utility("s", "Home", goHome), utility("se", "Free input", openCompose),
  ];
  if (screen === "phrases") radialItems = [...phraseItems(category.phrases),
    utility("s", "Back", () => { setSelectedSentence(""); setScreen("categories"); }), utility("se", "Speak", speakDraft, { tone: "primary" }),
  ];
  if (screen === "compose") {
    const deleteItem = utility("e", "Delete", deleteCharacter, { longAction: clearDraft, tone: "delete" });
    const modeItem = utility("sw", mode === "initials" ? "English full input" : "English initials", switchMode, { tone: "mode" });
    const suggestItem = utility("se", "Suggest", () => void loadRecommendations(), { tone: "primary" });
    if (stage === "groups") {
      radialItems = (Object.keys(GROUPS) as Group[]).map((name, index) => item(INPUT_DIRECTIONS[index], name, () => {
        setGroup(name); setSubgroup(null); setStage(name === "Group 4" ? "subgroups" : "letters");
      }, { helper: name === "Group 4" ? "XQZ · BVKJ · FGYP" : GROUPS[name].join(" · ") }));
      radialItems.push(deleteItem, modeItem, utility("s", mode === "initials" ? "Home" : "Space", mode === "initials" ? goHome : () => append(" ", "literal")), suggestItem);
    } else if (stage === "subgroups" || (stage === "letters" && group === "Group 4")) {
      radialItems = (Object.keys(SUBGROUPS) as Subgroup[]).map((name, index) => item(INPUT_DIRECTIONS[index], name, () => { setSubgroup(name); setStage("letters"); }));
      radialItems.push(deleteItem, modeItem, utility("s", "Groups", resetLetterSelection), suggestItem);
    } else if (stage === "letters" && group) {
      const letters = subgroup ? SUBGROUPS[subgroup] : GROUPS[group];
      radialItems = letters.map((letter, index) => item(index < 4 ? INPUT_DIRECTIONS[index] : "se", letter, () => append(letter), { helper: subgroup || group }));
      radialItems.push(deleteItem, modeItem, utility("s", "Groups", () => {
        if (subgroup) { setSubgroup(null); setStage("subgroups"); } else resetLetterSelection();
      }));
      if (letters.length < 5) radialItems.push(suggestItem);
    } else if (stage === "symbols") {
      radialItems = [item("nw", "Space", () => append(" ", "literal")),
        item("n", ".", () => append(".", "literal")), item("ne", ",", () => append(",", "literal")),
        item("w", "?", () => append("?", "literal")), item("e", "'", () => append("'", "literal")),
        item("sw", "!", () => append("!", "literal")), utility("s", "Groups", resetLetterSelection),
        utility("se", "Speak", speakDraft, { tone: "primary" })];
    } else if (stage === "suggestions") {
      radialItems = [...phraseItems(suggestions), utility("s", mode === "initials" ? "English initials" : "English full input", () => { invalidateSuggestions(); resetLetterSelection(); }, { tone: "mode" }),
        utility("se", selectedSentence ? "Speak" : loading ? "Thinking…" : "New suggestions", selectedSentence ? speakDraft : () => void loadRecommendations(), { tone: "primary" })];
    }
    if (radialItems.some(entry => entry.label === "Delete")) {
      radialItems = radialItems.map(entry => ({
        ...entry,
        direction: entry.direction === "e" ? "se" : entry.direction === "se" ? "e" : entry.direction,
      }));
    }
  }
  if (quickRepliesOpen && ["compose", "categories", "phrases"].includes(screen)) radialItems = [
    ...QUICK_REPLIES.map((phrase, index) => item((["n", "e", "w"] as Direction[])[index], phrase, () => speak(phrase))),
    item("s", "Keep writing", () => setQuickRepliesOpen(false)),
  ];
  const utilities = radialItems.filter(entry => entry.utility);
  const content = radialItems.filter(entry => !entry.utility);
  let displayedItems = radialItems;
  if (fourWay && !quickRepliesOpen) {
    const preferred = utilityOpen ? utilities : content;
    const source = preferred.length ? preferred : utilityOpen ? content : utilities;
    if (source.length <= 4) displayedItems = source.map((entry, index) => ({ ...entry, direction: FOUR_DIRECTIONS[index] }));
    else {
      const pages = Math.ceil(source.length / 3);
      const currentPage = page % pages;
      displayedItems = source.slice(currentPage * 3, currentPage * 3 + 3).map((entry, index) => ({ ...entry, direction: PAGE_DIRECTIONS[index] }));
      displayedItems.push(item("s", currentPage + 1 === pages ? "First page" : "Next page", () => setPage(previous => (previous + 1) % pages), { helper: `${currentPage + 1} / ${pages}` }));
    }
  }
  const expandedSubgroup = screen === "compose" && stage === "letters" && group === "Group 4" && subgroup && !quickRepliesOpen && !utilityOpen ? subgroup : null;
  const subgroupAnchor = expandedSubgroup && displayedItems.find(entry => entry.label === expandedSubgroup)?.direction;
  const closeExpandedSubgroup = () => { setSubgroup(null); setStage("subgroups"); clearDirection(); };
  const dynamicOverlay: DynamicOverlayConfig | null = expandedSubgroup && subgroupAnchor ? {
    anchorDirection: subgroupAnchor,
    title: SUBGROUPS[expandedSubgroup].join(""),
    options: SUBGROUPS[expandedSubgroup].map((letter, index) => ({
      direction: SUBGROUP_DIRECTIONS[index], label: letter,
      action: () => { append(letter); closeExpandedSubgroup(); },
    })),
    onDismiss: closeExpandedSubgroup,
  } : null;
  const interactionItems: RadialItem[] = dynamicOverlay
    ? dynamicOverlay.options.map(option => item(option.direction, option.label, option.action))
    : displayedItems;
  const dwellDirection = screen === "home" ? homeHoverDirection ?? activeDirection : activeDirection;
  const homeDwellEnabled = screen === "home" && (dwellDirection === "w" || dwellDirection === "e");
  const dwellEnabled = !toolbar.selectedLabel && (homeDwellEnabled || quickRepliesOpen || screen === "categories" || screen === "phrases" || screen === "compose");
  const context = [screen, mode, stage, group, subgroup, utilityOpen, page, quickRepliesOpen, interactionItems.map(entry => entry.label).join("|")].join("/");
  const keyboard = useRef({
    screen, directionMode, isResting, items: interactionItems, activeDirection, toolbar,
    onGesture: (_gesture: ActionGesture) => {}, onRest: () => {}, onManualBlink: (_long: boolean) => {},
  });
  useEffect(() => {
    keyboard.current = {
      screen, directionMode, isResting, items: interactionItems, activeDirection, toolbar,
      onRest: () => setIsResting(previous => !previous),
      onManualBlink: long => { flashGesture(long ? "long" : "blink"); },
      onGesture: gesture => {
        clearDirection();
        if (screen === "manual") {
          flashGesture(gesture); setManualMessage(`${GESTURE_NAMES[gesture]} detected.\n\n${GESTURE_KEYS[gesture]} input received.`); return;
        }
        if (gesture === "left" || gesture === "right") { toolbar.move(gesture); return; }
        if (gesture === "brows") {
          toolbar.clear();
          if (fourWay && utilities.length && !quickRepliesOpen) { setUtilityOpen(previous => !previous); setPage(0); }
          return;
        }
        if (gesture === "converge" || gesture === "double") {
          if (gesture === "double" && toolbar.hasSelection()) { toolbar.activate(); return; }
          toolbar.clear(); if (!quickRepliesOpen) speakDraft(); return;
        }
        stopSpeech();
        if (toolbar.hasSelection()) { toolbar.clear(); return; }
        if (screen === "conversation") { closeHistory(); return; }
        if (editingSentence !== null) { setEditingSentence(null); return; }
        if (quickRepliesOpen) { setQuickRepliesOpen(false); return; }
        if (dynamicOverlay) { dynamicOverlay.onDismiss(); return; }
        setUtilityOpen(false); setPage(0); setSelectedSentence("");
      },
    };
  });
  useEffect(() => {
    let keys: string[] = [];
    let blinkStarted: number | null = null;
    let blinkTarget: RadialItem | undefined;
    let restingTriggered = false;
    let directionTimer: ReturnType<typeof setTimeout> | undefined;
    let restTimer: ReturnType<typeof setTimeout> | undefined;
    let longTimer: ReturnType<typeof setTimeout> | undefined;
    const resetGaze = () => { keys = []; clearTimeout(directionTimer); clearDirection(); };
    const sequence = createBlinkSequence(() => { resetGaze(); if (!keyboard.current.isResting) keyboard.current.onGesture("double"); });
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
    const nativeSpace = (event: KeyboardEvent) => event.code === "Space" && !keyboard.current.toolbar.hasSelection() && !keys.length && event.target instanceof HTMLElement && Boolean(event.target.closest("[data-native-controls]"));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || editable(event.target)) return;
      setHomeHoverDirection(null);
      const state = keyboard.current;
      const gesture: ActionGesture | null = event.code === "KeyC" ? "left" : event.code === "KeyM" ? "right" : event.code === "KeyG" ? "converge" : event.code === "KeyR" ? "brows" : event.key === "Enter" ? "frown" : null;
      if (gesture) {
        if (state.screen === "conversation" && (gesture === "left" || gesture === "right")) return;
        event.preventDefault();
        if (event.repeat || state.isResting) return;
        sequence.cancel(); clearTimeout(restTimer); clearTimeout(longTimer); blinkStarted = null; blinkTarget = undefined; setIsBlinkPressed(false); resetGaze(); state.onGesture(gesture); return;
      }
      if (state.screen === "conversation" || nativeSpace(event)) return;
      if (event.key.startsWith("Arrow")) {
        event.preventDefault(); if (event.repeat || state.isResting) return;
        if (state.toolbar.hasSelection()) { sequence.cancel(); state.toolbar.clear(); } else sequence.flush();
        const cardinalOnly = state.directionMode === "4" && state.screen !== "home";
        const pair = [...keys, event.key];
        keys = cardinalOnly || keys.length !== 1 || keys[0] === event.key || !directionFrom(pair) ? [event.key] : pair;
        setActiveDirection(directionFrom(keys)); clearTimeout(directionTimer); directionTimer = setTimeout(resetGaze, 1850); return;
      }
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault(); clearTimeout(directionTimer); clearTimeout(restTimer);
      blinkStarted = Date.now(); restingTriggered = false;
      blinkTarget = state.items.find(entry => entry.direction === directionFrom(keys));
      setIsBlinkPressed(true);
      if (state.screen === "manual") { state.onManualBlink(false); longTimer = setTimeout(() => keyboard.current.onManualBlink(true), 1500); }
      if (!blinkTarget && !state.toolbar.hasSelection()) restTimer = setTimeout(() => { restingTriggered = true; keyboard.current.onRest(); }, 1500);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || editable(event.target) || event.ctrlKey || event.altKey || event.metaKey || nativeSpace(event) || blinkStarted === null) return;
      event.preventDefault(); clearTimeout(restTimer); clearTimeout(longTimer);
      const long = Date.now() - blinkStarted >= 1500;
      const target = blinkTarget;
      blinkStarted = null; blinkTarget = undefined; setIsBlinkPressed(false);
      if (keyboard.current.screen === "manual") keyboard.current.onManualBlink(long);
      const perform = () => {
        if (keyboard.current.isResting || restingTriggered) { resetGaze(); return; }
        if (keyboard.current.toolbar.hasSelection()) { keyboard.current.toolbar.activate(); resetGaze(); return; }
        if (target) (long && target.longAction ? target.longAction : target.action)();
        resetGaze();
      };
      if (long) { sequence.cancel(); perform(); } else sequence.tap(perform);
    };
    const onBlur = () => { sequence.cancel(); clearTimeout(restTimer); clearTimeout(longTimer); blinkStarted = null; blinkTarget = undefined; setIsBlinkPressed(false); setHomeHoverDirection(null); resetGaze(); };
    const onContext = () => { onBlur(); };
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur); window.addEventListener("glim:context-change", onContext);
    return () => { onBlur(); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); window.removeEventListener("glim:context-change", onContext); };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new Event("glim:context-change"));
    setUtilityOpen(false); setPage(0); toolbar.clear();
  }, [screen, mode, stage, directionMode, quickRepliesOpen, toolbar.clear]);
  useEffect(() => {
    if (!dwellEnabled || !dwellDirection || isResting || isBlinkPressed) return;
    const target = interactionItems.find(entry => entry.direction === dwellDirection);
    if (!target) return;
    const timer = setTimeout(() => {
      if (keyboard.current.isResting) return;
      target.action(); clearDirection(); window.dispatchEvent(new Event("glim:context-change"));
    }, 1500);
    return () => clearTimeout(timer);
  }, [dwellDirection, isResting, isBlinkPressed, dwellEnabled, context]);

  const startHomeDwell = (event: ReactPointerEvent<HTMLButtonElement>, direction: "w" | "e") => {
    if (event.pointerType !== "touch" && !isResting) setHomeHoverDirection(direction);
  };
  const homeDwellProgress = (direction: "w" | "e") => homeDwellEnabled && dwellEnabled && dwellDirection === direction && !isResting && !isBlinkPressed
    ? <span className={styles.homeDwellProgress} aria-hidden="true"><span key={direction} style={{ animation: "glimDwellProgress 1500ms linear forwards" }} /></span>
    : null;

  const status = <div className={styles.status}>
    <span className={styles.statusReady}><span className={styles.statusDot} />{isResting ? "Resting" : isSpeaking ? "Speaking" : "Ready to talk"}</span>
    <span className={styles.statusPill}>{directionMode} directions</span><span className={styles.statusPill}>v3 English</span>
  </div>;
  const footer = <footer className={styles.footer}><span>GLIM · AAC</span><span>Your voice, at your pace.</span></footer>;
  const toggleRest = () => setIsResting(previous => !previous);
  if (screen === "conversation") return <main className={styles.historyShell}><ConversationPanel messages={messages} onSpeak={speak} disabled={isResting} shareContext={shareContext} onShareContext={setShareContext} onBack={closeHistory} /></main>;
  if (screen === "home") return <main className={styles.shell}><div className={styles.container}>
    <header className={styles.header}><div className={styles.brand}><span className={styles.brandMark}><InterfaceIcon name="spark" /></span><span className={styles.brandName}>Glim · AAC</span></div>
      <nav className={styles.nav} aria-label="Help and settings" data-native-controls><button className={styles.navButton} disabled={isResting} onClick={() => setScreen("manual")} data-active={activeDirection === "n"}><InterfaceIcon name="guide" />User guide</button><button className={styles.navButton} disabled={isResting} onClick={() => setScreen("settings")} data-active={activeDirection === "ne"}><InterfaceIcon name="settings" />Settings</button></nav>
    </header>
    <div className={styles.intro}><h1>What would you like to say?</h1></div>{status}
    <section className={styles.homeCards} aria-label="Start a conversation">
      <button className={styles.homeCard} disabled={isResting} onClick={() => setScreen("categories")}
        onPointerEnter={event => startHomeDwell(event, "w")} onPointerLeave={() => setHomeHoverDirection(null)} onPointerDown={() => setHomeHoverDirection(null)} onPointerCancel={() => setHomeHoverDirection(null)}
        data-active={activeDirection === "w" || homeHoverDirection === "w"}><span className={styles.cardIcon}><InterfaceIcon name="grid" /></span><h2>Categories</h2><InterfaceIcon name="arrow" className={styles.cardArrow} />{homeDwellProgress("w")}</button>
      <button className={`${styles.homeCard} ${styles.inputCard}`} disabled={isResting} onClick={openCompose}
        onPointerEnter={event => startHomeDwell(event, "e")} onPointerLeave={() => setHomeHoverDirection(null)} onPointerDown={() => setHomeHoverDirection(null)} onPointerCancel={() => setHomeHoverDirection(null)}
        data-active={activeDirection === "e" || homeHoverDirection === "e"}><span className={styles.cardIcon}><InterfaceIcon name="write" /></span><h2>Free input</h2><InterfaceIcon name="arrow" className={styles.cardArrow} />{homeDwellProgress("e")}</button>
    </section>
    <section className={styles.emergency} aria-label="Urgent needs"><h2 className={styles.sectionTitle}><InterfaceIcon name="sound" />Urgent needs</h2><div className={styles.emergencyGrid}>{URGENT_PHRASES.map((phrase, index) => <button key={phrase} className={styles.emergencyButton} disabled={isResting} data-active={activeDirection === (["sw", "s", "se"] as Direction[])[index]} onClick={() => speak(phrase)}>{phrase}<InterfaceIcon name="sound" /></button>)}</div></section>
    {speechError && <p className={styles.speechError} role="alert">{speechError}</p>}
    <button className={styles.rest} onClick={toggleRest} data-active={isResting}><InterfaceIcon name="pause" />{isResting ? "Resume" : "Take a break"}</button>
    <button className={styles.historyEntry} data-native-controls disabled={isResting} onClick={openHistory} data-active={activeDirection === "nw"}>Conversation history <span>{messages.length}</span></button>{footer}
  </div></main>;
  if (screen === "settings") return <main className={styles.shell} data-native-controls><div className="mx-auto max-w-5xl">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-teal-600">GLIM-AAC SETTINGS</p><h1 className="mt-1 text-3xl font-bold">Settings</h1><p className="mt-2 text-sm text-slate-500">Your preferences are saved in this browser.</p></div><HomeButton onClick={goHome} /></header>
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-teal-600">DIRECTION LAYOUT</p><h2 className="mt-1 text-xl font-bold">Input directions</h2><p className="mt-2 text-sm text-slate-500">Choose the layout that feels most comfortable.</p><div className="mt-4 grid grid-cols-2 gap-3">{(["8", "4"] as DirectionMode[]).map(value => <button key={value} aria-pressed={directionMode === value} onClick={() => setDirectionMode(value)} className={`rounded-2xl border-2 p-4 text-left ${directionMode === value ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-slate-50"}`}><span className="block text-2xl font-black">{value} directions</span><span className="mt-1 block text-xs">{value === "8" ? "Cardinal and diagonal" : "Up, down, left and right"}</span></button>)}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-teal-600">ENGLISH INPUT</p><h2 className="mt-1 text-xl font-bold">Start with word initials</h2><p className="mt-2 text-sm leading-7 text-slate-500">Enter the first letter of each word to get sentence suggestions. For example, IWW can become “I want water.”</p><p className="mt-3 text-sm leading-7 text-slate-500">Choose English full input to spell words or names. Switch between the two modes while keeping your draft.</p></div>
    </section>{footer}
  </div></main>;
  if (screen === "manual") return <main className={styles.shell}><div className={styles.container}>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-teal-600">GETTING STARTED</p><h1 className="mt-1 text-3xl font-bold">User guide</h1><p className="mt-2 text-sm text-slate-500">Use eye gestures or the keyboard. You can also click or tap any button.</p></div><HomeButton onClick={goHome} /></header>{status}
    <RadialPad items={radialItems} activeDirection={activeDirection} isResting={isResting} isBlinkPressed={isBlinkPressed} centerText={manualMessage} centerTitle="Practice" centerHelper="Hold Space for 1.5 seconds while facing forward to toggle rest mode." onCenter={toggleRest} onCenterLong={toggleRest} layoutMode={directionMode} />
    <GestureGuide activeGesture={manualGesture} />{footer}
  </div></main>;
  const title = screen === "categories" ? "Categories" : screen === "phrases" ? category.title : mode === "initials" ? "English word initials" : "English full input";
  const canSpeak = Boolean(selectedSentence || (screen === "compose" && mode === "spelling" && currentInput));
  const centerText = quickRepliesOpen ? "A quick reply, then back to your message." : selectedSentence || (loading ? "Thinking of suggestions…" : recommendationError) || (screen === "compose" ? (currentInput ? renderInputSegments(segments) : mode === "initials" ? "What would you like to say?" : "Spell your message.") : screen === "categories" ? "Choose a category." : "Choose a phrase.");
  return <main className={styles.shell}><div className={styles.workspace}>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-teal-600">GLIM · AAC</p><h1 className="mt-1 text-3xl font-bold">{title}</h1></div><HomeButton onClick={goHome} /></header>{status}
    <div ref={toolbar.ref} className={styles.conversationTools} role="toolbar" aria-label="Conversation tools" data-native-controls>
      <button disabled={isResting} onClick={openHistory}>History</button><button disabled={isResting} data-active={quickRepliesOpen} onClick={() => setQuickRepliesOpen(previous => !previous)}>{quickRepliesOpen ? "Keep writing" : "Quick replies"}</button>
      <button disabled={isResting || !canSpeak} onClick={() => setEditingSentence(selectedSentence || currentInput)}>Edit message</button><button className={styles.speakButton} disabled={isResting || !canSpeak} onClick={speakDraft}>Speak</button>
      {screen === "compose" && <button disabled={isResting || loading || !currentInput.trim()} onClick={() => { setQuickRepliesOpen(false); void loadRecommendations(); }}>{loading ? "Thinking…" : "New suggestions"}</button>}
      {screen === "compose" && mode === "spelling" && <>
        <button disabled={isResting || quickRepliesOpen} onClick={() => { append(" ", "literal"); if (stage === "suggestions") resetLetterSelection(); }}>Space</button>
        <button disabled={isResting || quickRepliesOpen} onClick={() => setStage("symbols")}>Symbols</button>
      </>}
      {isSpeaking && <button onClick={stopSpeech}>Stop speaking</button>}<button aria-pressed={showTyping} data-active={showTyping} onClick={() => setShowTyping(previous => !previous)}>Typing indicator</button>
    </div>
    <span className="sr-only" role="status">{toolbar.selectedLabel ? `${toolbar.selectedLabel} highlighted. Press Space to select.` : ""}</span>
    {showTyping && (currentInput || selectedSentence) && <p className={styles.typingIndicator} role="status">I'm writing a message. Please give me a moment.</p>}
    {speechError && <p className={styles.speechError} role="alert">{speechError}</p>}
    {editingSentence !== null && <form className={styles.sentenceEditor} data-native-controls onSubmit={event => { event.preventDefault(); if (editingSentence.trim() && !isResting) { setSelectedSentence(editingSentence.trim()); setEditingSentence(null); } }}><label htmlFor="message-edit">Your message</label><textarea id="message-edit" value={editingSentence} onChange={event => setEditingSentence(event.target.value)} rows={3} maxLength={500} disabled={isResting} /><div className={styles.conversationTools}><button type="submit" disabled={isResting || !editingSentence.trim()}>Save changes</button><button type="button" onClick={() => setEditingSentence(null)}>Cancel</button></div></form>}
    <RadialPad items={displayedItems} dynamicOverlay={dynamicOverlay} activeDirection={activeDirection} isResting={isResting} isBlinkPressed={isBlinkPressed}
      centerText={centerText} centerTitle={quickRepliesOpen ? "Quick replies" : fourWay && utilityOpen ? "Actions" : "Your message"}
      centerHelper={fourWay && utilities.length && !quickRepliesOpen ? `Raise eyebrows: ${utilityOpen ? "back to input" : "show actions"}` : screen === "compose" && mode === "initials" ? "Each letter stands for the first letter of a word." : undefined}
      isSpeaking={isSpeaking} speakingDurationMs={speakingDurationMs} speechAnimationKey={speechAnimationKey}
      enableDwellSelection={dwellEnabled} dwellMs={1500} layoutMode={quickRepliesOpen || fourWay ? "4" : "8"}
      onCenter={() => { if (quickRepliesOpen) setQuickRepliesOpen(false); else if (fourWay && utilities.length) { setUtilityOpen(previous => !previous); setPage(0); clearDirection(); } else toggleRest(); }}
      onCenterLong={toggleRest} />{footer}
  </div></main>;
}
