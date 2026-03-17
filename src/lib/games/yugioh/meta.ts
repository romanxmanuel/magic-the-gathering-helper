import { z } from "zod";

import type { SourceAudit } from "@/lib/games/shared/types";
import type {
  YugiohDeckVersionOption,
  YugiohMetaArchetypeStat,
  YugiohMetaDeckSample,
  YugiohMetaSnapshot,
} from "@/lib/games/yugioh/types";

const YGOPRODECK_DECK_API_ROOT = "https://ygoprodeck.com/api/decks/getDecks.php";
const YGOPRODECK_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CardLab/0.1 (romanxmanuel@gmail.com)",
};

const MetaDeckSchema = z.object({
  deck_name: z.string(),
  main_deck: z.string(),
  extra_deck: z.string(),
  side_deck: z.string(),
  pretty_url: z.string(),
  submit_date: z.string().nullable().optional(),
  tournamentName: z.string().nullable().optional(),
  tournamentPlacement: z.string().nullable().optional(),
});

export type YugiohMetaDeckRecord = {
  deckName: string;
  deckUrl: string;
  submitDateLabel: string | null;
  tournamentName: string | null;
  placement: string | null;
  mainDeckIds: number[];
  extraDeckIds: number[];
  sideDeckIds: number[];
};

function buildSourceAudit(sourceUrl: string, notes: string): SourceAudit[] {
  return [
    {
      sourceName: "YGOPRODeck",
      sourceType: "community",
      sourceUrl,
      fetchedAt: new Date().toISOString(),
      confidence: "medium",
      notes,
    },
  ];
}

function parseDeckIds(serializedIds: string) {
  try {
    const parsed = z.array(z.union([z.string(), z.number()])).parse(JSON.parse(serializedIds));
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

async function fetchYgoprodeckMetaDecks(path: string) {
  const response = await fetch(`${YGOPRODECK_DECK_API_ROOT}${path}`, {
    headers: YGOPRODECK_HEADERS,
    next: {
      revalidate: 60 * 30,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`YGOPRODeck meta request failed: ${response.status}${errorBody ? ` - ${errorBody}` : ""}`);
  }

  return z.array(MetaDeckSchema).parse(await response.json());
}

export async function fetchTournamentMetaDecks({
  query,
  limit = 20,
  offset = 0,
}: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  decks: YugiohMetaDeckRecord[];
  sourceAudit: SourceAudit[];
}> {
  const params = new URLSearchParams({
    format: "tournament meta decks",
    limit: String(limit),
    offset: String(offset),
  });

  if (query) {
    params.set("name", query);
  }

  const sourceUrl = `${YGOPRODECK_DECK_API_ROOT}?${params.toString()}`;
  const payload = await fetchYgoprodeckMetaDecks(`?${params.toString()}`);

  return {
    decks: payload.map((deck) => ({
      deckName: deck.deck_name,
      deckUrl: `https://ygoprodeck.com/deck/${deck.pretty_url}`,
      submitDateLabel: deck.submit_date ?? null,
      tournamentName: deck.tournamentName ?? null,
      placement: deck.tournamentPlacement ?? null,
      mainDeckIds: parseDeckIds(deck.main_deck),
      extraDeckIds: parseDeckIds(deck.extra_deck),
      sideDeckIds: parseDeckIds(deck.side_deck),
    })),
    sourceAudit: buildSourceAudit(
      sourceUrl,
      query
        ? `Pulled recent YGOPRODeck tournament-meta decklists matching "${query}".`
        : "Pulled the recent YGOPRODeck Tournament Meta Decks field snapshot.",
    ),
  };
}

function countDeckNames(decks: YugiohMetaDeckRecord[]) {
  const counts = new Map<string, number>();

  for (const deck of decks) {
    counts.set(deck.deckName, (counts.get(deck.deckName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

export function slugifyDeckVersionLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeDeckVersionLabel(deckName: string, themeQuery: string) {
  const cleaned = deckName
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(202\d|20\d\d)\b/g, " ")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?\b/gi, " ")
    .replace(/\b(v\d+|version \d+)\b/gi, " ")
    .replace(/\b(tcg|ocg|master duel|open lab|format)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return themeQuery || "Core build";
  }

  return cleaned;
}

function buildDeckVersions(matchedDecks: YugiohMetaDeckRecord[], themeQuery: string) {
  const grouped = new Map<string, { label: string; count: number; sampleDecks: YugiohMetaDeckSample[] }>();

  for (const deck of matchedDecks) {
    const label = normalizeDeckVersionLabel(deck.deckName, themeQuery);
    const id = slugifyDeckVersionLabel(label) || "core-build";
    const existing = grouped.get(id);
    const sample: YugiohMetaDeckSample = {
      deckName: deck.deckName,
      deckUrl: deck.deckUrl,
      tournamentName: deck.tournamentName,
      placement: deck.placement,
      submitDateLabel: deck.submitDateLabel,
    };

    if (existing) {
      existing.count += 1;
      if (existing.sampleDecks.length < 3) {
        existing.sampleDecks.push(sample);
      }
      continue;
    }

    grouped.set(id, {
      label,
      count: 1,
      sampleDecks: [sample],
    });
  }

  return [...grouped.entries()]
    .map(([id, value]): YugiohDeckVersionOption => ({
      id,
      label: value.label,
      count: value.count,
      sampleDecks: value.sampleDecks,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6);
}

export function buildYugiohMetaSnapshot({
  themeQuery,
  matchedDecks,
  fieldDecks,
  selectedDeckVersion,
}: {
  themeQuery: string;
  matchedDecks: YugiohMetaDeckRecord[];
  fieldDecks: YugiohMetaDeckRecord[];
  selectedDeckVersion?: string | null;
}): YugiohMetaSnapshot {
  const topFieldDecks: YugiohMetaArchetypeStat[] = countDeckNames(fieldDecks).slice(0, 6);
  const matchedDeckSamples: YugiohMetaDeckSample[] = matchedDecks.slice(0, 5).map((deck) => ({
    deckName: deck.deckName,
    deckUrl: deck.deckUrl,
    tournamentName: deck.tournamentName,
    placement: deck.placement,
    submitDateLabel: deck.submitDateLabel,
  }));
  const deckVersions = buildDeckVersions(matchedDecks, themeQuery);

  return {
    themeQuery,
    matchedDeckCount: matchedDecks.length,
    fieldSampleSize: fieldDecks.length,
    topFieldDecks,
    matchedDecks: matchedDeckSamples,
    deckVersions,
    selectedDeckVersion: selectedDeckVersion ?? null,
  };
}
