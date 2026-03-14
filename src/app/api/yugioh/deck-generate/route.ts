import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateYugiohDeckShell } from "@/lib/games/yugioh/generator";

const ThemeSchema = z.object({
  query: z.string(),
  resolvedArchetype: z.string().nullable(),
  resolvedBossCards: z.array(z.string()),
  resolvedSupportCards: z.array(z.string()),
});

const PayloadSchema = z.object({
  theme: ThemeSchema,
  buildIntent: z.enum([
    "pure",
    "hybrid",
    "anti-meta",
    "consistency-first",
    "ceiling-first",
    "blind-second",
    "grind",
  ]),
  strengthTarget: z.enum(["casual", "strong", "tournament-level", "degenerate"]),
  constraints: z.array(
    z.enum([
      "pure-only",
      "avoid-floodgates",
      "low-brick",
      "fewer-hand-traps",
      "limit-traps",
      "low-extra-reliance",
      "budget-aware",
    ]),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const payload = PayloadSchema.parse(await request.json());
    const activeThemeLabel =
      payload.theme.resolvedArchetype ?? payload.theme.resolvedBossCards[0] ?? payload.theme.query.trim();

    if (!activeThemeLabel) {
      return NextResponse.json(
        { error: "Pick an archetype or anchor a boss card before generating a Yu-Gi-Oh shell." },
        { status: 400 },
      );
    }

    const generatedDeck = await generateYugiohDeckShell(payload);
    return NextResponse.json(generatedDeck);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid Yu-Gi-Oh deck generation payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate Yu-Gi-Oh shell." },
      { status: 500 },
    );
  }
}
