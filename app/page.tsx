"use client";

import { useMemo, useState } from "react";

const INITIAL_GROUPS = ["ㄱ", "ㅁ", "ㅅ", "ㅇ", "→"];

const SENTENCE_MAP: Record<string, string[]> = {
  "ㅇ": [
    "아파요.",
    "어지러워요.",
    "의사 선생님을 불러주세요.",
    "오늘은 괜찮아요.",
    "옆으로 눕고 싶어요.",
    "엄마를 불러주세요.",
  ],
  "ㅇㄷ": [
    "오늘 도와주세요.",
    "어디 다녀오셨어요?",
    "운동 다시 하고 싶어요.",
    "약을 더 주세요.",
    "의사에게 데려다주세요.",
    "오늘도 감사합니다.",
  ],
  "ㅇㄷㄱ": [
    "오늘 도와주셔서 감사해요.",
    "의사 선생님께 도움을 구해주세요.",
    "오늘도 곁에 있어 주세요.",
    "운동을 다시 가르쳐 주세요.",
    "약을 더 가져다주세요.",
    "오늘 대화해서 기뻐요.",
  ],
};

export default function Home() {
  const [input, setInput] = useState("");
  const [selectedSentence, setSelectedSentence] = useState("");
  const [isResting, setIsResting] = useState(false);

  const suggestions = useMemo(() => {
    if (SENTENCE_MAP[input]) {
      return SENTENCE_MAP[input];
    }

    return [
      `${input || "초성"}에 맞는 문장 추천 1`,
      `${input || "초성"}에 맞는 문장 추천 2`,
      `${input || "초성"}에 맞는 문장 추천 3`,
      `${input || "초성"}에 맞는 문장 추천 4`,
      `${input || "초성"}에 맞는 문장 추천 5`,
      `${input || "초성"}에 맞는 문장 추천 6`,
    ];
  }, [input]);

  const handleInitial = (letter: string) => {
    if (isResting) return;

    if (letter === "→") {
      setInput((previous) => previous.slice(0, -1));
      return;
    }

    setInput((previous) => previous + letter);
    setSelectedSentence("");
  };

  const speak = () => {
    if (!selectedSentence) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(selectedSentence);
    utterance.lang = "ko-KR";
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
  };

  const reset = () => {
    window.speechSynthesis.cancel();
    setInput("");
    setSelectedSentence("");
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-600">
              EOG · EMG · LLM AAC Demo
            </p>
            <h1 className="text-3xl font-bold">OptiTalk</h1>
          </div>

          <button
            type="button"
            onClick={() => setIsResting((previous) => !previous)}
            className={`rounded-2xl px-5 py-3 font-semibold ${
              isResting
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-700 shadow"
            }`}
          >
            {isResting ? "휴식 해제" : "휴식 모드"}
          </button>
        </header>

        {isResting ? (
          <section className="flex min-h-[520px] items-center justify-center rounded-3xl bg-slate-900 p-8 text-center text-white">
            <div>
              <p className="mb-3 text-5xl">◉</p>
              <h2 className="mb-2 text-2xl font-bold">휴식 모드</h2>
              <p className="text-slate-300">
                오입력을 방지하기 위해 입력이 잠시 중단되었습니다.
              </p>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-500">
                SELECTION ZONE
              </p>

              <div className="grid grid-cols-5 gap-3">
                {INITIAL_GROUPS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleInitial(letter)}
                    className="min-h-24 rounded-2xl border-2 border-slate-200 bg-slate-50 text-3xl font-bold transition hover:border-blue-500 hover:bg-blue-50 active:scale-95"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-6 text-center">
              <p className="mb-2 text-sm font-semibold text-blue-600">
                WORK ZONE
              </p>
              <p className="min-h-12 text-4xl font-bold tracking-[0.25em]">
                {input || "초성을 입력하세요"}
              </p>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-500">
                SUGGESTION ZONE
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                {suggestions.map((sentence) => {
                  const isSelected = selectedSentence === sentence;

                  return (
                    <button
                      key={sentence}
                      type="button"
                      onClick={() => setSelectedSentence(sentence)}
                      className={`min-h-24 rounded-2xl border-2 p-4 text-left text-lg font-semibold transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white hover:border-blue-400"
                      }`}
                    >
                      {sentence}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-3xl bg-slate-900 p-5 text-white md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-400">최종 선택 문장</p>
                <p className="mt-1 text-xl font-semibold">
                  {selectedSentence || "추천 문장을 선택하세요."}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl bg-slate-700 px-5 py-3 font-semibold"
                >
                  초기화
                </button>

                <button
                  type="button"
                  onClick={speak}
                  disabled={!selectedSentence}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  확인 후 말하기
                </button>
              </div>
            </section>
          </div>
        )}

        <footer className="mt-5 text-center text-sm text-slate-500">
          데모 조작: 버튼 클릭 = 시선 선택 및 깜빡임
        </footer>
      </div>
    </main>
  );
}