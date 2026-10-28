"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addMessage, updateMessage } from "./use-conversation";

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [speakingDurationMs, setSpeakingDurationMs] = useState(2600);
  const [speechAnimationKey, setSpeechAnimationKey] = useState(0);
  const active = useRef<{ id: string; utterance: SpeechSynthesisUtterance } | null>(null);
  const cancel = useCallback(() => {
    if (active.current) {
      active.current.utterance.onend = null;
      active.current.utterance.onerror = null;
      updateMessage(active.current.id, "interrupted");
      active.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);
  const stopSpeech = useCallback(() => { cancel(); setIsSpeaking(false); }, [cancel]);
  useEffect(() => () => cancel(), [cancel]);

  const speak = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;
    cancel();
    setIsSpeaking(false);
    setSpeechError("");
    const id = addMessage("self", trimmed, "pending");
    if (!id) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      updateMessage(id, "failed");
      setSpeechError("Speech isn't available in this browser. Your message has been saved in conversation history.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = "en-US";
    const englishVoice = window.speechSynthesis.getVoices().find(voice => voice.lang === "en-US")
      ?? window.speechSynthesis.getVoices().find(voice => voice.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.rate = 0.9;
    active.current = { id, utterance };
    utterance.onend = () => {
      if (active.current?.id !== id) return;
      active.current = null;
      updateMessage(id, "spoken");
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      if (active.current?.id !== id) return;
      active.current = null;
      updateMessage(id, "failed");
      setIsSpeaking(false);
      setSpeechError("We couldn't play your message. You can try again from conversation history.");
    };
    setSpeakingDurationMs(Math.min(4600, Math.max(2200, 1900 + trimmed.length * 55)));
    setSpeechAnimationKey(previous => previous + 1);
    setIsSpeaking(true);
    try { window.speechSynthesis.speak(utterance); }
    catch {
      active.current = null;
      updateMessage(id, "failed");
      setIsSpeaking(false);
      setSpeechError("We couldn't play your message. You can try again from conversation history.");
    }
  }, [cancel]);
  return { speak, stopSpeech, isSpeaking, speechError, speakingDurationMs, speechAnimationKey };
}
