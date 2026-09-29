"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "./conversation-model";
import { addMessage, clearConversation } from "./use-conversation";
import styles from "./interface.module.css";

const STATUS = { pending: "음성 출력 중", spoken: "말함", interrupted: "출력 중단", failed: "음성 출력 실패", text: "입력됨" };

export function ConversationPanel({ messages, onSpeak, disabled, shareContext, onShareContext, compact = false }: {
  messages: ConversationMessage[];
  onSpeak: (text: string) => void;
  disabled: boolean;
  shareContext: boolean;
  onShareContext: (value: boolean) => void;
  compact?: boolean;
}) {
  const [partnerText, setPartnerText] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  return (
    <details className={styles.conversationPanel} open={!compact} data-native-controls>
      <summary className={styles.conversationHeading}>대화 기록 <span>{messages.length}</span></summary>
      <div className={styles.conversationBody}>
        <p className={styles.panelNote}>최근 100개를 이 브라우저에 저장해요.</p>
        <div className={styles.messageList} ref={listRef} role="log" aria-label="현재 대화" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && <div className={styles.emptyConversation}>아직 나눈 말이 없어요.<br />내가 말한 문장과 상대방의 말을<br />여기에서 함께 볼 수 있어요.</div>}
          {messages.map(message => (
            <article key={message.id} className={styles.message} data-role={message.role}>
              <div className={styles.messageMeta}><strong>{message.role === "self" ? "나" : "상대방"}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time></div>
              <p>{message.text}</p>
              <div className={styles.messageActions}><span>{STATUS[message.status]}</span>{message.role === "self" && <button type="button" disabled={disabled} onClick={() => onSpeak(message.text)} aria-label={`${message.text} 다시 말하기`}>다시 말하기</button>}</div>
            </article>
          ))}
        </div>
        <form onSubmit={event => { event.preventDefault(); if (!partnerText.trim() || disabled) return; addMessage("partner", partnerText); setPartnerText(""); }} className={styles.partnerForm}>
          <label htmlFor={compact ? "partner-home" : "partner-input"}>상대방의 말</label>
          <textarea id={compact ? "partner-home" : "partner-input"} value={partnerText} onChange={event => setPartnerText(event.target.value)} maxLength={500} rows={2} placeholder="상대방이 직접 적어주세요" disabled={disabled} />
          <button type="submit" className={styles.navButton} disabled={disabled || !partnerText.trim()}>대화에 추가</button>
        </form>
        <label className={styles.panelToggle}><input type="checkbox" checked={shareContext} onChange={event => onShareContext(event.target.checked)} />추천에 최근 대화 반영</label>
        <p className={styles.panelNote}>{shareContext ? "추천을 요청할 때 최근 대화 6개를 Gemini에 함께 보내요." : "대화 기록은 추천 서비스에 보내지 않아요."}</p>
        {confirmClear ? <div className={styles.clearActions}><span>이 브라우저의 기록을 비울까요?</span><button type="button" onClick={() => { clearConversation(); setConfirmClear(false); }}>기록 비우기</button><button type="button" onClick={() => setConfirmClear(false)}>취소</button></div> : <button type="button" className={styles.textButton} disabled={!messages.length} onClick={() => setConfirmClear(true)}>기록 비우기</button>}
      </div>
    </details>
  );
}
