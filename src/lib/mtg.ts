import { BASIC_LANDS_BY_COLOR } from "@/lib/constants";
import { isColorSubset, normalizeColors, toEdhrecSlug } from "@/lib/slug";
import type { CommanderOption, DeckCard, ManaColor } from "@/lib/types";
import { chunk, uniqueBy } from "@/lib/utils";

const SCRYFALL_API = "https://api.scryfall.com";
const EDHREC_JSON_BASE = "https://json.edhrec.com/pages";
const SPELLBOOK_API = "https://backend.commanderspellbook.com";
const TOP_COMMANDER_ENDPOINTS = [
  `${EDHREC_JSON_BASE}/commanders/year-past2years-1.json`,
  `${EDHREC_JSON_BASE}/commanders/year-past2years-2.json`,
  `${EDHREC_JSON_BASE}/commanders/year-past2years-3.json`,
];

interface ScryfallCardFace {
  name: string;
  oracle_text?: string;
  type_line?: string;
  image_uris?: {
    normal?: string;
    png?: string;
  };
}

interface ScryfallCard {
  id: string;
  name: string;
  cmc: number;
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  legalities: {
    commander?: string;
  };
  game_changer?: boolean;
  digital?: boolean;
  image_uris?: {
    normal?: string;
    png?: string;
  };
  card_faces?: ScryfallCardFace[];
  prices?: {
    usd?: string | null;
  };
  scryfall_uri?: string;
  related_uris?: {
    edhrec?: string;
  };
}

interface ScryfallAutocomplete {
  data: string[];
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
}

interface EdhrecCardView {
  id: string;
  name: string;
  sanitized?: string;
  image_uris?: Array<{
    normal?: string;
    png?: string;
  }>;
  color_identity?: string[];
  spellbook_uri?: string;
  salt?: number;
  num_decks?: number;
  rank?: number;
}

interface EdhrecCommanderPage {
  panels: {
    links: Array<{
      items: Array<{
        href: string;
        value: string;
      }>;
    }>;
  };
  container: {
    json_dict: {
      cardlists: Array<{
        header: string;
        tag: string;
        cardviews: Array<
          EdhrecCardView & {
            url?: string | null;
            type?: string;
            legal_commander?: boolean;
            combos?: boolean;
            synergy?: number;
            inclusion?: number;
            trend_zscore?: number;
            cmc?: number;
            prices?: {
              tcgplayer?: { price?: number | null };
              cardkingdom?: { price?: number | null };
            };
            scryfall_uri?: string;
          }
        >;
      }>;
      card: EdhrecCardView & {
        combos?: boolean;
      };
    };
  };
}

interface EdhrecTopPage {
  cardviews: EdhrecCardView[];
}

function baseHeaders() {
  return {
    Accept: "application/json;q=0.9,*/*;q=0.8",
  };
}

function scryfallHeaders() {
  return {
    ...baseHeaders(),
    "User-Agent": "MagicTheGatheringHelper/0.1",
  };
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { next?: { revalidate: number } },
) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }

  return (await response.json()) as T;
}

function getCardImage(card: ScryfallCard) {
  if (card.image_uris?.png || card.image_uris?.normal) {
    return {
      image: card.image_uris.png ?? card.image_uris.normal ?? "",
      normalImage: card.image_uris.normal ?? card.image_uris.png ?? "",
    };
  }

  const face = card.card_faces?.find(
    (entry) => entry.image_uris?.png || entry.image_uris?.normal,
  );

  return {
    image: face?.image_uris?.png ?? face?.image_uris?.normal ?? "",
    normalImage: face?.image_uris?.normal ?? face?.image_uris?.png ?? "",
  };
}

function getTypeLine(card: ScryfallCard) {
  return (
    card.type_line ??
    card.card_faces?.map((face) => face.type_line ?? "").filter(Boolean).join(" // ") ??
    "Card"
  );
}

function getOracleText(card: ScryfallCard) {
  return (
    card.oracle_text ??
    card.card_faces
      ?.map((face) => `${face.name}: ${face.oracle_text ?? ""}`.trim())
      .filter(Boolean)
      .join("\n\n") ??
    ""
  );
}

