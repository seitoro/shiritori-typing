import { NextRequest, NextResponse } from "next/server";
import { joinOrCreateRoom } from "@/lib/match-store";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { keyword?: string };
  const keyword = body.keyword?.trim();

  if (!keyword) {
    return NextResponse.json({ message: "合言葉を入れてください。" }, { status: 400 });
  }

  const result = joinOrCreateRoom(keyword);
  return NextResponse.json(result);
}
