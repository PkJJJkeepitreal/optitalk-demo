"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "./conversation-model";
import { addMessage, clearConversation } from "./use-conversation";
import styles from "./interface.module.css";

const STATUS = { pending: "Speaking", spoken: "Spoken", interrupted: "Interrupted", failed: "Speech failed", text: "Added" };

export function ConversationPanel({ messages, onSpeak, disabled, shareContext, onShareContext, onBack }: {
  messages: ConversationMessage[];
  onSpeak: (text: string) => void;
  disabled: boolean;
  shareContext: boolean;
  onShareContext: (value: boolean) => void;
  onBack: () => void;
}) {
  const [partnerText, setPartnerText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollLog = (eye: "left" | "right") => {
    const list = listRef.current;
    if (!list) return;
    // One wink advances by 70% of the viewport, preserving reading overlap.
    list.scrollBy({ top: (eye === "left" ? -1 : 1) * list.clientHeight * 0.7, behavior: "instant" });
  };
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    const onWink = (event: Event) => {
      const eye = (event as CustomEvent<{ eye?: unknown }>).detail?.eye;
      if (!disabled && (eye === "left" || eye === "right")) scrollLog(eye);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") { event.preventDefault(); if (!event.repeat) onBack(); return; }
      if (disabled || event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const eye = event.code === "KeyC" || event.key === "ArrowLeft" || event.key === "ArrowUp" ? "left" : event.code === "KeyM" || event.key === "ArrowRight" || event.key === "ArrowDown" ? "right" : null;
      if (!eye) return;
      event.preventDefault();
      if (!event.repeat) scrollLog(eye);
    };
    window.addEventListener("glim:wink", onWink);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("glim:wink", onWink);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [disabled, onBack]);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  return (
    <section className={styles.historyScreen} data-native-controls aria-labelledby="history-title">
      <header className={styles.historyHeader}>
        <div><p className={styles.panelNote}>GLIM · AAC</p><h1 id="history-title" ref={headingRef} tabIndex={-1}>Conversation history <span>{messages.length}</span></h1></div>
        <button type="button" className={styles.navButton} onClick={onBack}>← Back</button>
      </header>
      <div className={styles.historyNavigation} aria-label="Scroll conversation history">
        <button type="button" disabled={disabled || !messages.length} onClick={() => scrollLog("left")}>↑ Left wink</button>
        <button type="button" disabled={disabled || !messages.length} onClick={() => scrollLog("right")}>Right wink ↓</button>
      </div>
      <div className={styles.conversationBody}>
        <p className={styles.panelNote}>Your latest 100 messages are saved in this browser.</p>
        <div className={`${styles.messageList} ${styles.historyMessages}`} ref={listRef} role="log" aria-label="Current conversation" aria-live="polite" aria-relevant="additions" tabIndex={0}>
          {messages.length === 0 && <div className={styles.emptyConversation}>Your conversation starts here.<br />Messages you speak and replies from your conversation partner<br />will appear together.</div>}
          {messages.map(message => (
            <article key={message.id} className={styles.message} data-role={message.role}>
              <div className={styles.messageMeta}><strong>{message.role === "self" ? "You" : "Partner"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time></div>
              <p>{message.text}</p>
              <div className={styles.messageActions}><span>{STATUS[message.status]}</span>{message.role === "self" && <button type="button" disabled={disabled} onClick={() => onSpeak(message.text)} aria-label={`Speak again: ${message.text}`}>Speak again</button>}</div>
            </article>
          ))}
        </div>
        <details className={styles.historyOptions}><summary>Partner replies & history settings</summary>
        <form onSubmit={event => { event.preventDefault(); if (!partnerText.trim() || disabled) return; addMessage("partner", partnerText); setPartnerText(""); }} className={styles.partnerForm}>
          <label htmlFor="partner-input">Partner's reply</label>
          <textarea id="partner-input" value={partnerText} onChange={event => setPartnerText(event.target.value)} maxLength={500} rows={2} placeholder="Your conversation partner can type here" disabled={disabled} />
          <button type="submit" className={styles.navButton} disabled={disabled || !partnerText.trim()}>Add to conversation</button>
        </form>
        <label className={styles.panelToggle}><input type="checkbox" checked={shareContext} onChange={event => onShareContext(event.target.checked)} />Use recent conversation for suggestions</label>
        <p className={styles.panelNote}>{shareContext ? "Your latest six messages are sent to Gemini when you request suggestions." : "Your conversation history is not shared with the suggestion service."}</p>
        {confirmClear ? <div className={styles.clearActions}><span>Clear conversation history in this browser?</span><button type="button" onClick={() => { clearConversation(); setConfirmClear(false); }}>Clear history</button><button type="button" onClick={() => setConfirmClear(false)}>Cancel</button></div> : <button type="button" className={styles.textButton} disabled={!messages.length} onClick={() => setConfirmClear(true)}>Clear history</button>}
        </details>
      </div>
    </section>
  );
}
