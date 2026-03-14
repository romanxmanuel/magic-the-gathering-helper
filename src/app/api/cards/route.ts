import { NextRequest, NextResponse } from "next/server";

import { searchCommanderLegalCards } from "@/lib/mtg/scryfall";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const colors = request.nextUrl.searchParams
    .get("colors")
    ?.split(",")
    .map((color) => color.trim())
    .filter(Boolean);

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const cards = await searchCommanderLegalCards(query, colors ?? []);
    return NextResponse.json(cards);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search cards." },
      { status: 500 },
    );
  }
}
