import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateYugiohDeckShell } from "@/lib/games/yugioh/generator";

function normalizeArrayInput(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.values(value);
  }

  return [];
}

const ThemeSchema = z.object({
  query: z.string(),
  resolvedArchetype: z.string().nullable(),
  resolvedBossCards: z.preprocess(normalizeArrayInput, z.array(z.string())),
  resolvedSupportCards: z.preprocess(normalizeArrayInput, z.array(z.string())),
  inactiveBossCards: z.preprocess(normalizeArrayInput, z.array(z.string())).optional().default([]),
  inactiveSupportCards: z.preprocess(normalizeArrayInput, z.array(z.string())).optional().default([]),
});

const PayloadSchema = z.object({
  theme: ThemeSchema,
  preferredDeckVersion: z.string().nullable().optional(),
  seedEntries: z.preprocess(
    normalizeArrayInput,
    z
      .array(
        z.object({
          cardId: z.number().int().positive(),
          quantity: z.number().int().min(1).max(3),
          section: z.enum(["main", "extra", "side"]),
        }),
      )
      .optional()
      .default([]),
  ),
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
  constraints: z.preprocess(
    normalizeArrayInput,
    z.array(
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
  ),
});

export async function POST(request: NextRequest) {
  try {
    const payload = PayloadSchema.parse(await request.json());
    const activeThemeLabel =
      payload.theme.resolvedArchetype ?? payload.theme.resolvedBossCards[0] ?? payload.theme.query.trim();
    const hasSeedCards = payload.seedEntries.length > 0;

    if (!activeThemeLabel && !hasSeedCards) {
      return NextResponse.json(
        { error: "Pick a theme, anchor a card, or add a few cards to the deck before generating." },
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
