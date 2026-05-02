import { NextRequest, NextResponse } from "next/server";
import { submitBattleWord } from "@/lib/match-store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    roomId?: string;
    playerId?: string;
    word?: string;
  };

  if (!body.roomId || !body.playerId || !body.word) {
    return NextResponse.json({ ok: false, message: "必要な情報が不足しています。" }, { status: 400 });
  }

  const result = submitBattleWord({
    roomId: body.roomId,
    playerId: body.playerId,
    word: body.word
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
