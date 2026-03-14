import { z } from "zod";

import { normalizeColorIdentity } from "@/lib/mtg/colors";
import type { CardSummary, CommanderOption } from "@/lib/mtg/types";

const SCRYFALL_API_ROOT = "https://api.scryfall.com";
const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "MagicTheGatheringHelper/0.1 (romanxmanuel@gmail.com)",
};

const ImageUrisSchema = z.object({
  normal: z.string().url().optional(),
  png: z.string().url().optional(),
  art_crop: z.string().url().optional(),
});

const CardFaceSchema = z.object({
  image_uris: ImageUrisSchema.optional(),
});

const ScryfallCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  mana_cost: z.string().nullable().optional(),
  type_line: z.string(),
  oracle_text: z.string().nullable().optional(),
  color_identity: z.array(z.enum(["W", "U", "B", "R", "G"])).optional(),
  colors: z.array(z.enum(["W", "U", "B", "R", "G"])).nullable().optional(),
  cmc: z.number().optional().default(0),
  image_uris: ImageUrisSchema.optional(),
  card_faces: z.array(CardFaceSchema).optional(),
  edhrec_rank: z.number().nullable().optional(),
  legalities: z.object({
    commander: z.string().optional(),
  }),
  layout: z.string().default("normal"),
});

const SearchResponseSchema = z.object({
  data: z.array(ScryfallCardSchema),
});

const CollectionResponseSchema = z.object({
  data: z.array(ScryfallCardSchema),
});

async function fetchScryfall<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate: number } },
) {
  const response = await fetch(`${SCRYFALL_API_ROOT}${path}`, {
    ...init,
    headers: {
      ...SCRYFALL_HEADERS,
      ...(init?.headers ?? {}),
    },
    next: init?.next ?? {
      revalidate: 60 * 60 * 24,
    },
  });

  if (!response.ok) {
    throw new Error(`Scryfall request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function extractImages(card: z.infer<typeof ScryfallCardSchema>) {
  const imageSource = card.image_uris ?? card.card_faces?.[0]?.image_uris;

  return {
    normal: imageSource?.normal ?? "",
    png: imageSource?.png ?? imageSource?.normal ?? "",
    artCrop: imageSource?.art_crop ?? imageSource?.normal ?? "",
  };
}

export function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCard(card: z.infer<typeof ScryfallCardSchema>): CardSummary {
  return {
    id: card.id,
    name: card.name,
    slug: toSlug(card.name),
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? null,
    colorIdentity: normalizeColorIdentity(card.color_identity),
    colors: normalizeColorIdentity(card.colors),
    cmc: card.cmc,
    imageUris: extractImages(card),
    edhrecRank: card.edhrec_rank ?? null,
    legalCommander: card.legalities.commander === "legal",
    isBasicLand: card.type_line.includes("Basic Land"),
    layout: card.layout,
  };
}

function normalizeCommander(card: z.infer<typeof ScryfallCardSchema>): CommanderOption {
  const normalized = normalizeCard(card);

  return {
    id: normalized.id,
    name: normalized.name,
    slug: normalized.slug,
    typeLine: normalized.typeLine,
    oracleText: normalized.oracleText,
    colorIdentity: normalized.colorIdentity,
    colors: normalized.colors,
    imageUris: normalized.imageUris,
    source: "scryfall",
  };
}

export async function searchCommanderCards(query: string) {
  const searchQuery = `${query} game:paper legal:commander ((type:legendary type:creature) or oracle:"can be your commander")`;
  const payload = SearchResponseSchema.parse(
    await fetchScryfall(`/cards/search?order=edhrec&unique=cards&q=${encodeURIComponent(searchQuery)}`),
  );

  return payload.data.slice(0, 12).map(normalizeCommander);
}

export async function searchCommanderLegalCards(query: string, colorIdentity: string[]) {
  const colorClause = colorIdentity.length > 0 ? ` id<=${colorIdentity.join("").toLowerCase()}` : "";
  const searchQuery = `${query} game:paper legal:commander${colorClause}`;
  const payload = SearchResponseSchema.parse(
    await fetchScryfall(`/cards/search?order=edhrec&unique=cards&q=${encodeURIComponent(searchQuery)}`),
  );

  return payload.data.slice(0, 18).map(normalizeCard);
}

export async function lookupCardsByName(names: string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const chunks: string[][] = [];

  for (let index = 0; index < uniqueNames.length; index += 75) {
    chunks.push(uniqueNames.slice(index, index + 75));
  }

  const cards = await Promise.all(
    chunks.map(async (chunk) => {
      const payload = CollectionResponseSchema.parse(
        await fetchScryfall("/cards/collection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifiers: chunk.map((name) => ({ name })),
          }),
        }),
      );

      return payload.data.map(normalizeCard);
    }),
  );

  return cards.flat();
}
