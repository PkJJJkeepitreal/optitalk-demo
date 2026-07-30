import { GoogleGenAI } from "@google/genai";

const HANGUL_INITIALS = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const HANGUL_INITIAL_SET = new Set<string>(HANGUL_INITIALS);

const recommendationSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 12,
      maxItems: 12,
      description: "환자가 사용할 수 있는 서로 다른 추천 문장 후보 12개",
    },
  },
  required: ["suggestions"],
};

function normalizeInitialInput(value: string): string {
  return Array.from(value)
    .filter((character) => HANGUL_INITIAL_SET.has(character))
    .join("");
}

function getHangulInitial(character: string): string | null {
  const code = character.charCodeAt(0);

  if (code >= 0xac00 && code <= 0xd7a3) {
    const initialIndex = Math.floor((code - 0xac00) / 588);
    return HANGUL_INITIALS[initialIndex];
  }

  if (HANGUL_INITIAL_SET.has(character)) {
    return character;
  }

  return null;
}

function extractHangulInitials(text: string): string {
  const result: string[] = [];

  for (const character of Array.from(text)) {
    const initial = getHangulInitial(character);

    if (initial) {
      result.push(initial);
    }
  }

  return result.join("");
}

function matchesMixedPrefix(sentence: string, pattern: string): boolean {
  const sentenceCharacters = Array.from(sentence);
  const patternCharacters = Array.from(pattern);
  let sentenceIndex = 0;

  for (const patternCharacter of patternCharacters) {
    if (HANGUL_INITIAL_SET.has(patternCharacter)) {
      // 초성 문자열에는 띄어쓰기와 문장부호가 포함되지 않으므로,
      // 다음 한글 음절을 찾을 때 비한글 문자는 건너뜁니다.
      while (
        sentenceIndex < sentenceCharacters.length &&
        getHangulInitial(sentenceCharacters[sentenceIndex]) === null
      ) {
        sentenceIndex += 1;
      }

      if (
        sentenceIndex >= sentenceCharacters.length ||
        getHangulInitial(sentenceCharacters[sentenceIndex]) !== patternCharacter
      ) {
        return false;
      }

      sentenceIndex += 1;
      continue;
    }

    // 사용자가 직접 입력한 완성 글자·공백·문장부호는 그대로 유지합니다.
    if (
      sentenceIndex >= sentenceCharacters.length ||
      sentenceCharacters[sentenceIndex] !== patternCharacter
    ) {
      return false;
    }

    sentenceIndex += 1;
  }

  return true;
}

