import { WORDS, WORD_ALIASES } from "@/lib/dictionary";

export type LogEntry = {
  actor: "YOU" | "AI" | "PLAYER1" | "PLAYER2" | "SYSTEM";
  word: string;
  note: string;
};

export type ValidationResult = {
  ok: boolean;
  normalized: string;
  reason?: string;
};

const SMALL_KANA = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "っ"]);

export function normalizeWord(input: string) {
  const compact = input
    .trim()
    .replace(/\s+/g, "")
    .replace(/ー/g, "")
    .replace(/を/g, "お")
    .replace(/づ/g, "ず")
    .replace(/ぢ/g, "じ");

  const alias = WORD_ALIASES[compact] ?? WORD_ALIASES[compact.toUpperCase()];
  const source = alias ?? compact;

  return [...source]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCharCode(code - 0x60);
      }
      return char;
    })
    .join("")
    .toLowerCase();
}

export function isHiraganaOnly(input: string) {
  const compact = input.trim().replace(/\s+/g, "");
  if (!compact) {
    return false;
  }
  return /^[ぁ-ゖー]+$/u.test(compact);
}

export function getLastKana(word: string) {
  const chars = [...normalizeWord(word)];
  const last = chars.at(-1) ?? "";
  const prev = chars.at(-2) ?? "";
  return SMALL_KANA.has(last) && prev ? prev : last;
}

export function calculatePoints(word: string) {
  return [...normalizeWord(word)].length * 10;
}

export function validateWord(params: {
  previousWord: string;
  candidateWord: string;
  usedWords: string[];
}) {
  const normalized = normalizeWord(params.candidateWord);
  if (!normalized) {
    return { ok: false, normalized, reason: "ことばを入力してください。" } satisfies ValidationResult;
  }

  if (params.usedWords.includes(normalized)) {
    return { ok: false, normalized, reason: "そのことばはもう使われています。" } satisfies ValidationResult;
  }

  const required = getLastKana(params.previousWord);
  if (normalized[0] !== required) {
    return { ok: false, normalized, reason: `「${required}」から始まることばを入れてください。` } satisfies ValidationResult;
  }

  if (normalized.endsWith("ん")) {
    return { ok: false, normalized, reason: "「ん」で終わっているため失格です。" } satisfies ValidationResult;
  }

  return { ok: true, normalized } satisfies ValidationResult;
}

export function pickAiWord(previousWord: string, usedWords: string[]) {
  const required = getLastKana(previousWord);
  const candidates = WORDS
    .map((word) => normalizeWord(word))
    .filter((word) => word[0] === required && !usedWords.includes(word) && !word.endsWith("ん"));

  if (!candidates.length) {
    return "";
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
