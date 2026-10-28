Glim AAC v3 English is an English-language communication interface for the US competition demo.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## English input

Choose **Free input** to start with **English word initials**. Each letter represents one word: `IWW` can expand to “I want water.” Choose **Suggest** to generate English sentences.

The lower-left **English full input** button switches to spelling. Both modes use the same letter groups and keep the letter selection open after each character. Switching modes preserves the draft and whether each segment contains initials or fully spelled text. Fully spelled words are underlined; word initials are not. Mode controls use a light blue color to distinguish them from letter and action buttons.

In 4-direction mode, raise your eyebrows (`R`) to access the actions layer, including the input-mode switch. Full input has a direct **Space** action and toolbar shortcuts for **Space** and **Symbols**. If suggestions are unavailable, clearly labeled common English phrases remain available.

The UI, built-in phrases, speech output, suggestion prompts, and error messages use English. This version has its own browser storage for preferences and conversation history; previous versions' history remains in their original storage.

## Conversation history

Open **History** from the toolbar or **Conversation history** from Home. Returning preserves the draft.

- Left wink: scroll up. Right wink: scroll down.
- The demo uses `C` / `M` or the on-screen wink buttons. Arrow keys also scroll the history. Camera recognition is not included.
- Press `Enter` or `Escape`, or choose **Back**, to return. Typing in a text field keeps normal keyboard behavior.
- A hardware recognizer can emit the following event once per completed wink. `eye` refers to the user's own eye, not the mirrored video.

```js
window.dispatchEvent(new CustomEvent("glim:wink", { detail: { eye: "left" } }));
// eye: "right" scrolls down.
```

This event is handled while conversation history is open.

## Learn More

### v3 English gestures

| Gesture | Key | Action |
| --- | --- | --- |
| Blink | Space | Select a direction; waits 350 ms to distinguish a double blink |
| Long blink | Hold Space for 1.5 s | Clear on Delete, speak on a phrase, or toggle rest while facing forward |
| Double blink | Space twice within 350 ms | Speak the message, or activate the highlighted toolbar button |
| Converge | G | Speak the selected or fully spelled message |
| Left / right wink | C / M | Move left / right along the toolbar; scroll history up / down |
| Strong frown | Enter | Stop speaking and cancel selection; return from history |
| Eyebrow raise | R | Switch between input and actions in 4-direction mode |

The guide shows gesture feedback. Text fields and Ctrl/Alt/Command shortcuts keep their normal behavior. Hold a direction for 1.5 seconds to select initials, categories, phrases, or quick replies.

Winks start from the leftmost or rightmost toolbar button, skip disabled buttons, and stop at the ends. Space activates the highlighted button. Enter clears the highlight; arrow keys return to directional input.

Set `GEMINI_API_KEY` in `.env.local` for suggestions. Existing English-compatible Gemini requests are used; speech uses the browser's English voice. Tests and a local build were intentionally not run for this change at the user's request.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
