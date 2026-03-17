import type {
  YugiohBuildIntent,
  YugiohCard,
  YugiohCardRole,
  YugiohConstraint,
  YugiohDeckEntry,
  YugiohDeckSection,
  YugiohFormatMode,
  YugiohMetaSnapshot,
  YugiohStrengthTarget,
  YugiohStructuralReadout,
  YugiohThemeSelection,
} from "@/lib/games/yugioh/types";

export const YUGIOH_FORMAT_OPTIONS: Array<{
  value: YugiohFormatMode;
  title: string;
  description: string;
}> = [
  {
    value: "open-lab",
    title: "Open Lab",
    description: "Ignore list restrictions and push the cleanest, strongest shell for the idea.",
  },
  {
    value: "tcg-advanced",
    title: "TCG Advanced",
    description: "Keep the structure grounded in normal modern deck expectations.",
  },
  {
    value: "master-duel",
    title: "Master Duel",
    description: "Reserved for a later ruleset pass and card-pool split.",
  },
  {
    value: "edison",
    title: "Edison",
    description: "Future retro-mode placeholder so the architecture stays honest now.",
  },
  {
    value: "goat",
    title: "GOAT",
    description: "Future retro-mode placeholder for a very different deck ecosystem.",
  },
];

export const YUGIOH_STRENGTH_OPTIONS: Array<{
  value: YugiohStrengthTarget;
  title: string;
  description: string;
}> = [
  {
    value: "casual",
    title: "Casual",
    description: "Lower pressure, more flavor, softer non-engine expectations.",
  },
  {
    value: "strong",
    title: "Strong",
    description: "Solid locals-ready shell with real interaction and cleaner ratios.",
  },
  {
    value: "tournament-level",
    title: "Tournament",
    description: "Sharper structure, tighter counts, stronger pressure on the field.",
  },
  {
    value: "degenerate",
    title: "Degenerate",
    description: "Maximum ceiling and pressure, even when the list gets brutal.",
  },
];

export const YUGIOH_INTENT_OPTIONS: Array<{
  value: YugiohBuildIntent;
  title: string;
  description: string;
}> = [
  {
    value: "pure",
    title: "Pure",
    description: "Stay close to the named theme and minimize splashes.",
  },
  {
    value: "hybrid",
    title: "Hybrid",
    description: "Leave room for adjacent engines that sharpen the theme.",
  },
  {
    value: "anti-meta",
    title: "Anti-Meta",
    description: "Bias the shell toward interaction, breakers, and matchup pressure.",
  },
  {
    value: "consistency-first",
    title: "Consistency",
    description: "Lean harder into starters, searchers, and stable openers.",
  },
  {
    value: "ceiling-first",
    title: "Ceiling",
    description: "Chase higher end boards and scarier payoff density.",
  },
  {
    value: "blind-second",
    title: "Blind Second",
    description: "Favor breakers, damage pressure, and crack-back potential.",
  },
  {
    value: "grind",
    title: "Grind",
    description: "Extend resource loops and recovery over raw explosiveness.",
  },
];

export const YUGIOH_CONSTRAINT_OPTIONS: Array<{
  value: YugiohConstraint;
  title: string;
  description: string;
}> = [
  {
    value: "pure-only",
    title: "Pure Only",
    description: "Keep the shell close to the named archetype.",
  },
  {
    value: "avoid-floodgates",
    title: "Avoid Floodgates",
    description: "Steer away from blunt lock pieces and static hate cards.",
  },
  {
    value: "low-brick",
    title: "Low Brick",
    description: "Prefer fewer dead draws and smoother openers.",
  },
  {
    value: "fewer-hand-traps",
    title: "Fewer Hand Traps",
    description: "Reserve more space for engine and board pressure.",
  },
  {
    value: "limit-traps",
    title: "Limit Traps",
    description: "Keep trap count lean so the deck stays proactive.",
  },
  {
    value: "low-extra-reliance",
    title: "Low Extra Reliance",
    description: "Reduce how much the shell depends on the Extra Deck.",
  },
  {
    value: "budget-aware",
    title: "Budget Aware",
    description: "Placeholder toggle for the later pricing-aware pass.",
  },
];