function looksLikeCommander(card: ScryfallCard) {
  const oracleText = getOracleText(card).toLowerCase();

  return (
    card.legalities.commander === "legal" &&
    !card.digital &&
    (getTypeLine(card).includes("Legendary") ||
      oracleText.includes("can be your commander") ||
      oracleText.includes("partner with") ||
      oracleText.includes("choose a background"))
  );
}

function mapTopCommander(entry: EdhrecCardView): CommanderOption {
  return {
    name: entry.name,
    slug: entry.sanitized ?? toEdhrecSlug(entry.name),
    image: entry.image_uris?.[0]?.png ?? entry.image_uris?.[0]?.normal ?? "",
    colors: normalizeColors(entry.color_identity ?? []),
    deckCount: entry.num_decks,
    salt: entry.salt,
    rank: entry.rank,
    source: "edhrec",
  };
}

let topCommanderPromise: Promise<CommanderOption[]> | null = null;

export async function getTopCommanders() {
  topCommanderPromise ??= Promise.all(
    TOP_COMMANDER_ENDPOINTS.map((endpoint) =>
      fetchJson<EdhrecTopPage>(endpoint, {
        headers: baseHeaders(),
        next: { revalidate: 60 * 60 * 12 },
      }),
    ),
  ).then((pages) =>
    uniqueBy(
      pages.flatMap((page) => page.cardviews.map(mapTopCommander)),
      (entry) => entry.name,
    ),
  );

  return topCommanderPromise;
}

export async function fetchScryfallCardByName(name: string) {
  return fetchJson<ScryfallCard>(
    `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(name)}`,
    {
      headers: scryfallHeaders(),
      next: { revalidate: 60 * 60 * 12 },
    },
  );
}

export async function fetchScryfallCollectionByNames(names: string[]) {
  const batches = chunk(uniqueBy(names, (name) => name), 75);
  const cards: ScryfallCard[] = [];

  for (const batch of batches) {
    const response = await fetch(`${SCRYFALL_API}/cards/collection`, {
      method: "POST",
      headers: {
        ...scryfallHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifiers: batch.map((name) => ({ name })),
      }),
      next: {
        revalidate: 60 * 60 * 12,
      },
    });

    if (!response.ok) {
      throw new Error(`Scryfall collection lookup failed: ${response.status}`);
    }

    const payload = (await response.json()) as ScryfallCollectionResponse;
    cards.push(...payload.data);
  }

  return cards;
}

