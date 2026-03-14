import { NextRequest, NextResponse } from "next/server";

import { normalizeColorIdentity } from "@/lib/mtg/colors";
import { searchCommanderCards } from "@/lib/mtg/scryfall";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const colors = normalizeColorIdentity(
    request.nextUrl.searchParams
      .getAll("colors")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const commanders = await searchCommanderCards(query);
    const filtered =
      colors.length > 0
        ? commanders.filter(
            (commander) =>
              commander.colorIdentity.length === colors.length &&
              commander.colorIdentity.every((color) => colors.includes(color)),
          )
        : commanders;

    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to search commanders." },
      { status: 500 },
    );
  }
}
