import { NextRequest, NextResponse } from "next/server";
import { getCards, type CardBlock } from "@/lib/db";

export async function GET(request: NextRequest) {
  const block = request.nextUrl.searchParams.get("block") as CardBlock | null;

  try {
    const cards = getCards(block || undefined);
    return NextResponse.json({ cards, count: cards.length });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
