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
  { gesture: "blink", label: "Blink", key: "Space", description: "Look toward an option, then blink once to select it.\n\nFor diagonal directions, press the two arrow keys in sequence. Hold your gaze for 1.5 seconds to select Categories or Free input on Home, initials, categories or quick replies." },
  { gesture: "long", label: "Long blink", key: "Hold Space · 1.5 s", description: "Face forward and hold to turn rest mode on or off.\n\nHold while looking at Delete to clear your draft, or a phrase to speak it." },
  { gesture: "double", label: "Double blink", key: "Space twice", description: "Blink twice within 0.35 seconds to speak your message.\n\nIf a toolbar button is highlighted, select that button instead." },
  { gesture: "converge", label: "Converge", key: "G", description: "Turn both eyes inward to speak the message you selected or spelled." },
  { gesture: "left", label: "Left wink", key: "C", description: "Move left along the toolbar. Start at the leftmost button.\n\nBlink to select it. In conversation history, scroll up." },
  { gesture: "right", label: "Right wink", key: "M", description: "Move right along the toolbar. Start at the rightmost button.\n\nBlink to select it. In conversation history, scroll down." },
  { gesture: "frown", label: "Strong frown", key: "Enter", description: "Stop speaking and cancel the current selection.\n\nIn conversation history, return to the previous screen." },
  { gesture: "brows", label: "Eyebrow raise", key: "R", description: "In 4-direction mode, switch between input and actions.\n\nYour draft stays in place." },
];

export function GestureGuide({ activeGesture }: { activeGesture: Gesture | null }) {
  return <section className={styles.gestureGuide} aria-label="Eye gestures and keyboard shortcuts">
    {gestures.map(item => <article key={item.gesture} className={styles.gestureCard} data-gesture={item.gesture} data-active={activeGesture === item.gesture}>
      <div className={styles.gestureIcon}><FaceIcon gesture={item.gesture} /></div>
      <h2>{item.label}</h2><kbd>{item.key}</kbd><p>{item.description}</p>
    </article>)}
  </section>;
}
