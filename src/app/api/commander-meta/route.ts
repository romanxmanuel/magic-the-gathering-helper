import { NextRequest, NextResponse } from "next/server";

import { fetchCommanderMeta } from "@/lib/mtg/edhrec";
import { fetchSpellbookCommanderInsight } from "@/lib/mtg/spellbook";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  const name = request.nextUrl.searchParams.get("name")?.trim();
  const tag = request.nextUrl.searchParams.get("tag")?.trim() || null;

  if (!slug) {
    return NextResponse.json({ error: "Commander slug is required." }, { status: 400 });
  }

  try {
    const [meta, spellbook] = await Promise.all([
      fetchCommanderMeta(slug, tag),
      name
        ? fetchSpellbookCommanderInsight(name).catch(() => null)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...meta,
      spellbook,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch commander meta." },
      { status: 500 },
    );
  }
}
