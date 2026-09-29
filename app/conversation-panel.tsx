"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "./conversation-model";
import { addMessage, clearConversation } from "./use-conversation";
import styles from "./interface.module.css";

const STATUS = { pending: "음성 출력 중", spoken: "말함", interrupted: "출력 중단", failed: "음성 출력 실패", text: "입력됨" };

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
        <div><p className={styles.panelNote}>GLIM · AAC</p><h1 id="history-title" ref={headingRef} tabIndex={-1}>대화 기록 <span>{messages.length}</span></h1></div>
        <button type="button" className={styles.navButton} onClick={onBack}>← 돌아가기</button>
      </header>
      <div className={styles.historyNavigation} aria-label="대화 기록 스크롤">
        <button type="button" disabled={disabled || !messages.length} onClick={() => scrollLog("left")}>↑ 왼쪽 윙크</button>
        <button type="button" disabled={disabled || !messages.length} onClick={() => scrollLog("right")}>오른쪽 윙크 ↓</button>
      </div>
      <div className={styles.conversationBody}>
        <p className={styles.panelNote}>최근 100개를 이 브라우저에 저장해요.</p>
        <div className={`${styles.messageList} ${styles.historyMessages}`} ref={listRef} role="log" aria-label="현재 대화" aria-live="polite" aria-relevant="additions" tabIndex={0}>
          {messages.length === 0 && <div className={styles.emptyConversation}>아직 나눈 말이 없어요.<br />내가 말한 문장과 상대방의 말을<br />여기에서 함께 볼 수 있어요.</div>}
          {messages.map(message => (
            <article key={message.id} className={styles.message} data-role={message.role}>
              <div className={styles.messageMeta}><strong>{message.role === "self" ? "나" : "상대방"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time></div>
              <p>{message.text}</p>
              <div className={styles.messageActions}><span>{STATUS[message.status]}</span>{message.role === "self" && <button type="button" disabled={disabled} onClick={() => onSpeak(message.text)} aria-label={`${message.text} 다시 말하기`}>다시 말하기</button>}</div>
            </article>
          ))}
        </div>
        <details className={styles.historyOptions}><summary>상대방 입력 · 기록 관리</summary>
        <form onSubmit={event => { event.preventDefault(); if (!partnerText.trim() || disabled) return; addMessage("partner", partnerText); setPartnerText(""); }} className={styles.partnerForm}>
          <label htmlFor="partner-input">상대방의 말</label>
          <textarea id="partner-input" value={partnerText} onChange={event => setPartnerText(event.target.value)} maxLength={500} rows={2} placeholder="상대방이 직접 적어주세요" disabled={disabled} />
          <button type="submit" className={styles.navButton} disabled={disabled || !partnerText.trim()}>대화에 추가</button>
        </form>
        <label className={styles.panelToggle}><input type="checkbox" checked={shareContext} onChange={event => onShareContext(event.target.checked)} />추천에 최근 대화 반영</label>
        <p className={styles.panelNote}>{shareContext ? "추천을 요청할 때 최근 대화 6개를 Gemini에 함께 보내요." : "대화 기록은 추천 서비스에 보내지 않아요."}</p>
        {confirmClear ? <div className={styles.clearActions}><span>이 브라우저의 기록을 비울까요?</span><button type="button" onClick={() => { clearConversation(); setConfirmClear(false); }}>기록 비우기</button><button type="button" onClick={() => setConfirmClear(false)}>취소</button></div> : <button type="button" className={styles.textButton} disabled={!messages.length} onClick={() => setConfirmClear(true)}>기록 비우기</button>}
        </details>
      </div>
    </section>
  );
}
