import { NextRequest, NextResponse } from "next/server";

import { normalizeColorIdentity } from "@/lib/mtg/colors";
import { fetchTopCommandersByColor } from "@/lib/mtg/edhrec";

export async function GET(request: NextRequest) {
  const colors = normalizeColorIdentity(
    request.nextUrl.searchParams
      .get("colors")
      ?.split(",")
      .map((color) => color.trim())
      .filter(Boolean),
  );

  if (colors.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const commanders = await fetchTopCommandersByColor(colors);
    return NextResponse.json(commanders);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch color commanders." },
      { status: 500 },
    );
  }
}
