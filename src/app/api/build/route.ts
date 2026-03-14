import { buildCommanderDeck } from "@/lib/deck-builder";
import type { CommanderBracket } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const buildRequestSchema = z.object({
  commanderName: z.string().trim().min(1).optional(),
  colors: z.array(z.string()).default([]),
  bracket: z.coerce.number().int().min(1).max(5),
  focus: z.string().trim().max(120).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = buildRequestSchema.parse(json);

    if (!payload.commanderName && payload.colors.length === 0) {
      return NextResponse.json(
        { error: "Choose a commander or a color identity before building." },
        { status: 400 },
      );
    }

    const deck = await buildCommanderDeck({
      commanderName: payload.commanderName,
      colors: payload.colors,
      bracket: payload.bracket as CommanderBracket,
      focus: payload.focus,
    });

    return NextResponse.json(deck);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid build request." },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to build deck.";
    const status =
      message === "Choose a commander or a color identity before building."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
