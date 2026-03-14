import { searchLegalCards } from "@/lib/mtg";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const colors = request.nextUrl.searchParams.getAll("colors");

  try {
    const cards = await searchLegalCards(query, colors);
    return NextResponse.json(cards);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search legal cards.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