function uniqueSentences(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const rawInput =
      typeof body.input === "string"
        ? body.input.trim()
        : "";

    const mode =
      body.mode === "direct"
        ? "direct"
        : body.mode === "mixed"
          ? "mixed"
          : "initial";

    if (!rawInput) {
      return new Response(
        JSON.stringify({
          error: "입력 내용이 없습니다.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        }
      );
    }

    if (rawInput.length > 100) {
      return new Response(
        JSON.stringify({
          error: "입력 내용이 너무 깁니다.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY가 설정되지 않았습니다.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        }
      );
    }

    const normalizedInitialInput =
      mode === "initial"
        ? normalizeInitialInput(rawInput)
        : "";

    if (mode === "initial" && !normalizedInitialInput) {
      return new Response(
        JSON.stringify({
          error: "올바른 한글 초성을 입력해 주세요.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const collected: string[] = [];

    for (let attempt = 1; attempt <= 2 && collected.length < 6; attempt += 1) {
      const modeInstruction =
        mode === "initial"
          ? `
입력값은 어절마다 하나씩 적은 초성이 아닙니다.
문장 전체에 포함된 모든 한글 음절을 한 글자씩 초성으로 바꾼 연속 문자열입니다.

반드시 지켜야 하는 규칙:
- 입력값은 완성 문장 전체가 아니라 문장 앞부분의 초성일 수 있습니다.
- 완성 문장의 모든 한글 음절 초성을 순서대로 이어 붙였을 때 반드시 입력값으로 시작해야 합니다.
- 입력 초성 하나는 완성 문장 앞부분의 한글 음절 하나에 대응합니다.
- 입력된 초성의 순서와 글자 수는 바꾸거나 생략하면 안 됩니다.
- 입력된 초성 뒤에는 자연스러운 문장을 만들기 위한 초성을 추가해도 됩니다.
- 어절의 첫 글자만 맞추는 방식은 금지합니다.
- 쌍자음 초성은 ㄲ, ㄸ, ㅃ, ㅆ, ㅉ 그대로 구분합니다.
- 가능한 한 짧고 자연스러운 완성 문장을 만드세요.

이번 입력 초성 접두부:
${normalizedInitialInput}
          `.trim()
          : mode === "mixed"
            ? `
입력값에는 사용자가 직접 완성한 글자와 초성 자음이 섞여 있을 수 있습니다.

반드시 지켜야 하는 규칙:
- 완성된 한글, 영문, 숫자, 공백, 문장부호는 사용자가 직접 입력한 글자이므로 그대로 유지하세요.
- 독립된 초성 자음 ㄱ~ㅎ은 각각 아직 완성하지 않은 한글 음절 한 글자를 뜻합니다.
- 각 초성 자음은 같은 초성으로 시작하는 한글 음절 한 글자로 바꾸세요.
- 연속된 초성 자음 사이에는 완성 문장에서 띄어쓰기가 들어갈 수 있습니다.
- 초성 자음 사이에 들어간 띄어쓰기는 초성 순서에 포함하지 않습니다.
- 입력 패턴 전체를 문장 맨 앞에서 순서대로 정확히 만족해야 합니다.
- 입력 패턴 뒤에는 자연스러운 문장을 자유롭게 이어서 완성해도 됩니다.
- 쌍자음 초성은 ㄲ, ㄸ, ㅃ, ㅆ, ㅉ 그대로 구분하세요.
- 가능한 한 짧고 자연스러운 문장을 만드세요.

예시 1:
입력 패턴: ㅁㅈㅅㅇ
가능한 결과: 물 주세요.
검산: 띄어쓰기를 제외한 한글 음절의 초성은 ㅁㅈㅅㅇ입니다.

예시 2:
입력 패턴: 김예리 ㅂㅂ
가능한 결과: 김예리 바보 같아요.
검산: "김예리 "는 그대로 유지되고, 뒤의 두 음절 "바", "보"의 초성은 ㅂ, ㅂ입니다.

이번 혼합 입력 패턴:
${rawInput}
            `.trim()
            : `
입력된 문장을 자연스럽게 이어서 완성하세요.
- 사용자가 입력한 앞부분을 변경하지 마세요.
- 모든 추천 문장은 사용자 입력으로 시작해야 합니다.
- 뒤에 자연스럽고 짧은 표현을 이어 붙이세요.
            `.trim();

      const previousCandidates =
        collected.length > 0
          ? `\n이미 확보한 문장과 중복하지 마세요:\n${collected.join("\n")}`
          : "";

      const prompt = `
당신은 말하기 어려운 환자를 위한 한국어 AAC 문장 추천 시스템입니다.

입력 모드: ${mode}
사용자 입력: ${rawInput}

${modeInstruction}

공통 규칙:
- 서로 다른 추천 후보 12개를 만드세요.
- 환자가 의료진, 보호자 또는 간병인에게 말하는 표현으로 작성하세요.
- 짧고 자연스럽고 정중한 문장으로 작성하세요.
- 진단이나 치료를 단정하지 마세요.
- 의료 처치를 임의로 지시하지 마세요.
- 응급 상황을 임의로 만들어 내지 마세요.
- 설명, 번호, 초성 검산 문구 없이 문장만 반환하세요.
${previousCandidates}
      `.trim();

      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        store: false,
        input: prompt,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: recommendationSchema,
        },
      });

      const outputText = interaction.output_text;

      if (!outputText) {
        continue;
      }

      const parsed = JSON.parse(outputText) as {
        suggestions?: unknown[];
      };

      const candidates = uniqueSentences(
        Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : []
      );

      const validCandidates =
        mode === "initial"
          ? candidates.filter((sentence) =>
              extractHangulInitials(sentence).startsWith(normalizedInitialInput)
            )
          : mode === "mixed"
            ? candidates.filter((sentence) =>
                matchesMixedPrefix(sentence, rawInput)
              )
            : candidates.filter((sentence) =>
                sentence.startsWith(rawInput)
              );

      for (const sentence of validCandidates) {
        if (!collected.includes(sentence)) {
          collected.push(sentence);
        }

        if (collected.length === 6) {
          break;
        }
      }
    }

    if (collected.length < 6) {
      throw new Error(
        mode === "initial"
          ? "입력한 초성으로 시작하는 자연스러운 문장 6개를 만들지 못했습니다."
          : mode === "mixed"
            ? "직접 입력과 초성이 섞인 조건에 맞는 문장 6개를 만들지 못했습니다."
            : "조건에 맞는 추천 문장 6개를 만들지 못했습니다."
      );
    }

    return new Response(
      JSON.stringify({
        suggestions: collected.slice(0, 6),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error("Gemini recommendation error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "추천 문장을 생성하지 못했습니다.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }
}