const EXTRA_DECK_MARKERS = ["fusion", "synchro", "xyz", "link"];
const SPELL_TRAP_MARKERS = ["spell", "trap"];

export type YugiohRoleBucketSummary = {
  id: string;
  title: string;
  count: number;
  description: string;
};

export type YugiohQuickRebuildOption = {
  id: string;
  title: string;
  description: string;
  buildIntent: YugiohBuildIntent;
  constraints: YugiohConstraint[];
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

export function inferDeckSection(card: YugiohCard): YugiohDeckSection {
  const typeLine = card.typeLine.toLowerCase();

  if (includesAny(typeLine, EXTRA_DECK_MARKERS)) {
    return "extra";
  }

  return "main";
}

export function inferCardRoles(
  card: YugiohCard,
  theme: YugiohThemeSelection | null,
  section: YugiohDeckSection,
): YugiohCardRole[] {
  const text = card.desc.toLowerCase();
  const typeLine = card.typeLine.toLowerCase();
  const themeNames = [theme?.resolvedArchetype, ...(theme?.resolvedSupportCards ?? [])]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const roles = new Set<YugiohCardRole>();

  if (themeNames.some((themeName) => card.archetype?.toLowerCase() === themeName || text.includes(themeName))) {
    roles.add(SPELL_TRAP_MARKERS.some((marker) => typeLine.includes(marker)) ? "engine-support" : "engine-core");
  }

  if (
    text.includes("add 1") ||
    text.includes("add up to") ||
    text.includes("from your deck to your hand") ||
    text.includes("from deck to your hand")
  ) {
    roles.add("searcher");
    roles.add("starter");
  }

  if (text.includes("special summon")) {
    roles.add("extender");
  }

  if (text.includes("negate") && (text.includes("hand") || text.includes("discard this card"))) {
    roles.add("hand-trap");
  }

  if (
    text.includes("destroy all") ||
    text.includes("banish all") ||
    text.includes("send all") ||
    text.includes("your opponent controls")
  ) {
    roles.add("board-breaker");
  }

  if (text.includes("draw") || text.includes("recover") || text.includes("return")) {
    roles.add("grind-tool");
  }

  if (
    (card.atk !== null && card.atk >= 2500) ||
    text.includes("cannot be destroyed") ||
    text.includes("this card gains") ||
    text.includes("inflict")
  ) {
    roles.add("payoff");
  }

  if (section === "side") {
    roles.add("side-tech");
  }

  if (section === "extra") {
    roles.add("extra-toolbox");
  }

  if (
    text.includes("cannot be normal summoned") ||
    text.includes("must be special summoned") ||
    (card.levelRankLink !== null && card.levelRankLink >= 8 && !roles.has("starter"))
  ) {
    roles.add("brick-risk");
  }

  if (roles.size === 0) {
    roles.add(section === "extra" ? "extra-toolbox" : "engine-support");
  }

  return Array.from(roles);
}

function countCopies(entries: YugiohDeckEntry[]) {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

function countRoleCopies(entries: YugiohDeckEntry[], role: YugiohCardRole) {
  return entries.reduce((total, entry) => {
    return entry.roles.includes(role) ? total + entry.quantity : total;
  }, 0);
}

function countThemeCopies(entries: YugiohDeckEntry[], theme: YugiohThemeSelection | null) {
  const themeNames = new Set(
    [theme?.resolvedArchetype, ...(theme?.resolvedSupportCards ?? [])]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  const anchorCards = new Set((theme?.resolvedBossCards ?? []).map((name) => name.toLowerCase()));

  return entries.reduce((total, entry) => {
    const matchesTheme =
      (entry.card.archetype ? themeNames.has(entry.card.archetype.toLowerCase()) : false) ||
      anchorCards.has(entry.card.name.toLowerCase());

    return matchesTheme ? total + entry.quantity : total;
  }, 0);
}

function mergeConstraintList(
  constraints: YugiohConstraint[],
  payload: { add?: YugiohConstraint[]; remove?: YugiohConstraint[] },
) {
  const add = payload.add ?? [];
  const remove = new Set(payload.remove ?? []);

  return [...new Set(constraints.filter((constraint) => !remove.has(constraint)).concat(add))];
}

function themeLabel(theme: YugiohThemeSelection | null) {
  return theme?.resolvedSupportCards?.[0] ?? theme?.resolvedArchetype ?? theme?.resolvedBossCards[0] ?? theme?.query.trim() ?? "this deck";
}

export function createRoleBucketSummary(payload: {
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  theme: YugiohThemeSelection | null;
}): YugiohRoleBucketSummary[] {
  const { main, extra, side, theme } = payload;
  const starters = countRoleCopies(main, "starter") + countRoleCopies(main, "searcher");
  const extenders = countRoleCopies(main, "extender");
  const payoffs = countRoleCopies(main, "payoff") + countRoleCopies(extra, "payoff");
  const breakers = countRoleCopies(main, "board-breaker") + countRoleCopies(side, "board-breaker");
  const interaction = countRoleCopies(main, "hand-trap") + countRoleCopies(side, "hand-trap");
  const brickRisk = countRoleCopies(main, "brick-risk");
  const themeCopies = countThemeCopies([...main, ...extra, ...side], theme);
  const extraTools = countRoleCopies(extra, "extra-toolbox");
  const label = themeLabel(theme);

  return [
    {
      id: "theme-core",
      title: "Engine",
      count: themeCopies,
      description:
        themeCopies >= 16
          ? `${label} engine density is tight. The deck will feel cohesive.`
          : `${label} needs more named engine pieces to feel like a real build.`,
    },
    {
      id: "starters",
      title: "Starters",
      count: starters,
      description:
        starters >= 12
          ? "Opener density is healthy. You'll reliably see your first move."
          : "Low on starters — expect more bricks and awkward opening hands.",
    },
    {
      id: "extenders",
      title: "Extenders",
      count: extenders,
      description:
        extenders >= 6
          ? "Enough extenders to push through disruption and keep combos alive."
          : "Thin on extenders — one negate may kill your entire turn.",
    },
    {
      id: "interaction",
      title: "Hand Traps",
      count: interaction,
      description:
        interaction >= 9
          ? "Heavy hand trap count. Strong chance to slow down or stop the opponent's combo."
          : interaction >= 6
          ? "Solid hand trap count for trading with most combo decks."
          : "Light on hand traps — the opponent gets more room to set up.",
    },
    {
      id: "breakers",
      title: "Board Breakers",
      count: breakers,
      description:
        breakers >= 5
          ? "Strong breaker lineup. Going second is viable and explosive."
          : "Light on board breakers — winning going second will be harder.",
    },
    {
      id: "payoffs",
      title: "Payoffs",
      count: payoffs,
      description:
        payoffs >= 6
          ? "Enough payoff pressure to end turns on threatening boards."
          : "Low payoff count — the deck may struggle to close out games.",
    },
    {
      id: "brick-risk",
      title: "Bricks",
      count: brickRisk,
      description:
        brickRisk <= 4
          ? "Brick count is under control."
          : "High brick count — dead draws will show up more often than you'd like.",
    },
    {
      id: "extra-tools",
      title: "Extra Deck",
      count: extraTools,
      description:
        extraTools >= 10
          ? "Deep Extra Deck toolbox with multiple accessible lines."
          : "Shallow Extra Deck — limited access to tech plays and outs.",
    },
  ];
}

export function deriveQuickRebuildOptions(payload: {
  buildIntent: YugiohBuildIntent;
  constraints: YugiohConstraint[];
  readout: YugiohStructuralReadout;
  theme: YugiohThemeSelection | null;
  metaSnapshot: YugiohMetaSnapshot | null;
}): YugiohQuickRebuildOption[] {
  const { buildIntent, constraints, readout, theme, metaSnapshot } = payload;
  const options: YugiohQuickRebuildOption[] = [];
  const label = themeLabel(theme);
  const topFieldDeck = metaSnapshot?.topFieldDecks[0]?.name;

  options.push({
    id: "consistency-first",
    title: "Tighten openers",
    description:
      readout.consistency >= 78
        ? `Rebuild ${label} around cleaner starters and fewer dead draws.`
        : `Consistency is the biggest current pressure point, so this rebuild leans harder into starters and low-brick ratios.`,
    buildIntent: "consistency-first",
    constraints: mergeConstraintList(constraints, {
      add: ["low-brick"],
      remove: ["fewer-hand-traps"],
    }),
  });

  if (theme) {
    options.push({
      id: "pure-theme",
      title: "Stay purer",
      description: `Push the shell closer to ${label} itself and cut away more splash noise.`,
      buildIntent: "pure",
      constraints: mergeConstraintList(constraints, {
        add: ["pure-only"],
      }),
    });
  }

  options.push({
    id: "anti-meta",
    title: "Pressure the field",
    description: topFieldDeck
      ? `Rebuild with more interaction and breaker density for a field that currently leans toward ${topFieldDeck}.`
      : "Rebuild with more interaction and breaker density so the shell can punch up into common field decks.",
    buildIntent: "anti-meta",
    constraints: mergeConstraintList(constraints, {
      remove: ["fewer-hand-traps"],
    }),
  });

  options.push({
    id: "ceiling-first",
    title: "Push ceiling",
    description:
      readout.pressure >= 74
        ? `Let ${label} chase scarier payoff turns and greedier end boards.`
        : `Pressure is lagging a bit, so this rebuild chases stronger payoff density and extension.`,
    buildIntent: "ceiling-first",
    constraints: mergeConstraintList(constraints, {
      remove: ["low-brick"],
    }),
  });

  options.push({
    id: "blind-second",
    title: "Go second harder",
    description: "Bias flex slots toward board breakers and crack-back pressure for a more explosive second-turn posture.",
    buildIntent: "blind-second",
    constraints: mergeConstraintList(constraints, {
      remove: ["limit-traps"],
    }),
  });

  const deduped = new Map<string, YugiohQuickRebuildOption>();

  for (const option of options) {
    if (option.buildIntent === buildIntent && option.constraints.join("|") === constraints.join("|")) {
      continue;
    }

    deduped.set(option.id, option);
  }

  return [...deduped.values()].slice(0, 4);
}

export type YugiohOpeningHandOdds = {
  starterOdds: number;
  handTrapOdds: number;
  breakerOdds: number;
  handSize: number;
};

function combinations(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

function atLeastOne(deckSize: number, desiredCount: number, handSize: number): number {
  if (desiredCount <= 0) return 0;
  if (desiredCount >= deckSize) return 1;
  const pNone = combinations(deckSize - desiredCount, handSize) / combinations(deckSize, handSize);
  return Math.round((1 - pNone) * 100);
}

export function computeOpeningHandOdds(payload: {
  main: YugiohDeckEntry[];
  turnPreference: "going-first" | "going-second";
}): YugiohOpeningHandOdds {
  const { main, turnPreference } = payload;
  const deckSize = Math.max(main.reduce((sum, e) => sum + e.quantity, 0), 40);
  const handSize = turnPreference === "going-second" ? 6 : 5;

  const starterCount = countRoleCopies(main, "starter") + countRoleCopies(main, "searcher");
  const handTrapCount = countRoleCopies(main, "hand-trap");
  const breakerCount = countRoleCopies(main, "board-breaker");

  return {
    starterOdds: atLeastOne(deckSize, starterCount, handSize),
    handTrapOdds: atLeastOne(deckSize, handTrapCount, handSize),
    breakerOdds: atLeastOne(deckSize, breakerCount, handSize),
    handSize,
  };
}

export function createStructuralReadout(payload: {
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  theme: YugiohThemeSelection | null;
  buildIntent: YugiohBuildIntent;
  strengthTarget: YugiohStrengthTarget;
  constraints: YugiohConstraint[];
}): YugiohStructuralReadout {
  const { main, extra, side, theme, buildIntent, strengthTarget, constraints } = payload;
  const mainCount = countCopies(main);
  const extraCount = countCopies(extra);
  const sideCount = countCopies(side);
  const starterCount = countRoleCopies(main, "starter") + countRoleCopies(main, "searcher");
  const extenderCount = countRoleCopies(main, "extender");
  const payoffCount = countRoleCopies(main, "payoff") + countRoleCopies(extra, "payoff");
  const boardBreakerCount = countRoleCopies(main, "board-breaker") + countRoleCopies(side, "board-breaker");
  const handTrapCount = countRoleCopies(main, "hand-trap") + countRoleCopies(side, "hand-trap");
  const brickRiskCount = countRoleCopies(main, "brick-risk");
  const themeCopies = countThemeCopies([...main, ...extra, ...side], theme);
  const warnings: string[] = [];
  const notes: string[] = [];

  if (mainCount < 40) {
    warnings.push("Main Deck is still short. Real Yu-Gi-Oh shells usually need at least 40 cards to function.");
  } else if (mainCount > 45 && strengthTarget !== "casual") {
    warnings.push("Main Deck is getting wide. Trimming toward the low 40s usually helps consistency.");
  }

  if (extraCount > 15) {
    warnings.push("Extra Deck is over 15 cards. Keep it tighter so the toolkit stays intentional.");
  }

  if (sideCount > 15) {
    warnings.push("Side Deck is over 15 cards. Reserve that space for matchup-specific tech only.");
  }

  if (!constraints.includes("low-extra-reliance") && extraCount < 5) {
    notes.push("Extra Deck is still thin. Most modern shells want a deeper toolbox unless you intentionally avoid it.");
  }

  if (starterCount < 10 && mainCount >= 30) {
    warnings.push("Starter density looks low. The shell may struggle to open cleanly.");
  } else if (starterCount >= 14) {
    notes.push("Starter density is healthy, which should help the deck see engine pieces more often.");
  }

  if (brickRiskCount > starterCount && constraints.includes("low-brick")) {
    warnings.push("Brick risk is high compared with the deck's actual starters. Cut dead payoff cards first.");
  }

  if (theme && themeCopies < 12) {
    notes.push("Theme is chosen, but the shell still needs more named engine pieces before it feels coherent.");
  } else if (theme && themeCopies >= 16) {
    notes.push("Theme density is strong enough to keep the deck feeling like the idea you picked.");
  }

  if (buildIntent === "blind-second" && boardBreakerCount < 6) {
    warnings.push("Blind-second intent is selected, but the shell still needs more breaker-style cards.");
  }

  if (buildIntent === "anti-meta" && handTrapCount + boardBreakerCount < 8) {
    notes.push("Anti-meta posture is selected. Expect to add more interaction and breaker slots in the next pass.");
  }

  if (constraints.includes("fewer-hand-traps") && handTrapCount > 6) {
    warnings.push("Hand trap count is drifting higher than the chosen constraint suggests.");
  }

  const consistency = clampScore(
    48 +
      Math.min(starterCount, 16) * 2 +
      Math.min(extenderCount, 10) -
      Math.max(0, mainCount - 42) * 1.5 -
      brickRiskCount * 2.5,
  );

  const synergy = clampScore(
    44 +
      Math.min(themeCopies, 18) * 2 +
      (buildIntent === "pure" ? 8 : 0) +
      (buildIntent === "hybrid" ? 4 : 0),
  );

  const pressure = clampScore(
    42 +
      Math.min(payoffCount, 10) * 3 +
      (buildIntent === "ceiling-first" ? 10 : 0) +
      (strengthTarget === "degenerate" ? 8 : strengthTarget === "tournament-level" ? 4 : 0),
  );

  const adaptability = clampScore(
    38 +
      Math.min(boardBreakerCount, 8) * 4 +
      Math.min(handTrapCount, 8) * 2 +
      (sideCount >= 10 ? 8 : sideCount >= 5 ? 4 : 0) +
      (buildIntent === "anti-meta" ? 8 : 0),
  );

  const structuralIntegrity = clampScore(
    55 -
      Math.max(0, 40 - mainCount) * 3 -
      Math.max(0, extraCount - 15) * 5 -
      Math.max(0, sideCount - 15) * 5 -
      Math.max(0, brickRiskCount - starterCount) * 2,
  );

  const finalScore = clampScore(
    consistency * 0.28 +
      synergy * 0.24 +
      pressure * 0.2 +
      adaptability * 0.16 +
      structuralIntegrity * 0.12,
  );

  if (warnings.length === 0) {
    notes.unshift("This is a structurally promising shell for a manual workbench phase, even before generator logic lands.");
  }

  return {
    consistency,
    synergy,
    pressure,
    adaptability,
    structuralIntegrity,
    finalScore,
    warnings,
    notes,
  };
}
