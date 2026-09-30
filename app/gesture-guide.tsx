import styles from "./interface.module.css";

export type Gesture = "blink" | "long" | "double" | "converge" | "left" | "right" | "frown" | "brows";

function FaceIcon({ gesture }: { gesture: Gesture }) {
  const closed = ["blink", "long", "double", "frown"].includes(gesture);
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="32" cy="32" r="26" />
    {closed || gesture === "left" ? <path d="M16 29q6 6 12 0" /> : <ellipse cx="22" cy="30" rx="4" ry="5" />}
    {closed || gesture === "right" ? <path d="M36 29q6 6 12 0" /> : <ellipse cx="42" cy="30" rx="4" ry="5" />}
    {gesture === "frown" ? <path d="m16 20 12 5m8 0 12-5M24 46q8-7 16 0" /> : <path d="M24 44q8 6 16 0" />}
    {gesture === "brows" && <path d="M15 19q7-7 14 0m6 0q7-7 14 0m-8-9 3-4 3 4M19 10l3-4 3 4" />}
    {gesture === "converge" && <><circle cx="27" cy="30" r="2" fill="currentColor" stroke="none" /><circle cx="37" cy="30" r="2" fill="currentColor" stroke="none" /><path d="m15 18 8 3m26-3-8 3" /></>}
    {gesture === "double" && <path d="m51 7 4-4m0 11 6-1" />}
    {gesture === "long" && <path d="M22 53h20" />}
  </svg>;
}

const gestures: { gesture: Gesture; label: string; key: string; description: string }[] = [
  { gesture: "blink", label: "눈 깜빡임", key: "Space", description: "방향을 고른 뒤 한 번 눌러 선택합니다.\n\n대각선은 두 방향키를 순서대로 누릅니다." },
  { gesture: "long", label: "길게 눈 감기", key: "Space 1.5초", description: "자음을 길게 선택하면 쌍자음을 입력합니다.\n\n방향 없이 길게 누르면 휴식 모드를 전환합니다." },
  { gesture: "double", label: "더블 블링크", key: "Space 두 번", description: "빠르게 두 번 눌러 작성·선택한 문장을 말합니다.\n\n두 번째 입력은 0.35초 안에 해주세요." },
  { gesture: "converge", label: "Converge", key: "G", description: "두 눈을 안쪽으로 모아 작성·선택한 문장을 바로 말합니다." },
  { gesture: "left", label: "왼쪽 윙크", key: "C", description: "지정된 도구에서 왼쪽으로 이동합니다. 처음에는 맨 왼쪽을 지정합니다.\n\nSpace로 선택합니다. 대화 기록에서는 위로 스크롤합니다." },
  { gesture: "right", label: "오른쪽 윙크", key: "M", description: "지정된 도구에서 오른쪽으로 이동합니다. 처음에는 맨 오른쪽을 지정합니다.\n\nSpace로 선택합니다. 대화 기록에서는 아래로 스크롤합니다." },
  { gesture: "frown", label: "강하게 찡그림", key: "Enter", description: "음성 출력을 멈추고 현재 선택을 취소합니다.\n\n대화 기록에서는 이전 화면으로 돌아갑니다." },
  { gesture: "brows", label: "눈썹 올리기", key: "R", description: "4방향 모드에서 글자·문장과 기능 레이어를 전환합니다.\n\n작성 중인 내용은 유지됩니다." },
];

export function GestureGuide({ activeGesture }: { activeGesture: Gesture | null }) {
  return <section className={styles.gestureGuide} aria-label="동작별 입력 키">
    {gestures.map(item => <article key={item.gesture} className={styles.gestureCard} data-gesture={item.gesture} data-active={activeGesture === item.gesture}>
      <div className={styles.gestureIcon}><FaceIcon gesture={item.gesture} /></div>
      <h2>{item.label}</h2><kbd>{item.key}</kbd><p>{item.description}</p>
    </article>)}
  </section>;
}
