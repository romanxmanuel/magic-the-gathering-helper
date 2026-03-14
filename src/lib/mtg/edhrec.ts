import { getEdhrecColorSlug } from "@/lib/mtg/colors";
import type { CommanderMeta, CommanderOption, EdhrecCardCandidate, ManaColor, TagOption } from "@/lib/mtg/types";

type EdhrecResponse = {
  header?: string;
  description?: string;
  container?: {
    json_dict?: {
      cardlists?: Array<{
        header?: string;
        cardviews?: Array<{
          name: string;
          synergy?: number;
          inclusion?: number;
          num_decks?: number;
          sanitized?: string;
          url?: string;
        }>;
      }>;
    };
  };
  panels?: {
    piechart?: {
      content?: Array<{ label: string; value: number; color: string }>;
    };
    links?: Array<{
      header?: string;
      items?: Array<{ href?: string; value?: string; current?: boolean }>;
    }>;
    combocounts?: Array<{ value?: string }>;
  };
};

const EDHREC_JSON_ROOT = "https://json.edhrec.com/pages/commanders";

async function fetchEdhrec<T>(path: string) {
  const response = await fetch(`${EDHREC_JSON_ROOT}/${path}`, {
    next: {
      revalidate: 60 * 60 * 12,
    },
  });

  if (!response.ok) {
    throw new Error(`EDHREC request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseTagOptions(payload: EdhrecResponse): TagOption[] {
  const tagSection = payload.panels?.links?.find((section) => section.header === "Tags");
  const items = tagSection?.items ?? [];

  return items
    .map((item) => {
      if (!item.href || !item.value) {
        return null;
      }

      const parts = item.href.split("/").filter(Boolean);
      const slug = parts[1];

      if (!slug) {
        return null;
      }

      return {
        label: item.value,
        slug,
      } satisfies TagOption;
    })
    .filter((item): item is TagOption => Boolean(item));
}

function parseCardCandidates(payload: EdhrecResponse) {
  const cardlists = payload.container?.json_dict?.cardlists ?? [];
  const candidates = new Map<string, EdhrecCardCandidate>();

  for (const list of cardlists) {
    for (const card of list.cardviews ?? []) {
      const existing = candidates.get(card.name);
      const nextCandidate = {
        name: card.name,
        header: list.header ?? "Recommendations",
        synergy: card.synergy ?? 0,
        inclusion: card.inclusion ?? card.num_decks ?? 0,
      } satisfies EdhrecCardCandidate;

      if (!existing || nextCandidate.synergy > existing.synergy || nextCandidate.inclusion > existing.inclusion) {
        candidates.set(card.name, nextCandidate);
      }
    }
  }

  return [...candidates.values()];
}

export async function fetchCommanderMeta(slug: string, focusTag?: string | null): Promise<CommanderMeta> {
  const path = focusTag ? `${slug}/${focusTag}.json` : `${slug}.json`;
  const payload = await fetchEdhrec<EdhrecResponse>(path);

  return {
    description: payload.description ?? "",
    tags: parseTagOptions(payload),
    cards: parseCardCandidates(payload),
    comboIdeas: (payload.panels?.combocounts ?? [])
      .map((combo) => combo.value ?? "")
      .filter((combo) => combo && combo !== "See More...")
      .slice(0, 6),
    averageTypeDistribution: payload.panels?.piechart?.content ?? [],
    spellbook: null,
  };
}

export async function fetchTopCommandersByColor(colors: ManaColor[]): Promise<CommanderOption[]> {
  const slug = getEdhrecColorSlug(colors);

  if (!slug) {
    return [];
  }

  const payload = await fetchEdhrec<EdhrecResponse>(`${slug}.json`);
  const cardviews = payload.container?.json_dict?.cardlists?.[0]?.cardviews ?? [];

  return cardviews.slice(0, 12).map((card) => ({
    id: card.sanitized ?? card.name,
    name: card.name,
    slug: card.sanitized ?? card.name,
    typeLine: "Commander",
    oracleText: null,
    colorIdentity: colors,
    colors,
    imageUris: {
      normal: "",
      png: "",
      artCrop: "",
    },
    source: "edhrec-color",
    inclusion: card.inclusion ?? card.num_decks,
  }));
}
