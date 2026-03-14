import { z } from "zod";

import type {
  BracketTag,
  CommanderOption,
  DeckEntry,
  SpellbookCardInsight,
  SpellbookComboPreview,
  SpellbookDeckEstimate,
} from "@/lib/mtg/types";

const SPELLBOOK_API_ROOT = "https://backend.commanderspellbook.com";

const BracketTagSchema = z.enum(["R", "S", "P", "O", "C", "E", "B"]);

const SpellbookCardSchema = z.object({
  name: z.string(),
  variantCount: z.number().default(0),
  keywords: z.array(z.string()).default([]),
  gameChanger: z.boolean().default(false),
  tutor: z.boolean().default(false),
  massLandDenial: z.boolean().default(false),
  extraTurn: z.boolean().default(false),
  features: z
    .array(
      z.object({
        feature: z.object({
          name: z.string(),
        }),
      }),
    )
    .default([]),
});

const SpellbookCardResponseSchema = z.object({
  results: z.array(SpellbookCardSchema).default([]),
});

const SpellbookCardNameSchema = z.object({
  name: z.string(),
});

const SpellbookVariantUseSchema = z.object({
  card: SpellbookCardNameSchema,
});

const SpellbookVariantSchema = z.object({
  id: z.string(),
  bracketTag: BracketTagSchema,
  uses: z.array(SpellbookVariantUseSchema).default([]),
  notablePrerequisites: z.string().default(""),
  description: z.string().default(""),
});

const SpellbookClassifiedVariantSchema = z.object({
  combo: SpellbookVariantSchema,
  relevant: z.boolean().default(false),
  borderlineRelevant: z.boolean().default(false),
  definitelyTwoCard: z.boolean().default(false),
  speed: z.number().optional(),
});

const SpellbookEstimateSchema = z.object({
  bracketTag: BracketTagSchema,
  bannedCards: z.array(SpellbookCardNameSchema).default([]),
  gameChangerCards: z.array(SpellbookCardNameSchema).default([]),
  massLandDenialCards: z.array(SpellbookCardNameSchema).default([]),
  extraTurnCards: z.array(SpellbookCardNameSchema).default([]),
  massLandDenialCombos: z.array(SpellbookVariantSchema).default([]),
  extraTurnsCombos: z.array(SpellbookVariantSchema).default([]),
  lockCombos: z.array(SpellbookVariantSchema).default([]),
  controlAllOpponentsCombos: z.array(SpellbookVariantSchema).default([]),
  controlSomeOpponentsCombos: z.array(SpellbookVariantSchema).default([]),
  skipTurnsCombos: z.array(SpellbookVariantSchema).default([]),
  twoCardCombos: z.array(SpellbookClassifiedVariantSchema).default([]),
});

const BRACKET_DETAILS: Record<BracketTag, { label: string; summary: string }> = {
  R: {
    label: "Ruthless",
    summary: "Fast, compact wins and highly efficient pressure.",
  },
  S: {
    label: "Spicy",
    summary: "Sharp, swingy lines with more combo pressure than a core pod expects.",
  },
  P: {
    label: "Powerful",
    summary: "Tuned and proactive, but not all-in on the most ruthless lines.",
  },
  O: {
    label: "Oddball",
    summary: "Unusual cards or interactions that can spike table expectations.",
  },
  C: {
    label: "Core",
    summary: "Solid Commander fundamentals without the sharpest spikes.",
  },
  E: {
    label: "Exhibition",
    summary: "Showcase-style casual Commander with very soft edges.",
  },
  B: {
    label: "Banned",
    summary: "Contains banned cards or patterns that push the shell out of bounds.",
  },
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

async function fetchSpellbookJson<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate: number } },
) {
  const response = await fetch(`${SPELLBOOK_API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Commander Spellbook request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function dedupeStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function variantUses(uses: Array<{ card: { name: string } }>) {
  return dedupeStrings(uses.map((entry) => entry.card.name));
}

function toComboPreview(
  combo: z.infer<typeof SpellbookVariantSchema>,
  speed?: number,
): SpellbookComboPreview {
  return {
    id: combo.id,
    uses: variantUses(combo.uses),
    bracketTag: combo.bracketTag,
    description: combo.description,
    prerequisites: combo.notablePrerequisites,
    speed,
  };
}

export function bracketLabelFromTag(tag: BracketTag) {
  return BRACKET_DETAILS[tag].label;
}

export function bracketSummaryFromTag(tag: BracketTag) {
  return BRACKET_DETAILS[tag].summary;
}

export async function fetchSpellbookCommanderInsight(
  name: string,
): Promise<SpellbookCardInsight | null> {
  const payload = SpellbookCardResponseSchema.parse(
    await fetchSpellbookJson(`/cards/?q=${encodeURIComponent(name)}`, {
      next: {
        revalidate: 60 * 60 * 12,
      },
    }),
  );
  const match =
    payload.results.find((card) => normalizeName(card.name) === normalizeName(name)) ??
    payload.results[0];

  if (!match) {
    return null;
  }

  return {
    variantCount: match.variantCount,
    gameChanger: match.gameChanger,
    tutor: match.tutor,
    massLandDenial: match.massLandDenial,
    extraTurn: match.extraTurn,
    keywords: dedupeStrings(match.keywords).slice(0, 6),
    features: dedupeStrings(match.features.map((feature) => feature.feature.name)).slice(0, 6),
  };
}

export async function estimateSpellbookDeck(
  commander: CommanderOption,
  entries: DeckEntry[],
): Promise<SpellbookDeckEstimate | null> {
  if (!commander) {
    return null;
  }

  const payload = SpellbookEstimateSchema.parse(
    await fetchSpellbookJson("/estimate-bracket/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commanders: [{ card: commander.name, quantity: 1 }],
        main: entries.map((entry) => ({
          card: entry.name,
          quantity: entry.quantity,
        })),
      }),
      cache: "no-store",
    }),
  );

  const comboHighlights = dedupeStrings(
    [
      ...payload.twoCardCombos
        .filter((combo) => combo.relevant || combo.definitelyTwoCard)
        .map((combo) => JSON.stringify(toComboPreview(combo.combo, combo.speed))),
      ...payload.lockCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
      ...payload.extraTurnsCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
      ...payload.controlAllOpponentsCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
      ...payload.controlSomeOpponentsCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
      ...payload.skipTurnsCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
      ...payload.massLandDenialCombos.map((combo) => JSON.stringify(toComboPreview(combo))),
    ],
  )
    .map((combo) => JSON.parse(combo) as SpellbookComboPreview)
    .slice(0, 5);

  return {
    bracketTag: payload.bracketTag,
    bracketLabel: bracketLabelFromTag(payload.bracketTag),
    gameChangerCards: dedupeStrings(payload.gameChangerCards.map((card) => card.name)),
    massLandDenialCards: dedupeStrings(payload.massLandDenialCards.map((card) => card.name)),
    extraTurnCards: dedupeStrings(payload.extraTurnCards.map((card) => card.name)),
    comboCount:
      payload.twoCardCombos.length +
      payload.lockCombos.length +
      payload.extraTurnsCombos.length +
      payload.controlAllOpponentsCombos.length +
      payload.controlSomeOpponentsCombos.length +
      payload.skipTurnsCombos.length +
      payload.massLandDenialCombos.length,
    twoCardComboCount: payload.twoCardCombos.length,
    lockComboCount: payload.lockCombos.length,
    extraTurnComboCount: payload.extraTurnsCombos.length,
    comboHighlights,
  };
}
