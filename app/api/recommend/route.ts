import { GoogleGenAI } from "@google/genai";

const HANGUL_INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const HANGUL_INITIAL_SET = new Set<string>(HANGUL_INITIALS);

type InputSegmentType = "literal" | "ko-initial" | "en-initial";
type InputSegment = { type: InputSegmentType; text: string };

const recommendationSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: { type: "string" },
      minItems: 12,
      maxItems: 12,
      description: "AAC 추천 문장 후보 12개",
    },
  },
  required: ["suggestions"],
};

function getHangulInitial(character: string): string | null {
  const code = character.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const initialIndex = Math.floor((code - 0xac00) / 588);
    return HANGUL_INITIALS[initialIndex];
  }
  if (HANGUL_INITIAL_SET.has(character)) return character;
  return null;
}

function isSeparator(character: string): boolean {
  return /[\s.,!?…:;"'`()\[\]{}\-_/\\]/.test(character);
}

function sanitizeSegments(value: unknown): InputSegment[] {
  if (!Array.isArray(value)) return [];

  const allowed = new Set<InputSegmentType>([
    "literal",
    "ko-initial",
    "en-initial",
  ]);

  return value
    .filter(
      (item): item is InputSegment =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        "text" in item &&
        typeof item.type === "string" &&
        allowed.has(item.type as InputSegmentType) &&
        typeof item.text === "string"
    )
    .map((item) => ({
      type: item.type as InputSegmentType,
      text: item.text,
    }))
    .filter((item) => item.text.length > 0);
}

function inferLegacySegments(
  rawInput: string,
  mode: "initial" | "direct" | "mixed"
): InputSegment[] {
  if (!rawInput) return [];
  if (mode === "initial") {
    return [{ type: "ko-initial", text: rawInput }];
  }
  if (mode === "direct") {
    return [{ type: "literal", text: rawInput }];
  }

  const result: InputSegment[] = [];
  let currentType: InputSegmentType | null = null;
  let currentText = "";

  const flush = () => {
    if (currentType && currentText) {
      result.push({ type: currentType, text: currentText });
    }
    currentType = null;
    currentText = "";
  };

  for (const character of Array.from(rawInput)) {
    const nextType: InputSegmentType = HANGUL_INITIAL_SET.has(character)
      ? "ko-initial"
      : "literal";

    if (currentType !== nextType) {
      flush();
      currentType = nextType;
    }
    currentText += character;
  }
  flush();
  return result;
}

function matchesStructuredPrefix(sentence: string, segments: InputSegment[]): boolean {
  const chars = Array.from(sentence);
  let index = 0;

  for (const segment of segments) {
    if (segment.type === "literal") {
      const literalChars = Array.from(segment.text);

      // 앞의 초성 구간이 실제 단어/음절로 확장되면 그 다음 직접 입력 구간과
      // 자연스럽게 띄어쓰기가 생길 수 있습니다. 사용자가 직접 공백을 입력한
      // 경우는 그대로 존중하고, 그렇지 않은 경우에만 구간 사이 구분자를 허용합니다.
      if (literalChars.length > 0 && !isSeparator(literalChars[0])) {
        while (index < chars.length && isSeparator(chars[index])) index += 1;
      }

      for (const expected of literalChars) {
        if (index >= chars.length) return false;

        const actual = chars[index];
        const bothEnglishLetters = /[A-Za-z]/.test(expected) && /[A-Za-z]/.test(actual);

        // 영어 직접 입력은 UI 특성상 대문자로 입력되더라도 자연스러운 문장에서는
        // John처럼 정상적인 대소문자로 표현될 수 있습니다. 철자 자체는 보존합니다.
        if (bothEnglishLetters) {
          if (actual.toUpperCase() !== expected.toUpperCase()) return false;
        } else if (actual !== expected) {
          return false;
        }

        index += 1;
      }
      continue;
    }

    if (segment.type === "ko-initial") {
      for (const expectedInitial of Array.from(segment.text)) {
        if (!HANGUL_INITIAL_SET.has(expectedInitial)) return false;

        while (index < chars.length && isSeparator(chars[index])) index += 1;
        if (index >= chars.length) return false;

        const actualInitial = getHangulInitial(chars[index]);
        if (actualInitial !== expectedInitial) return false;
        index += 1;
      }
      continue;
    }

    for (const expectedInitial of Array.from(segment.text)) {
      if (!/[A-Za-z]/.test(expectedInitial)) return false;

      while (index < chars.length && isSeparator(chars[index])) index += 1;
      if (index >= chars.length || !/[A-Za-z]/.test(chars[index])) return false;

      if (chars[index].toUpperCase() !== expectedInitial.toUpperCase()) {
        return false;
      }

      // 영어 초성 하나는 '한 단어'의 첫 글자를 뜻합니다.
      while (
        index < chars.length &&
        /[A-Za-z0-9'’.-]/.test(chars[index])
      ) {
        index += 1;
      }
    }
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

function describeSegments(segments: InputSegment[]): string {
  return segments
    .map((segment, index) => {
      if (segment.type === "ko-initial") {
        return `${index + 1}. [한글 음절 초성] ${JSON.stringify(segment.text)}`;
      }
      if (segment.type === "en-initial") {
        return `${index + 1}. [영어 단어 초성] ${JSON.stringify(segment.text)}`;
      }
      const containsEnglish = /[A-Za-z]/.test(segment.text);
      return `${index + 1}. [직접 입력${containsEnglish ? " · 고유명사" : ""}] ${JSON.stringify(segment.text)}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mode: "initial" | "direct" | "mixed" =
      body.mode === "direct"
        ? "direct"
        : body.mode === "mixed"
          ? "mixed"
          : "initial";

    const providedSegments = sanitizeSegments(body.segments);
    const fallbackInput = typeof body.input === "string" ? body.input : "";
    const segments =
      providedSegments.length > 0
        ? providedSegments
        : inferLegacySegments(fallbackInput, mode);

    const rawInput = segments.map((segment) => segment.text).join("");

    if (!rawInput.trim()) {
      return new Response(JSON.stringify({ error: "입력 내용이 없습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (rawInput.length > 120) {
      return new Response(
        JSON.stringify({ error: "입력 내용이 너무 깁니다." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    for (const segment of segments) {
      if (
        segment.type === "ko-initial" &&
        Array.from(segment.text).some((character) => !HANGUL_INITIAL_SET.has(character))
      ) {
        return new Response(
          JSON.stringify({ error: "한글 초성 입력 형식이 올바르지 않습니다." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }

      if (
        segment.type === "en-initial" &&
        !/^[A-Za-z]+$/.test(segment.text)
      ) {
        return new Response(
          JSON.stringify({ error: "영어 초성은 알파벳만 입력해 주세요." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const hasEnglishInitial = segments.some(
      (segment) => segment.type === "en-initial"
    );
    const hasEnglishLiteral = segments.some(
      (segment) => segment.type === "literal" && /[A-Za-z]/.test(segment.text)
    );

    const ai = new GoogleGenAI({ apiKey });
    const collected: string[] = [];

    for (let attempt = 1; attempt <= 3 && collected.length < 6; attempt += 1) {
      const prompt = `
당신은 말하기 어려운 환자를 위한 AAC 문장 추천 시스템입니다.

사용자 입력은 아래처럼 의미가 구분된 여러 구간으로 이루어져 있습니다.
${describeSegments(segments)}

입력 해석 규칙:
- [직접 입력] 구간은 사용자가 글자를 직접 철자한 부분입니다. 한 글자도 바꾸지 말고, 앞뒤의 다른 구간이 확장된 뒤에도 해당 위치에서 그대로 유지하세요.
- [직접 입력 · 고유명사]로 표시된 영문 구간은 사용자가 직접 철자한 사람 이름, 장소명, 제품명 등 고유명사입니다. 절대로 영어 초성으로 해석하지 말고, 철자는 그대로 보존하세요. 다만 UI에서 영문을 대문자로 입력했더라도 최종 문장에서는 John처럼 자연스러운 대소문자로 정규화할 수 있습니다. 앞의 초성 구간과 이 고유명사 사이에는 자연스러운 공백이나 문장부호를 넣어도 됩니다.
- [한글 음절 초성] 구간의 자음 하나는 한글 완성 음절 하나의 초성입니다. 어절 초성이 아니라 모든 한글 음절의 초성입니다.
- [영어 단어 초성] 구간의 알파벳 하나는 영어 단어 하나의 첫 글자입니다. 예: IWW → "I want water."처럼 해석합니다.
- 각 구간의 순서는 반드시 그대로 유지하세요. 예: [영어 단어 초성] "IW" 다음에 [직접 입력 · 고유명사] "John"이 오면 "I want John..."처럼 확장할 수 있습니다.
- 사용자가 입력한 구간은 문장 전체가 아니라 앞부분만 지정한 것일 수 있습니다. 조건을 모두 만족한 뒤에는 자연스럽게 문장을 더 이어도 됩니다.
- 영어 단어 초성 사이에는 실제 완성 문장에서 공백과 일반적인 문장부호가 들어갑니다.

문장 언어:
${hasEnglishInitial
  ? "- 영어 단어 초성이 포함되어 있으므로 최종 추천은 자연스러운 영어 문장으로 작성하세요."
  : "- 영어 단어 초성이 없으면 기본적으로 자연스러운 한국어 문장으로 작성하세요."}
${hasEnglishLiteral && !hasEnglishInitial
  ? "- 영문 고유명사가 있더라도 그 고유명사는 그대로 보존하고, 나머지 문장은 한국어로 작성해도 됩니다."
  : ""}

공통 규칙:
- 서로 다른 후보 12개를 만드세요.
- 환자가 의료진, 보호자 또는 간병인에게 실제로 말할 법한 짧고 자연스러운 표현을 우선하세요.
- 진단이나 치료를 단정하지 마세요.
- 의료 처치를 임의로 지시하지 마세요.
- 응급 상황을 입력에 없는데 임의로 만들어 내지 마세요.
- 설명, 번호, 검산 문구 없이 추천 문장만 구조화된 결과로 반환하세요.
${collected.length > 0 ? `이미 확보한 문장과 중복하지 마세요:\n${collected.join("\n")}` : ""}
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
      if (!outputText) continue;

      const parsed = JSON.parse(outputText) as { suggestions?: unknown[] };
      const candidates = uniqueSentences(
        Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      );

      const validCandidates = candidates.filter((sentence) =>
        matchesStructuredPrefix(sentence, segments)
      );

      for (const sentence of validCandidates) {
        if (!collected.includes(sentence)) collected.push(sentence);
        if (collected.length === 6) break;
      }
    }

    if (collected.length < 6) {
      throw new Error(
        hasEnglishInitial
          ? "입력한 영어 초성과 고유명사 조건에 맞는 문장 6개를 만들지 못했습니다."
          : "입력 조건에 맞는 문장 6개를 만들지 못했습니다."
      );
    }

    return new Response(
      JSON.stringify({ suggestions: collected.slice(0, 6) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
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
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