async function resolveEdhrecCommanderSlug(name: string) {
  const fallbackSlug = toEdhrecSlug(name);

  try {
    const response = await fetch(
      `https://edhrec.com/route/?cc=${encodeURIComponent(name)}`,
      {
        method: "HEAD",
        redirect: "manual",
        headers: baseHeaders(),
        next: { revalidate: 60 * 60 * 24 },
      },
    );

    const location = response.headers.get("location");
    const match = location?.match(/\/commanders\/([^/?#]+)/);

    if (match?.[1]) {
      return match[1];
    }
  } catch {
    return fallbackSlug;
  }

  return fallbackSlug;
}

export async function fetchEdhrecCommanderPage(name: string) {
  const slug = await resolveEdhrecCommanderSlug(name);

  try {
    const payload = await fetchJson<EdhrecCommanderPage>(
      `${EDHREC_JSON_BASE}/commanders/${slug}.json`,
      {
        headers: baseHeaders(),
        next: { revalidate: 60 * 30 },
      },
    );

    return { slug, payload };
  } catch {
    const fallbackSlug = toEdhrecSlug(name);
    const payload = await fetchJson<EdhrecCommanderPage>(
      `${EDHREC_JSON_BASE}/commanders/${fallbackSlug}.json`,
      {
        headers: baseHeaders(),
        next: { revalidate: 60 * 30 },
      },
    );

    return { slug: fallbackSlug, payload };
  }
}

export async function searchCommanderOptions(query: string, selectedColors: string[]) {
  const colors = normalizeColors(selectedColors);
  const topCommanders = await getTopCommanders();

  if (!query.trim()) {
    return topCommanders
      .filter((entry) =>
        colors.length
          ? isColorSubset(entry.colors, colors) && entry.colors.length === colors.length
          : true,
      )
      .slice(0, 12);
  }

  const autocomplete = await fetchJson<ScryfallAutocomplete>(
    `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`,
    {
      headers: scryfallHeaders(),
      next: { revalidate: 60 * 60 * 12 },
    },
  );

  const candidateCards = await fetchScryfallCollectionByNames(
    autocomplete.data.slice(0, 12),
  );
  const topLookup = new Map(topCommanders.map((entry) => [entry.name, entry]));

  return uniqueBy(
    candidateCards
      .filter(looksLikeCommander)
      .map((card) => {
        const images = getCardImage(card);
        const topMatch = topLookup.get(card.name);

        return {
          name: card.name,
          slug: topMatch?.slug ?? toEdhrecSlug(card.name),
          image: images.normalImage,
          colors: normalizeColors(card.color_identity),
          deckCount: topMatch?.deckCount,
          salt: topMatch?.salt,
          rank: topMatch?.rank,
          source: topMatch ? "edhrec" : "scryfall",
        } satisfies CommanderOption;
      })
      .filter((entry) =>
        colors.length
          ? isColorSubset(entry.colors, colors) && entry.colors.length === colors.length
          : true,
      )
      .sort((left, right) => {
        if (left.rank && right.rank) {
          return left.rank - right.rank;
        }

        if (left.rank) {
          return -1;
        }

        if (right.rank) {
          return 1;
        }

        return left.name.localeCompare(right.name);
      }),
    (entry) => entry.name,
  );
}

export async function searchLegalCards(query: string, selectedColors: string[]) {
  const commanderColors = normalizeColors(selectedColors);

  if (!query.trim()) {
    return [];
  }

  const autocomplete = await fetchJson<ScryfallAutocomplete>(
    `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`,
    {
      headers: scryfallHeaders(),
      next: { revalidate: 60 * 60 * 12 },
    },
  );

  const candidates = await fetchScryfallCollectionByNames(
    autocomplete.data.slice(0, 12),
  );

  return candidates
    .filter((card) => card.legalities.commander === "legal" && !card.digital)
    .filter((card) =>
      commanderColors.length
        ? isColorSubset(normalizeColors(card.color_identity), commanderColors)
        : true,
    )
    .map((card) => {
      const images = getCardImage(card);

      return {
        id: card.id,
        name: card.name,
        quantity: 1,
        section: "Custom Add",
        typeLine: getTypeLine(card),
        oracleText: getOracleText(card),
        manaValue: card.cmc,
        colorIdentity: normalizeColors(card.color_identity),
        image: images.image,
        normalImage: images.normalImage,
        scryfallUri: card.scryfall_uri,
        priceUsd: card.prices?.usd ? Number(card.prices.usd) : null,
        gameChanger: Boolean(card.game_changer),
        legalCommander: card.legalities.commander === "legal",
        combos: false,
        roles: [],
        source: "Scryfall add-card search",
      } satisfies DeckCard;
    });
}

export async function pickCommanderFromColors(colors: ManaColor[]) {
  const topCommanders = await getTopCommanders();

  return topCommanders.find(
    (entry) =>
      entry.colors.length === colors.length &&
      entry.colors.every((color) => colors.includes(color)),
  );
}

export async function fetchCommanderSpellbookCard(name: string) {
  const payload = await fetchJson<{
    results: Array<{
      gameChanger: boolean;
      tutor: boolean;
      massLandDenial: boolean;
      extraTurn: boolean;
    }>;
  }>(`${SPELLBOOK_API}/cards/?q=${encodeURIComponent(name)}`, {
    headers: baseHeaders(),
    next: { revalidate: 60 * 60 * 12 },
  });

  return payload.results[0] ?? null;
}

export function edhrecBasicsForColors(colors: ManaColor[]) {
  return colors.map((color) => BASIC_LANDS_BY_COLOR[color]).filter(Boolean);
}
