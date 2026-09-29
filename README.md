This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## 대화 기록 데모 입력

홈 또는 입력 화면의 `대화 기록` 버튼으로 엽니다. 홈에서는 왼쪽 위 방향 선택 후 Space로도 열 수 있습니다. 돌아가면 기존 작성 내용이 유지됩니다.

- 왼쪽 윙크: 위로 이동. 오른쪽 윙크: 아래로 이동.
- 카메라 인식기는 아직 포함되지 않습니다. 데모에서는 좌/우 방향키 또는 윙크 버튼으로 같은 동작을 시험합니다. 상/하 방향키도 지원하며 길게 눌러도 한 번만 이동합니다.
- `Escape` 또는 `돌아가기` 버튼으로 이전 화면으로 돌아갑니다. 텍스트 입력 중에는 방향키가 편집용으로 동작합니다.
- 인식기 연동: 완료된 윙크마다 아래 이벤트를 한 번 발행합니다. 프레임마다 발행하지 않습니다. `eye`는 환자 본인의 눈 기준이며, 미러링한 영상의 좌우 기준이 아닙니다.

```js
window.dispatchEvent(new CustomEvent("glim:wink", { detail: { eye: "left" } }));
// eye: "right" → 아래로 이동
```

이 이벤트는 대화 기록 화면이 열려 있을 때만 처리됩니다. 다른 화면의 문자 선택이나 음성 출력에는 영향을 주지 않습니다.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
