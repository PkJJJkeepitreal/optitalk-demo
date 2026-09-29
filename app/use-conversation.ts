"use client";

import { useSyncExternalStore } from "react";
import { MAX_MESSAGES, MAX_MESSAGE_LENGTH, sanitizeMessages, type ConversationMessage, type MessageStatus } from "./conversation-model";

const KEY = "glim-conversation-v1";
const EMPTY: ConversationMessage[] = [];
let snapshot = EMPTY;
let initialized = false;
const listeners = new Set<() => void>();

function readStorage() {
  try { snapshot = sanitizeMessages(JSON.parse(localStorage.getItem(KEY) || "[]")); }
  catch { snapshot = EMPTY; }
  initialized = true;
}
function getSnapshot() {
  if (!initialized) readStorage();
  return snapshot;
}
function publish(next: ConversationMessage[]) {
  snapshot = next.slice(-MAX_MESSAGES);
  initialized = true;
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch { /* Keep working in memory when storage is unavailable. */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) { readStorage(); listeners.forEach(callback => callback()); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
export function addMessage(role: "self" | "partner", text: string, status: MessageStatus = "text") {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return null;
  const id = crypto.randomUUID();
  publish([...getSnapshot(), { id, role, text: trimmed, status, createdAt: Date.now() }]);
  return id;
}
export function updateMessage(id: string, status: MessageStatus) {
  publish(getSnapshot().map(entry => entry.id === id ? { ...entry, status } : entry));
}
export function clearConversation() { publish([]); }
export function useConversation() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
