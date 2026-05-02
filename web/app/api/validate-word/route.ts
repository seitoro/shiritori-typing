import { NextRequest, NextResponse } from "next/server";
import { isHiraganaOnly, normalizeWord } from "@/lib/shiritori";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
const MAX_WORD_LENGTH = 20;

type ValidatePayload = {
  previousWord?: string;
  candidateWord?: string;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "OPENAI_API_KEY が設定されていません。" },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as ValidatePayload | null;
  const candidateWord = body?.candidateWord?.trim();

  if (!candidateWord) {
    return NextResponse.json({ ok: false, reason: "ことばを入力してください。" }, { status: 400 });
  }

  if (candidateWord.length > MAX_WORD_LENGTH) {
    return NextResponse.json(
      { ok: false, normalized: normalizeWord(candidateWord), reason: "長すぎるため判定できません。" },
      { status: 400 }
    );
  }

  if (!isHiraganaOnly(candidateWord)) {
    return NextResponse.json(
      { ok: false, normalized: normalizeWord(candidateWord), reason: "ひらがなで入力してください。" },
      { status: 400 }
    );
  }

  const prompt = [
    "あなたは日本語しりとり用の語彙判定です。",
    "JSONでだけ答えてください。",
    "次の候補語が、一般的に実在する日本語の名詞または名詞句として自然なら exists を true にしてください。",
    "人名だけ、明らかな無意味文字列、俗語ではない単なるタイプミスは false にしてください。",
    "候補語はひらがな入力だけを前提にしてください。",
    "JSON 形式: {\"exists\": boolean, \"normalized\": string, \"reason\": string}",
    `前のことば: ${body?.previousWord ?? ""}`,
    `候補語: ${candidateWord}`
  ].join("\n");

  const response = await fetch(
    OPENAI_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        text: {
          format: {
            type: "json_object"
          }
        }
      }),
      signal: AbortSignal.timeout(10000)
    }
  ).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, reason: "AI判定がタイムアウトしました。" }, { status: 504 });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return NextResponse.json(
      { ok: false, reason: "AI判定に失敗しました。", detail: errorText.slice(0, 500) },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const rawText = extractOutputText(payload);

  if (!rawText) {
    return NextResponse.json({ ok: false, reason: "AIの返答を読めませんでした。" }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(rawText) as {
      exists?: boolean;
      normalized?: string;
      reason?: string;
    };

    if (!parsed.exists || !parsed.normalized) {
      return NextResponse.json({
        ok: false,
        normalized: normalizeWord(candidateWord),
        reason: parsed.reason ?? "存在しません。"
      });
    }

    return NextResponse.json({
      ok: true,
      normalized: normalizeWord(parsed.normalized),
      reason: parsed.reason ?? ""
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "AIの返答がJSONではありませんでした。" }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true, route: "validate-word" });
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text) {
    return payload.output_text;
  }

  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text) {
        return content.text;
      }
    }
  }

  return "";
}
