import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildCommanderDeck } from "@/lib/mtg/deck-builder";
import { fetchCommanderMeta } from "@/lib/mtg/edhrec";
import { lookupCardsByName } from "@/lib/mtg/scryfall";
import { bracketSummaryFromTag, estimateSpellbookDeck } from "@/lib/mtg/spellbook";
import { fetchCommanderBannedList } from "@/lib/mtg/wizards";

const CommanderSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  typeLine: z.string(),
  oracleText: z.string().nullable(),
  colorIdentity: z.array(z.enum(["W", "U", "B", "R", "G"])),
  colors: z.array(z.enum(["W", "U", "B", "R", "G"])),
  imageUris: z.object({
    normal: z.string(),
    png: z.string(),
    artCrop: z.string(),
  }),
  source: z.enum(["scryfall", "edhrec-color"]),
});

const PayloadSchema = z.object({
  commander: CommanderSchema,
  focusTag: z
    .object({
      label: z.string(),
      slug: z.string(),
    })
    .nullable(),
  powerPreset: z.enum(["battlecruiser", "focused", "high", "cooked"]),
});

const POWER_FLOOR_BY_PRESET = {
  battlecruiser: 1,
  focused: 2,
  high: 4,
  cooked: 5,
} as const;

const BRACKET_PRESSURE = {
  E: 1,
  C: 2,
  O: 3,
  P: 4,
  S: 5,
  R: 6,
  B: 7,
} as const;

export async function POST(request: NextRequest) {
  try {
    const payload = PayloadSchema.parse(await request.json());
    const [meta, bannedCards] = await Promise.all([
      fetchCommanderMeta(payload.commander.slug, payload.focusTag?.slug),
      fetchCommanderBannedList(),
    ]);
    const cardPool = await lookupCardsByName(meta.cards.map((card) => card.name));
    const deck = buildCommanderDeck(
      payload.commander,
      meta,
      cardPool,
      bannedCards,
      payload.powerPreset,
      payload.focusTag,
    );
    const spellbookEstimate = await estimateSpellbookDeck(
      payload.commander,
      deck.entries,
    ).catch(() => null);

    if (spellbookEstimate) {
      deck.buildNotes.push(
        `Commander Spellbook reads this shell as ${spellbookEstimate.bracketLabel}. ${bracketSummaryFromTag(
          spellbookEstimate.bracketTag,
        )}`,
      );

      if (spellbookEstimate.twoCardComboCount > 0) {
        deck.buildNotes.push(
          `${spellbookEstimate.twoCardComboCount} compact combo line(s) showed up in the current shell.`,
        );
      }

      if (spellbookEstimate.gameChangerCards.length > 0) {
        deck.buildNotes.push(
          `High-pressure cards detected: ${spellbookEstimate.gameChangerCards
            .slice(0, 4)
            .join(", ")}${spellbookEstimate.gameChangerCards.length > 4 ? ", ..." : ""}.`,
        );
      }

      if (
        BRACKET_PRESSURE[spellbookEstimate.bracketTag] >
        POWER_FLOOR_BY_PRESET[payload.powerPreset] + 1
      ) {
        deck.buildNotes.push(
          "This shell reads sharper than the selected power preset. Trim compact combos, Game Changers, or extra-turn packages if you want a softer pod read.",
        );
      }
    }

    return NextResponse.json({
      ...deck,
      spellbookEstimate,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate deck." },
      { status: 500 },
    );
  }
}
