import { createStructuralReadout, inferCardRoles } from "@/lib/games/yugioh/builder-shell";
import {
  buildYugiohMetaSnapshot,
  fetchTournamentMetaDecks,
  normalizeDeckVersionLabel,
  slugifyDeckVersionLabel,
  type YugiohMetaDeckRecord,
} from "@/lib/games/yugioh/meta";
import type { SourceAudit } from "@/lib/games/shared/types";
import type {
  YugiohBuildIntent,
  YugiohCard,
  YugiohConstraint,
  YugiohDeckEntry,
  YugiohDeckSeed,
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

type ThemeSignals = {
  labels: string[];
  archetypes: string[];
  anchors: string[];
  queries: string[];
  primaryLabel: string;
};

function filterDecksByPreferredVersion(
  decks: YugiohMetaDeckRecord[],
  themeQuery: string,
  preferredDeckVersion: string | null | undefined,
) {
  if (!preferredDeckVersion) {
    return decks;
  }

  const filtered = decks.filter((deck) => {
    const label = normalizeDeckVersionLabel(deck.deckName, themeQuery);
    return slugifyDeckVersionLabel(label) === preferredDeckVersion;
  });

  return filtered.length > 0 ? filtered : decks;
}

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

function buildThemeSignals(theme: YugiohThemeSelection, anchorCards: YugiohCard[] = [], seedCards: YugiohCard[] = []): ThemeSignals {
  const anchorArchetypes = anchorCards.map((card) => card.archetype).filter((value): value is string => Boolean(value));
  const seedArchetypes = seedCards.map((card) => card.archetype).filter((value): value is string => Boolean(value));
  const seedNames = seedCards.map((card) => card.name).slice(0, 6);
  const anchors = uniqueStrings(theme.resolvedBossCards);
  const anchoredThemes = uniqueStrings(theme.resolvedSupportCards);
  const archetypes = uniqueStrings([theme.resolvedArchetype, ...anchoredThemes, ...anchorArchetypes, ...seedArchetypes]);
  const labels = uniqueStrings([...anchoredThemes, ...anchors, ...seedNames, theme.query]);
  const queries = uniqueStrings([
    theme.resolvedArchetype,
    ...anchoredThemes,
    ...anchors,
    ...anchorArchetypes,
    ...seedArchetypes,
    ...seedNames,
    theme.query,
  ]);

  return {
    labels,
    archetypes,
    anchors,
    queries,
    primaryLabel: labels[0] ?? "this deck",
  };
}

function matchesTheme(card: YugiohCard, signals: ThemeSignals) {
  if (signals.archetypes.some((archetype) => card.archetype?.toLowerCase() === archetype.toLowerCase())) {
    return true;
  }

  return signals.anchors.some((bossCard) => bossCard.toLowerCase() === card.name.toLowerCase());
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

async function resolveThemeMeta(queries: string[]) {
  const deckMap = new Map<string, YugiohMetaDeckRecord>();
  const decksByQuery = new Map<string, YugiohMetaDeckRecord[]>();
  const sourceAudit: SourceAudit[] = [];
  const perQueryLimit = queries.length > 1 ? 8 : 12;

  for (const query of queries) {
    const response = await fetchTournamentMetaDecks({
      query,
      limit: perQueryLimit,
    });

    sourceAudit.push(...response.sourceAudit);
    decksByQuery.set(query, response.decks);

    for (const deck of response.decks) {
      deckMap.set(deck.deckUrl, deck);
    }
  }

  return {
    decks: [...deckMap.values()],
    decksByQuery,
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

function buildReadableRationale({
  roles,
  deckAppearances,
  sampleSize,
  fieldLevel,
  themeLabel,
}: {
  roles: ReturnType<typeof inferCardRoles>;
  deckAppearances: number;
  sampleSize: number;
  fieldLevel: "theme" | "field";
  themeLabel: string;
}): string {
  const appearanceText =
    fieldLevel === "theme"
      ? `In ${deckAppearances}/${sampleSize} ${themeLabel} tournament lists.`
      : `Staple in ${deckAppearances}/${sampleSize} recent meta decks.`;

  if (roles.includes("hand-trap")) {
    return `${appearanceText} Hand trap — activates from hand to disrupt opponent combos without using your turn.`;
  }
  if (roles.includes("board-breaker")) {
    return `${appearanceText} Board breaker — clears established fields when you're going second.`;
  }
  if (roles.includes("starter") && roles.includes("searcher")) {
    return `${appearanceText} Starter and searcher — begins your combo and finds the next piece from deck.`;
  }
  if (roles.includes("starter")) {
    return `${appearanceText} Starter — gets your combo going from a single card in hand.`;
  }
  if (roles.includes("searcher")) {
    return `${appearanceText} Searcher — digs your engine pieces out of the deck to power through disruption.`;
  }
  if (roles.includes("extender")) {
    return `${appearanceText} Extender — keeps your combo alive after the opener, even through a negate.`;
  }
  if (roles.includes("payoff")) {
    return `${appearanceText} Payoff — the threat you build toward. Closes out games or locks in your win condition.`;
  }
  if (roles.includes("engine-core")) {
    return `${appearanceText} Core engine piece — essential to the ${themeLabel} strategy.`;
  }
  if (roles.includes("extra-toolbox")) {
    return `${appearanceText} Extra Deck toolbox — accessible through your combo lines as a situational out or extender.`;
  }
  if (roles.includes("side-tech")) {
    return `${appearanceText} Side deck tech — brought in for specific matchups where it swings the game.`;
  }
  if (roles.includes("grind-tool")) {
    return `${appearanceText} Grind tool — generates advantage in longer games and helps recover resources.`;
  }

  return `${appearanceText} Recurring inclusion across competitive lists for this strategy.`;
}

function rankedCandidatesFromStats({
  stats,
  cardMap,
  section,
  theme,
  signals,
  buildIntent,
  constraints,
  sampleSize,
  fieldLevel,
}: {
  stats: CardStats[];
  cardMap: Map<number, YugiohCard>;
  section: YugiohDeckSection;
  theme: YugiohThemeSelection;
  signals: ThemeSignals;
  buildIntent: YugiohBuildIntent;
  constraints: YugiohConstraint[];
  sampleSize: number;
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

      if (fieldLevel === "theme" && matchesTheme(card, signals)) {
        score += 14;
      }

      if (signals.anchors.some((bossCard) => bossCard.toLowerCase() === card.name.toLowerCase())) {
        score += 20;
      }

      if (signals.archetypes.some((archetype) => archetype.toLowerCase() === (card.archetype?.toLowerCase() ?? ""))) {
        score += fieldLevel === "theme" ? 18 : 10;
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

      if (buildIntent === "pure" && fieldLevel === "theme" && matchesTheme(card, signals)) {
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
        rationale: buildReadableRationale({
          roles,
          deckAppearances: entry.deckAppearances,
          sampleSize,
          fieldLevel,
          themeLabel: signals.labels.join(" + ") || signals.primaryLabel,
        }),
      } satisfies RankedCandidate;
    })
    .filter((candidate): candidate is RankedCandidate => Boolean(candidate))
    .sort((left, right) => right.score - left.score || left.card.name.localeCompare(right.card.name));
}

function upsertEntry(
  entries: YugiohDeckEntry[],
  candidate: RankedCandidate,
  copies: number,
  theme: YugiohThemeSelection,
  signals: ThemeSignals,
) {
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
    locked: matchesTheme(candidate.card, signals),
  });

  return nextEntries.sort((left, right) => left.card.name.localeCompare(right.card.name));
}

function fillSectionFromCandidates({
  entries,
  candidates,
  targetCount,
  theme,
  signals,
  buildIntent,
  strengthTarget,
  constraints,
}: {
  entries: YugiohDeckEntry[];
  candidates: RankedCandidate[];
  targetCount: number;
  theme: YugiohThemeSelection;
  signals: ThemeSignals;
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

    nextEntries = upsertEntry(nextEntries, candidate, copiesToAdd, theme, signals);
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

async function hydrateSeedEntries(seedEntries: YugiohDeckSeed[], theme: YugiohThemeSelection) {
  if (seedEntries.length === 0) {
    return {
      cards: [] as YugiohCard[],
      entries: [] as YugiohDeckEntry[],
      sourceAudit: [] as SourceAudit[],
    };
  }

  const uniqueIds = [...new Set(seedEntries.map((entry) => entry.cardId))];
  const response = await lookupYugiohCardsByIds(uniqueIds);
  const cardMap = new Map<number, YugiohCard>(response.cards.map((card) => [card.id, card]));
  const entries: YugiohDeckEntry[] = seedEntries
    .map((seed): YugiohDeckEntry | null => {
      const card = cardMap.get(seed.cardId);

      if (!card) {
        return null;
      }

      return {
        card,
        quantity: seed.quantity,
        section: seed.section,
        roles: inferCardRoles(card, theme, seed.section),
        rationale: "Manual seed — you added this card before generating, so the deck builds around it.",
        locked: true,
      };
    })
    .filter((entry): entry is YugiohDeckEntry => entry !== null);

  return {
    cards: response.cards,
    entries,
    sourceAudit: response.sourceAudit,
  };
}

export async function generateYugiohDeckShell({
  theme,
  preferredDeckVersion = null,
  seedEntries = [],
  buildIntent,
  strengthTarget,
  constraints,
}: {
  theme: YugiohThemeSelection;
  preferredDeckVersion?: string | null;
  seedEntries?: YugiohDeckSeed[];
  buildIntent: YugiohBuildIntent;
  strengthTarget: YugiohStrengthTarget;
  constraints: YugiohConstraint[];
}): Promise<YugiohGeneratedDeckResponse> {
  const [bossCardResponse, seedCardResponse] = await Promise.all([
    hydrateBossCards(theme),
    hydrateSeedEntries(seedEntries, theme),
  ]);
  const themeSignals = buildThemeSignals(theme, bossCardResponse.cards, seedCardResponse.cards);

  const [fieldDecksResponse, matchedDecksResponse] = await Promise.all([
    fetchTournamentMetaDecks({
      limit: 40,
    }),
    resolveThemeMeta(themeSignals.queries),
  ]);

  const fieldDecks = fieldDecksResponse.decks;
  const matchedDecks = filterDecksByPreferredVersion(
    matchedDecksResponse.decks,
    themeSignals.labels.join(" + ") || theme.query,
    preferredDeckVersion,
  );
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
    [...hydratedCardsResponse.cards, ...bossCardResponse.cards, ...seedCardResponse.cards].map((card) => [card.id, card]),
  );

  let main: YugiohDeckEntry[] = seedCardResponse.entries.filter((entry) => entry.section === "main");
  let extra: YugiohDeckEntry[] = seedCardResponse.entries.filter((entry) => entry.section === "extra");
  let side: YugiohDeckEntry[] = seedCardResponse.entries.filter((entry) => entry.section === "side");
  const anchoredThemeNames = theme.resolvedSupportCards.length > 0
    ? theme.resolvedSupportCards
    : theme.resolvedArchetype
      ? [theme.resolvedArchetype]
      : [];

  if (bossCardResponse.cards.length > 0) {
    const bossCandidates = bossCardResponse.cards.map((card) => ({
      card,
      score: 999,
      averageCopies: 1,
      deckAppearances: 1,
      section: /Fusion|Synchro|Xyz|Link/i.test(card.typeLine) ? "extra" : "main",
      rationale: `Anchored — you pinned this as a key card, so the shell is built around it.`,
    })) satisfies RankedCandidate[];

    main = fillSectionFromCandidates({
      entries: main,
      candidates: bossCandidates.filter((candidate) => candidate.section === "main"),
      targetCount: 3,
      theme,
      signals: themeSignals,
      buildIntent,
      strengthTarget,
      constraints,
    });

    extra = fillSectionFromCandidates({
      entries: extra,
      candidates: bossCandidates.filter((candidate) => candidate.section === "extra"),
      targetCount: 2,
      theme,
      signals: themeSignals,
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
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    fieldLevel: "theme",
  });
  const extraThemeCandidates = rankedCandidatesFromStats({
    stats: extraThemeStats,
    cardMap,
    section: "extra",
    theme,
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    fieldLevel: "theme",
  });
  const sideThemeCandidates = rankedCandidatesFromStats({
    stats: sideThemeStats,
    cardMap,
    section: "side",
    theme,
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(matchedDecks.length, 1),
    fieldLevel: "theme",
  });
  const mainFieldCandidates = rankedCandidatesFromStats({
    stats: mainFieldStats,
    cardMap,
    section: "main",
    theme,
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    fieldLevel: "field",
  });
  const extraFieldCandidates = rankedCandidatesFromStats({
    stats: extraFieldStats,
    cardMap,
    section: "extra",
    theme,
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    fieldLevel: "field",
  });
  const sideFieldCandidates = rankedCandidatesFromStats({
    stats: sideFieldStats,
    cardMap,
    section: "side",
    theme,
    signals: themeSignals,
    buildIntent,
    constraints,
    sampleSize: Math.max(fieldDecks.length, 1),
    fieldLevel: "field",
  });

  const mainTarget = mainDeckTarget(buildIntent, strengthTarget);
  const extraTarget = extraDeckTarget(constraints);
  const sideTarget = sideDeckTarget(strengthTarget);

  if (anchoredThemeNames.length > 1) {
    const reservedPerTheme = Math.max(4, Math.floor(themeCoreTarget(buildIntent) / anchoredThemeNames.length));

    for (const themeName of anchoredThemeNames) {
      const themeDecks = filterDecksByPreferredVersion(
        matchedDecksResponse.decksByQuery.get(themeName) ?? [],
        themeName,
        preferredDeckVersion,
      );

      if (themeDecks.length === 0) {
        continue;
      }

      const isolatedTheme: YugiohThemeSelection = {
        query: themeName,
        resolvedArchetype: themeName,
        resolvedBossCards: theme.resolvedBossCards,
        resolvedSupportCards: [themeName],
        inactiveBossCards: theme.inactiveBossCards,
        inactiveSupportCards: theme.inactiveSupportCards,
      };
      const isolatedSignals = buildThemeSignals(isolatedTheme, bossCardResponse.cards, seedCardResponse.cards);
      const isolatedMainCandidates = rankedCandidatesFromStats({
        stats: buildStats(themeDecks, "main"),
        cardMap,
        section: "main",
        theme: isolatedTheme,
        signals: isolatedSignals,
        buildIntent,
        constraints,
        sampleSize: Math.max(themeDecks.length, 1),
        fieldLevel: "theme",
      });

      main = fillSectionFromCandidates({
        entries: main,
        candidates: isolatedMainCandidates,
        targetCount: Math.min(mainTarget, sumEntries(main) + reservedPerTheme),
        theme,
        signals: themeSignals,
        buildIntent,
        strengthTarget,
        constraints,
      });
    }
  }

  main = fillSectionFromCandidates({
    entries: main,
    candidates: mainThemeCandidates,
    targetCount: themeCoreTarget(buildIntent),
    theme,
    signals: themeSignals,
    buildIntent,
    strengthTarget,
    constraints,
  });

  main = fillSectionFromCandidates({
    entries: main,
    candidates: [...mainThemeCandidates, ...mainFieldCandidates],
    targetCount: mainTarget,
    theme,
    signals: themeSignals,
    buildIntent,
    strengthTarget,
    constraints,
  });

  extra = fillSectionFromCandidates({
    entries: extra,
    candidates: [...extraThemeCandidates, ...extraFieldCandidates],
    targetCount: extraTarget,
    theme,
    signals: themeSignals,
    buildIntent,
    strengthTarget,
    constraints,
  });

  side = fillSectionFromCandidates({
    entries: side,
    candidates: [...sideFieldCandidates, ...sideThemeCandidates],
    targetCount: sideTarget,
    theme,
    signals: themeSignals,
    buildIntent,
    strengthTarget,
    constraints,
  });

  if (matchedDecks.length === 0) {
    const fallbackQuery = themeSignals.anchors[0] ?? seedCardResponse.cards[0]?.name ?? theme.query;
    const fallbackArchetype = themeSignals.archetypes[0];
    const fallbackCardsResponse = await searchYugiohCards(fallbackQuery, fallbackArchetype);
    const fallbackCandidates = fallbackCardsResponse.cards.map((card) => ({
      card,
      score: matchesTheme(card, themeSignals) ? 40 : 20,
      averageCopies: 2,
      deckAppearances: 1,
      section: /Fusion|Synchro|Xyz|Link/i.test(card.typeLine) ? "extra" : "main",
      rationale: `Included via direct archetype search — no tournament data available, so this is a best-guess based on card pool.`,
    })) satisfies RankedCandidate[];

    main = fillSectionFromCandidates({
      entries: main,
      candidates: fallbackCandidates.filter((candidate) => candidate.section === "main"),
      targetCount: Math.min(mainTarget, 24),
      theme,
      signals: themeSignals,
      buildIntent,
      strengthTarget,
      constraints,
    });

    extra = fillSectionFromCandidates({
      entries: extra,
      candidates: fallbackCandidates.filter((candidate) => candidate.section === "extra"),
      targetCount: extraTarget,
      theme,
      signals: themeSignals,
      buildIntent,
      strengthTarget,
      constraints,
    });
  }

  const metaSnapshot = buildYugiohMetaSnapshot({
    themeQuery: themeSignals.labels.join(" + ") || theme.query,
    matchedDecks: matchedDecksResponse.decks,
    fieldDecks,
    selectedDeckVersion: preferredDeckVersion,
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
    seedCardResponse.entries.length > 0
      ? `${seedCardResponse.entries.length} manual seed card${seedCardResponse.entries.length === 1 ? "" : "s"} were preserved and used as build inputs.`
      : "No manual seed cards were supplied before generation.",
    themeSignals.archetypes.length > 1 || themeSignals.anchors.length > 1
      ? `Multiple theme anchors were blended into the source pool: ${themeSignals.labels.join(", ")}.`
      : `Primary theme focus: ${themeSignals.primaryLabel}.`,
    preferredDeckVersion && metaSnapshot.deckVersions.some((version) => version.id === preferredDeckVersion)
      ? `Version bias applied: ${metaSnapshot.deckVersions.find((version) => version.id === preferredDeckVersion)?.label}.`
      : "No specific deck version was locked, so the build leans toward the broadest popular version mix.",
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
      ...seedCardResponse.sourceAudit,
    ],
    metaSnapshot,
    structuralReadout,
  };
}
