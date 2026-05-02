import { NextResponse } from "next/server";
import { getRoom } from "@/lib/match-store";

export async function GET(_: Request, context: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await context.params;
  const room = getRoom(roomId);

  if (!room) {
    return NextResponse.json({ message: "部屋が見つかりません。" }, { status: 404 });
  }

  return NextResponse.json({ room });
}
