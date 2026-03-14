import { createStructuralReadout, inferCardRoles } from "@/lib/games/yugioh/builder-shell";
import {
  buildYugiohMetaSnapshot,
  fetchTournamentMetaDecks,
  type YugiohMetaDeckRecord,
} from "@/lib/games/yugioh/meta";
import type { SourceAudit } from "@/lib/games/shared/types";
import type {
  YugiohBuildIntent,
  YugiohCard,
  YugiohConstraint,
  YugiohDeckEntry,
  YugiohDeckSection,
  YugiohGeneratedDeckResponse,
  YugiohStrengthTarget,
  YugiohThemeSelection,
} from "@/lib/games/yugioh/types";
import { lookupYugiohCardsByIds, searchYugiohCards } from "@/lib/games/yugioh/ygoprodeck";

type CardStats = {
  cardId: number;
  deckAppearances: number;
  totalCopies: number;
  averageCopies: number;
};

type RankedCandidate = {
  card: YugiohCard;
  score: number;
  averageCopies: number;
  deckAppearances: number;
  section: YugiohDeckSection;
  rationale: string;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sumEntries(entries: YugiohDeckEntry[]) {
  return entries.reduce((count, entry) => count + entry.quantity, 0);
}

function isTrapCard(card: YugiohCard) {
  return /Trap/i.test(card.typeLine);
}

function matchesTheme(card: YugiohCard, theme: YugiohThemeSelection) {
  if (theme.resolvedArchetype && card.archetype?.toLowerCase() === theme.resolvedArchetype.toLowerCase()) {
    return true;
  }

  return theme.resolvedBossCards.some((bossCard) => bossCard.toLowerCase() === card.name.toLowerCase());
}

function buildStats(decks: YugiohMetaDeckRecord[], section: YugiohDeckSection) {
  const stats = new Map<number, { deckAppearances: number; totalCopies: number }>();

  for (const deck of decks) {
    const ids =
      section === "main"
        ? deck.mainDeckIds
        : section === "extra"
          ? deck.extraDeckIds
          : deck.sideDeckIds;
    const seenThisDeck = new Set<number>();

    for (const cardId of ids) {
      const current = stats.get(cardId) ?? { deckAppearances: 0, totalCopies: 0 };
      current.totalCopies += 1;

      if (!seenThisDeck.has(cardId)) {
        current.deckAppearances += 1;
        seenThisDeck.add(cardId);
      }

      stats.set(cardId, current);
    }
  }

  return [...stats.entries()]
    .map(([cardId, current]): CardStats => ({
      cardId,
      deckAppearances: current.deckAppearances,
      totalCopies: current.totalCopies,
      averageCopies: current.totalCopies / current.deckAppearances,
    }))
    .sort(
      (left, right) =>
        right.deckAppearances - left.deckAppearances ||
        right.averageCopies - left.averageCopies ||
        right.totalCopies - left.totalCopies,
    );
}

function collectTopIds(stats: CardStats[], count: number) {
  return stats.slice(0, count).map((entry) => entry.cardId);
}

async function resolveThemeMeta(theme: YugiohThemeSelection) {
  const queries = uniqueStrings([
    theme.resolvedArchetype,
    theme.resolvedBossCards[0],
    theme.query,
  ]);
  const deckMap = new Map<string, YugiohMetaDeckRecord>();
  const sourceAudit: SourceAudit[] = [];

  for (const query of queries) {
    const response = await fetchTournamentMetaDecks({
      query,
      limit: 12,
    });

    sourceAudit.push(...response.sourceAudit);

    for (const deck of response.decks) {
      deckMap.set(deck.deckUrl, deck);
    }

    if (deckMap.size >= 12) {
      break;
    }
  }

  return {
    decks: [...deckMap.values()],
    sourceAudit,
  };
}

function mainDeckTarget(buildIntent: YugiohBuildIntent, strengthTarget: YugiohStrengthTarget) {
  if (buildIntent === "grind") {
    return 42;
  }

  if (strengthTarget === "casual" || buildIntent === "hybrid") {
    return 42;
  }

  return 40;
}

function extraDeckTarget(constraints: YugiohConstraint[]) {
  return constraints.includes("low-extra-reliance") ? 10 : 15;
}

function sideDeckTarget(strengthTarget: YugiohStrengthTarget) {
  return strengthTarget === "casual" ? 10 : 15;
}

function themeCoreTarget(buildIntent: YugiohBuildIntent) {
  switch (buildIntent) {
    case "pure":
      return 28;
    case "consistency-first":
      return 27;
    case "grind":
      return 26;
    case "hybrid":
      return 22;
    case "blind-second":
      return 21;
    default:
      return 24;
  }
}

function desiredCopies({
  card,
  averageCopies,
  section,
  theme,
  buildIntent,
  strengthTarget,
  constraints,
}: {
  card: YugiohCard;
  averageCopies: number;
  section: YugiohDeckSection;
  theme: YugiohThemeSelection;
  buildIntent: YugiohBuildIntent;
  strengthTarget: YugiohStrengthTarget;
  constraints: YugiohConstraint[];
}) {
  const roles = inferCardRoles(card, theme, section);

  if (section === "extra") {
    return clamp(Math.round(averageCopies), 1, 2);
  }

  if (section === "side") {
    return clamp(Math.round(averageCopies), 1, 3);
  }

  let copies = clamp(Math.round(averageCopies), 1, 3);

  if (theme.resolvedBossCards.some((bossCard) => bossCard.toLowerCase() === card.name.toLowerCase())) {
    copies = Math.max(copies, 1);
  }

  if (roles.includes("starter") || roles.includes("searcher")) {
    copies = Math.max(copies, buildIntent === "consistency-first" || strengthTarget !== "casual" ? 3 : 2);
  }

  if (roles.includes("board-breaker") && buildIntent === "blind-second") {
    copies = Math.max(copies, 2);
  }

  if (roles.includes("hand-trap") && buildIntent === "anti-meta") {
    copies = Math.max(copies, 2);
  }

  if (roles.includes("brick-risk") && !roles.includes("starter")) {
    copies = Math.min(copies, 1);
  }

  if (constraints.includes("fewer-hand-traps") && roles.includes("hand-trap")) {
    copies = Math.min(copies, 2);
  }

  if (constraints.includes("limit-traps") && isTrapCard(card)) {
    copies = Math.min(copies, 2);
  }

  return clamp(copies, 1, 3);
}

function rankedCandidatesFromStats({
  stats,
  cardMap,
  section,
  theme,
  buildIntent,
  constraints,
  sampleSize,
  rationalePrefix,
  fieldLevel,
}: {
  stats: CardStats[];
  cardMap: Map<number, YugiohCard>;
  section: YugiohDeckSection;
  theme: YugiohThemeSelection;
  buildIntent: YugiohBuildIntent;
  constraints: YugiohConstraint[];
  sampleSize: number;
  rationalePrefix: string;
  fieldLevel: "theme" | "field";
}) {
  return stats
    .map((entry) => {
      const card = cardMap.get(entry.cardId);

      if (!card) {
        return null;
      }

      const roles = inferCardRoles(card, theme, section);
      let score = entry.deckAppearances * 12 + entry.averageCopies * 6;

      if (fieldLevel === "theme" && matchesTheme(card, theme)) {
        score += 14;
      }

      if (theme.resolvedBossCards.some((bossCard) => bossCard.toLowerCase() === card.name.toLowerCase())) {
        score += 20;
      }

      if (buildIntent === "anti-meta" && (roles.includes("hand-trap") || roles.includes("board-breaker"))) {
        score += 10;
      }

      if (buildIntent === "consistency-first" && (roles.includes("starter") || roles.includes("searcher"))) {
        score += 12;
      }

      if (buildIntent === "ceiling-first" && (roles.includes("extender") || roles.includes("payoff"))) {
        score += 10;
      }

      if (buildIntent === "blind-second" && roles.includes("board-breaker")) {
        score += 14;
      }

      if (buildIntent === "grind" && roles.includes("grind-tool")) {
        score += 10;
      }

      if (buildIntent === "pure" && fieldLevel === "theme" && matchesTheme(card, theme)) {
        score += 8;
      }

      if (constraints.includes("low-brick") && roles.includes("brick-risk")) {
        score -= 12;
      }

      if (constraints.includes("fewer-hand-traps") && roles.includes("hand-trap")) {
        score -= 8;
      }

      if (constraints.includes("limit-traps") && isTrapCard(card) && section === "main") {
        score -= 6;
      }

      if (constraints.includes("low-extra-reliance") && section === "extra") {
        score -= 4;
      }

      return {
        card,
        score,
        averageCopies: entry.averageCopies,
        deckAppearances: entry.deckAppearances,
        section,
        rationale: `${rationalePrefix} in ${entry.deckAppearances}/${sampleSize} sampled ${fieldLevel === "theme" ? "theme" : "field"} deck(s).`,
      } satisfies RankedCandidate;
    })
    .filter((candidate): candidate is RankedCandidate => Boolean(candidate))
    .sort((left, right) => right.score - left.score || left.card.name.localeCompare(right.card.name));
}

function upsertEntry(entries: YugiohDeckEntry[], candidate: RankedCandidate, copies: number, theme: YugiohThemeSelection) {
  const nextEntries = [...entries];
  const existingIndex = nextEntries.findIndex((entry) => entry.card.id === candidate.card.id);

  if (existingIndex >= 0) {
    const existingEntry = nextEntries[existingIndex];

    nextEntries[existingIndex] = {
      ...existingEntry,
      quantity: clamp(existingEntry.quantity + copies, 1, 3),
    };

    return nextEntries;
  }

  nextEntries.push({
    card: candidate.card,
    quantity: copies,
    section: candidate.section,
    roles: inferCardRoles(candidate.card, theme, candidate.section),
    rationale: candidate.rationale,
    locked: matchesTheme(candidate.card, theme),
  });

  return nextEntries.sort((left, right) => left.card.name.localeCompare(right.card.name));
}

function fillSectionFromCandidates({
  entries,
  candidates,
  targetCount,
  theme,
  buildIntent,
  strengthTarget,
  constraints,
}: {
  entries: YugiohDeckEntry[];
  candidates: RankedCandidate[];
  targetCount: number;
  theme: YugiohThemeSelection;
  buildIntent: YugiohBuildIntent;
  strengthTarget: YugiohStrengthTarget;
  constraints: YugiohConstraint[];
}) {
  let nextEntries = [...entries];

  for (const candidate of candidates) {
    if (sumEntries(nextEntries) >= targetCount) {
      break;
    }

    const existingEntry = nextEntries.find((entry) => entry.card.id === candidate.card.id);
    const remainingSlots = targetCount - sumEntries(nextEntries);
    const desired = desiredCopies({
      card: candidate.card,
      averageCopies: candidate.averageCopies,
      section: candidate.section,
      theme,
      buildIntent,
      strengthTarget,
      constraints,
    });
    const allowedAdditional = existingEntry ? 3 - existingEntry.quantity : 3;
    const copiesToAdd = Math.min(desired, allowedAdditional, remainingSlots);

    if (copiesToAdd <= 0) {
      continue;
    }

    nextEntries = upsertEntry(nextEntries, candidate, copiesToAdd, theme);
  }

  return nextEntries;
}

async function hydrateBossCards(theme: YugiohThemeSelection) {
  const exactMatches: YugiohCard[] = [];
  const sourceAudit: SourceAudit[] = [];

  for (const bossCard of theme.resolvedBossCards) {
    const response = await searchYugiohCards(bossCard);
    sourceAudit.push(...response.sourceAudit);
    const exactMatch =
      response.cards.find((card) => card.name.toLowerCase() === bossCard.toLowerCase()) ?? response.cards[0];

    if (exactMatch) {
      exactMatches.push(exactMatch);
    }
  }

  return {
    cards: exactMatches,
    sourceAudit,
  };
}

export async function generateYugiohDeckShell({
  theme,
  buildIntent,
  strengthTarget,
  constraints,
}: {
  theme: YugiohThemeSelection;
  buildIntent: YugiohBuildIntent;
  strengthTarget: YugiohStrengthTarget;
  constraints: YugiohConstraint[];
}): Promise<YugiohGeneratedDeckResponse> {
  const [fieldDecksResponse, matchedDecksResponse, bossCardResponse] = await Promise.all([
    fetchTournamentMetaDecks({
      limit: 40,
    }),
    resolveThemeMeta(theme),
    hydrateBossCards(theme),
  ]);

  const fieldDecks = fieldDecksResponse.decks;
  const matchedDecks = matchedDecksResponse.decks;
  const mainThemeStats = buildStats(matchedDecks, "main");
  const extraThemeStats = buildStats(matchedDecks, "extra");
  const sideThemeStats = buildStats(matchedDecks, "side");
  const mainFieldStats = buildStats(fieldDecks, "main");
  const extraFieldStats = buildStats(fieldDecks, "extra");
  const sideFieldStats = buildStats(fieldDecks, "side");
  const candidateIds = [
    ...collectTopIds(mainThemeStats, 80),
    ...collectTopIds(extraThemeStats, 25),
    ...collectTopIds(sideThemeStats, 25),
    ...collectTopIds(mainFieldStats, 40),
    ...collectTopIds(extraFieldStats, 25),
    ...collectTopIds(sideFieldStats, 30),
  ];
  const hydratedCardsResponse = await lookupYugiohCardsByIds(candidateIds);
  const cardMap = new Map<number, YugiohCard>(
    [...hydratedCardsResponse.cards, ...bossCardResponse.cards].map((card) => [card.id, card]),
  );

  let main: YugiohDeckEntry[] = [];
  let extra: YugiohDeckEntry[] = [];
  let side: YugiohDeckEntry[] = [];

  if (bossCardResponse.cards.length > 0) {
    const bossCandidates = bossCardResponse.cards.map((card) => ({
      card,
      score: 999,
      averageCopies: 1,
      deckAppearances: 1,
      section: /Fusion|Synchro|Xyz|Link/i.test(card.typeLine) ? "extra" : "main",
      rationale: `Explicitly anchored because you asked the shell to respect ${card.name}.`,
    })) satisfies RankedCandidate[];

    main = fillSectionFromCandidates({
      entries: main,
      candidates: bossCandidates.filter((candidate) => candidate.section === "main"),
      targetCount: 3,
      theme,
      buildIntent,
      strengthTarget,
      constraints,
    });

    extra = fillSectionFromCandidates({
      entries: extra,
      candidates: bossCandidates.filter((candidate) => candidate.section === "extra"),
      targetCount: 2,
      theme,
      buildIntent,
      strengthTarget,
      constraints,
    });
  }

  const mainThemeCandidates = rankedCandidatesFromStats({
    stats: mainThemeStats,
    cardMap,
    section: "main",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    rationalePrefix: "Recurring main-deck inclusion",
    fieldLevel: "theme",
  });
  const extraThemeCandidates = rankedCandidatesFromStats({
    stats: extraThemeStats,
    cardMap,
    section: "extra",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    rationalePrefix: "Recurring Extra Deck inclusion",
    fieldLevel: "theme",
  });
  const sideThemeCandidates = rankedCandidatesFromStats({
    stats: sideThemeStats,
    cardMap,
    section: "side",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    rationalePrefix: "Recurring side-deck inclusion",
    fieldLevel: "theme",
  });
  const mainFieldCandidates = rankedCandidatesFromStats({
    stats: mainFieldStats,
    cardMap,
    section: "main",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    rationalePrefix: "Common field staple",
    fieldLevel: "field",
  });
  const extraFieldCandidates = rankedCandidatesFromStats({
    stats: extraFieldStats,
    cardMap,
    section: "extra",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    rationalePrefix: "Common field Extra Deck card",
    fieldLevel: "field",
  });
  const sideFieldCandidates = rankedCandidatesFromStats({
    stats: sideFieldStats,
    cardMap,
    section: "side",
    theme,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    rationalePrefix: "Common field side-deck card",
    fieldLevel: "field",
  });

  const mainTarget = mainDeckTarget(buildIntent, strengthTarget);
  const extraTarget = extraDeckTarget(constraints);
  const sideTarget = sideDeckTarget(strengthTarget);

  main = fillSectionFromCandidates({
    entries: main,
    candidates: mainThemeCandidates,
    targetCount: themeCoreTarget(buildIntent),
    theme,
    buildIntent,
    strengthTarget,
    constraints,
  });

  main = fillSectionFromCandidates({
    entries: main,
    candidates: [...mainThemeCandidates, ...mainFieldCandidates],
    targetCount: mainTarget,
    theme,
    buildIntent,
    strengthTarget,
    constraints,
  });

  extra = fillSectionFromCandidates({
    entries: extra,
    candidates: [...extraThemeCandidates, ...extraFieldCandidates],
    targetCount: extraTarget,
    theme,
    buildIntent,
    strengthTarget,
    constraints,
  });

  side = fillSectionFromCandidates({
    entries: side,
    candidates: [...sideFieldCandidates, ...sideThemeCandidates],
    targetCount: sideTarget,
    theme,
    buildIntent,
    strengthTarget,
    constraints,
  });

  if (matchedDecks.length === 0) {
    const fallbackCardsResponse = await searchYugiohCards(theme.query, theme.resolvedArchetype ?? undefined);
    const fallbackCandidates = fallbackCardsResponse.cards.map((card) => ({
      card,
      score: matchesTheme(card, theme) ? 40 : 20,
      averageCopies: 2,
      deckAppearances: 1,
      section: /Fusion|Synchro|Xyz|Link/i.test(card.typeLine) ? "extra" : "main",
      rationale: `Fallback theme card surfaced from direct YGOPRODeck card search for ${theme.query}.`,
    })) satisfies RankedCandidate[];

    main = fillSectionFromCandidates({
      entries: main,
      candidates: fallbackCandidates.filter((candidate) => candidate.section === "main"),
      targetCount: Math.min(mainTarget, 24),
      theme,
      buildIntent,
      strengthTarget,
      constraints,
    });

    extra = fillSectionFromCandidates({
      entries: extra,
      candidates: fallbackCandidates.filter((candidate) => candidate.section === "extra"),
      targetCount: extraTarget,
      theme,
      buildIntent,
      strengthTarget,
      constraints,
    });
  }

  const metaSnapshot = buildYugiohMetaSnapshot({
    themeQuery: theme.resolvedArchetype ?? theme.resolvedBossCards[0] ?? theme.query,
    matchedDecks,
    fieldDecks,
  });
  const structuralReadout = createStructuralReadout({
    main,
    extra,
    side,
    theme,
    buildIntent,
    strengthTarget,
    constraints,
  });
  const buildNotes = [
    `Built from ${matchedDecks.length} matching tournament-meta deck(s) for ${metaSnapshot.themeQuery} and ${fieldDecks.length} recent field deck(s).`,
    matchedDecks.length > 0
      ? "Theme slots were pulled from repeated inclusions in matching lists, while flex space leans on common field staples."
      : "No direct tournament-meta deck matches were found, so this shell falls back to name/archetype card search plus field staples. Confidence is lower.",
    metaSnapshot.topFieldDecks.length > 0
      ? `The current field sample leans most heavily toward ${metaSnapshot.topFieldDecks
          .slice(0, 3)
          .map((entry) => `${entry.name} (${entry.count})`)
          .join(", ")}.`
      : "The current field sample did not return named archetype clusters, so the shell leans more heavily on theme cohesion than matchup targeting.",
    buildIntent === "anti-meta" || buildIntent === "blind-second"
      ? "Flex slots were biased toward interaction and board-breaking cards that repeatedly show up in the field sample."
      : "Flex slots were kept closer to engine density and stable openers before broader anti-field tech.",
  ];

  return {
    main,
    extra,
    side,
    buildNotes,
    sourceAudit: [
      ...fieldDecksResponse.sourceAudit,
      ...matchedDecksResponse.sourceAudit,
      ...hydratedCardsResponse.sourceAudit,
      ...bossCardResponse.sourceAudit,
    ],
    metaSnapshot,
    structuralReadout,
  };
}
