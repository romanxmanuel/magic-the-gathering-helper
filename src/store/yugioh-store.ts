"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { SourceAudit } from "@/lib/games/shared/types";
import { inferCardRoles } from "@/lib/games/yugioh/builder-shell";
import type {
  YugiohBuildIntent,
  YugiohCard,
  YugiohConstraint,
  YugiohDeckEntry,
  YugiohGeneratedDeckResponse,
  YugiohDeckSection,
  YugiohFormatMode,
  YugiohStrengthTarget,
  YugiohThemeSelection,
  YugiohTurnPreference,
} from "@/lib/games/yugioh/types";

type YugiohStoreState = {
  formatMode: YugiohFormatMode;
  strengthTarget: YugiohStrengthTarget;
  turnPreference: YugiohTurnPreference;
  buildIntent: YugiohBuildIntent;
  theme: YugiohThemeSelection | null;
  constraints: YugiohConstraint[];
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  buildNotes: string[];
  sourceAudit: SourceAudit[];
  metaSnapshot: YugiohGeneratedDeckResponse["metaSnapshot"] | null;
  selectedDeckVersion: string | null;
  setFormatMode: (formatMode: YugiohFormatMode) => void;
  setStrengthTarget: (strengthTarget: YugiohStrengthTarget) => void;
  setTurnPreference: (turnPreference: YugiohTurnPreference) => void;
  setBuildIntent: (buildIntent: YugiohBuildIntent) => void;
  setConstraints: (constraints: YugiohConstraint[]) => void;
  clearTheme: () => void;
  setThemeQuery: (query: string) => void;
  setResolvedArchetype: (resolvedArchetype: string | null) => void;
  addThemeAnchor: (themeName: string) => void;
  toggleThemeAnchorActive: (themeName: string) => void;
  removeThemeAnchor: (themeName: string) => void;
  toggleBossCard: (card: YugiohCard) => void;
  toggleBossAnchorActive: (cardName: string) => void;
  removeBossCardByName: (cardName: string) => void;
  toggleConstraint: (constraint: YugiohConstraint) => void;
  setSelectedDeckVersion: (selectedDeckVersion: string | null) => void;
  setGeneratedDeck: (payload: YugiohGeneratedDeckResponse) => void;
  addCard: (card: YugiohCard, section: YugiohDeckSection) => void;
  decrementCard: (cardId: number, section: YugiohDeckSection) => void;
  removeCard: (cardId: number, section: YugiohDeckSection) => void;
  clearDeck: () => void;
  clearAll: () => void;
};

function emptyTheme(): YugiohThemeSelection {
  return {
    query: "",
    resolvedArchetype: null,
    resolvedBossCards: [],
    resolvedSupportCards: [],
    inactiveBossCards: [],
    inactiveSupportCards: [],
  };
}

function updateSection(
  entries: YugiohDeckEntry[],
  card: YugiohCard,
  section: YugiohDeckSection,
  theme: YugiohThemeSelection | null,
) {
  const existingEntry = entries.find((entry) => entry.card.id === card.id);

  if (existingEntry) {
    return entries.map((entry) =>
      entry.card.id === card.id ? { ...entry, quantity: Math.min(entry.quantity + 1, 3), locked: true } : entry,
    );
  }

  return [
    ...entries,
    {
      card,
      quantity: 1,
      section,
      roles: inferCardRoles(card, theme, section),
      locked: true,
      rationale:
        [theme?.resolvedArchetype, ...(theme?.resolvedSupportCards ?? [])].filter(Boolean).includes(card.archetype ?? "")
          ? `${card.name} reinforces one of your anchored themes.`
          : "Manual seed - you added this card yourself, so future builds can keep building around it.",
    },
  ].sort((left, right) => left.card.name.localeCompare(right.card.name));
}

function decrementSection(entries: YugiohDeckEntry[], cardId: number) {
  return entries
    .map((entry) => (entry.card.id === cardId ? { ...entry, quantity: entry.quantity - 1 } : entry))
    .filter((entry) => entry.quantity > 0);
}

function removeFromSection(entries: YugiohDeckEntry[], cardId: number) {
  return entries.filter((entry) => entry.card.id !== cardId);
}

function clearGeneratedInsights() {
  return {
    buildNotes: [],
    sourceAudit: [] as SourceAudit[],
    metaSnapshot: null,
  };
}

export const useYugiohStore = create<YugiohStoreState>()(
  persist(
    (set) => ({
      formatMode: "open-lab",
      strengthTarget: "strong",
      turnPreference: "going-first",
      buildIntent: "ceiling-first",
      theme: null,
      constraints: ["low-brick"],
      main: [],
      extra: [],
      side: [],
      buildNotes: [],
      sourceAudit: [],
      metaSnapshot: null,
      selectedDeckVersion: null,
      setFormatMode: (formatMode) => set({ formatMode, ...clearGeneratedInsights() }),
      setStrengthTarget: (strengthTarget) => set({ strengthTarget, ...clearGeneratedInsights() }),
      setTurnPreference: (turnPreference) =>
        set({
          turnPreference,
          buildIntent: turnPreference === "going-second" ? "blind-second" : "ceiling-first",
          constraints: turnPreference === "going-second" ? ["low-brick"] : ["low-brick"],
          ...clearGeneratedInsights(),
        }),
      setBuildIntent: (buildIntent) => set({ buildIntent, ...clearGeneratedInsights() }),
      setConstraints: (constraints) => set({ constraints, ...clearGeneratedInsights() }),
      clearTheme: () => set({ theme: null, selectedDeckVersion: null, ...clearGeneratedInsights() }),
      setThemeQuery: (query) =>
        set((state) => {
          const trimmed = query.trim();

          if (
            !trimmed &&
            !state.theme?.resolvedArchetype &&
            (state.theme?.resolvedBossCards.length ?? 0) === 0 &&
            (state.theme?.resolvedSupportCards.length ?? 0) === 0 &&
            (state.theme?.inactiveBossCards.length ?? 0) === 0 &&
            (state.theme?.inactiveSupportCards.length ?? 0) === 0
          ) {
            return { theme: null, selectedDeckVersion: null, ...clearGeneratedInsights() };
          }

          return {
            theme: {
              ...(state.theme ?? emptyTheme()),
              query,
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      setResolvedArchetype: (resolvedArchetype) =>
        set((state) => {
          if (
            !resolvedArchetype &&
            !state.theme?.query.trim() &&
            (state.theme?.resolvedBossCards.length ?? 0) === 0 &&
            (state.theme?.resolvedSupportCards.length ?? 0) === 0 &&
            (state.theme?.inactiveBossCards.length ?? 0) === 0 &&
            (state.theme?.inactiveSupportCards.length ?? 0) === 0
          ) {
            return { theme: null, selectedDeckVersion: null, ...clearGeneratedInsights() };
          }

          return {
            theme: {
              ...(state.theme ?? emptyTheme()),
              resolvedArchetype,
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      addThemeAnchor: (themeName) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const normalized = themeName.trim();

          if (!normalized) {
            return state;
          }

          const nextAnchors = [...new Set([...currentTheme.resolvedSupportCards, normalized])];

          return {
            theme: {
              ...currentTheme,
              query: normalized,
              resolvedArchetype: nextAnchors[0] ?? currentTheme.resolvedArchetype,
              resolvedSupportCards: nextAnchors,
              inactiveSupportCards: currentTheme.inactiveSupportCards.filter((name) => name !== normalized),
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      toggleThemeAnchorActive: (themeName) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const isActive = currentTheme.resolvedSupportCards.includes(themeName);
          const nextActive = isActive
            ? currentTheme.resolvedSupportCards.filter((name) => name !== themeName)
            : [...currentTheme.resolvedSupportCards, themeName];
          const nextInactive = isActive
            ? [...currentTheme.inactiveSupportCards, themeName]
            : currentTheme.inactiveSupportCards.filter((name) => name !== themeName);

          return {
            theme: {
              ...currentTheme,
              resolvedArchetype: nextActive[0] ?? null,
              resolvedSupportCards: nextActive,
              inactiveSupportCards: nextInactive,
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      removeThemeAnchor: (themeName) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const nextAnchors = currentTheme.resolvedSupportCards.filter((name) => name !== themeName);
          const nextInactive = currentTheme.inactiveSupportCards.filter((name) => name !== themeName);

          if (
            !currentTheme.query.trim() &&
            nextAnchors.length === 0 &&
            nextInactive.length === 0 &&
            currentTheme.resolvedBossCards.length === 0 &&
            currentTheme.inactiveBossCards.length === 0
          ) {
            return { theme: null, selectedDeckVersion: null, ...clearGeneratedInsights() };
          }

          return {
            theme: {
              ...currentTheme,
              resolvedArchetype: nextAnchors[0] ?? null,
              resolvedSupportCards: nextAnchors,
              inactiveSupportCards: nextInactive,
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      toggleBossCard: (card) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const alreadySelected = currentTheme.resolvedBossCards.includes(card.name);

          return {
            theme: {
              ...currentTheme,
              resolvedBossCards: alreadySelected
                ? currentTheme.resolvedBossCards.filter((name) => name !== card.name)
                : [...currentTheme.resolvedBossCards, card.name],
              inactiveBossCards: currentTheme.inactiveBossCards.filter((name) => name !== card.name),
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      toggleBossAnchorActive: (cardName) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const isActive = currentTheme.resolvedBossCards.includes(cardName);

          return {
            theme: {
              ...currentTheme,
              resolvedBossCards: isActive
                ? currentTheme.resolvedBossCards.filter((name) => name !== cardName)
                : [...currentTheme.resolvedBossCards, cardName],
              inactiveBossCards: isActive
                ? [...currentTheme.inactiveBossCards, cardName]
                : currentTheme.inactiveBossCards.filter((name) => name !== cardName),
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      removeBossCardByName: (cardName) =>
        set((state) => {
          const currentTheme = state.theme ?? emptyTheme();
          const nextActive = currentTheme.resolvedBossCards.filter((name) => name !== cardName);
          const nextInactive = currentTheme.inactiveBossCards.filter((name) => name !== cardName);

          if (
            !currentTheme.query.trim() &&
            currentTheme.resolvedSupportCards.length === 0 &&
            currentTheme.inactiveSupportCards.length === 0 &&
            nextActive.length === 0 &&
            nextInactive.length === 0
          ) {
            return { theme: null, selectedDeckVersion: null, ...clearGeneratedInsights() };
          }

          return {
            theme: {
              ...currentTheme,
              resolvedBossCards: nextActive,
              inactiveBossCards: nextInactive,
            },
            selectedDeckVersion: null,
            ...clearGeneratedInsights(),
          };
        }),
      toggleConstraint: (constraint) =>
        set((state) => ({
          constraints: state.constraints.includes(constraint)
            ? state.constraints.filter((item) => item !== constraint)
            : [...state.constraints, constraint],
          ...clearGeneratedInsights(),
        })),
      setSelectedDeckVersion: (selectedDeckVersion) => set({ selectedDeckVersion }),
      setGeneratedDeck: ({ main, extra, side, buildNotes, sourceAudit, metaSnapshot }) =>
        set({
          main,
          extra,
          side,
          buildNotes,
          sourceAudit,
          metaSnapshot,
          selectedDeckVersion: metaSnapshot.selectedDeckVersion,
        }),
      addCard: (card, section) =>
        set((state) => {
          if (section === "main") {
            return {
              main: updateSection(state.main, card, section, state.theme),
              ...clearGeneratedInsights(),
            };
          }

          if (section === "extra") {
            return {
              extra: updateSection(state.extra, card, section, state.theme),
              ...clearGeneratedInsights(),
            };
          }

          return {
            side: updateSection(state.side, card, section, state.theme),
            ...clearGeneratedInsights(),
          };
        }),
      decrementCard: (cardId, section) =>
        set((state) => {
          if (section === "main") {
            return { main: decrementSection(state.main, cardId), ...clearGeneratedInsights() };
          }

          if (section === "extra") {
            return { extra: decrementSection(state.extra, cardId), ...clearGeneratedInsights() };
          }

          return { side: decrementSection(state.side, cardId), ...clearGeneratedInsights() };
        }),
      removeCard: (cardId, section) =>
        set((state) => {
          if (section === "main") {
            return { main: removeFromSection(state.main, cardId), ...clearGeneratedInsights() };
          }

          if (section === "extra") {
            return { extra: removeFromSection(state.extra, cardId), ...clearGeneratedInsights() };
          }

          return { side: removeFromSection(state.side, cardId), ...clearGeneratedInsights() };
        }),
      clearDeck: () =>
        set({
          main: [],
          extra: [],
          side: [],
          buildNotes: [],
          sourceAudit: [],
          metaSnapshot: null,
          selectedDeckVersion: null,
        }),
      clearAll: () =>
        set({
          formatMode: "open-lab",
          strengthTarget: "strong",
          turnPreference: "going-first",
          buildIntent: "ceiling-first",
          theme: null,
          constraints: ["low-brick"],
          main: [],
          extra: [],
          side: [],
          buildNotes: [],
          sourceAudit: [],
          metaSnapshot: null,
          selectedDeckVersion: null,
        }),
    }),
    {
      name: "card-lab-yugioh-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        formatMode: state.formatMode,
        strengthTarget: state.strengthTarget,
        turnPreference: state.turnPreference,
        buildIntent: state.buildIntent,
        theme: state.theme,
        constraints: state.constraints,
        main: state.main,
        extra: state.extra,
        side: state.side,
        buildNotes: state.buildNotes,
        sourceAudit: state.sourceAudit,
        metaSnapshot: state.metaSnapshot,
        selectedDeckVersion: state.selectedDeckVersion,
      }),
    },
  ),
);
