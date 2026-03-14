"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { inferCardRoles } from "@/lib/games/yugioh/builder-shell";
import type {
  YugiohBuildIntent,
  YugiohCard,
  YugiohConstraint,
  YugiohDeckEntry,
  YugiohDeckSection,
  YugiohFormatMode,
  YugiohStrengthTarget,
  YugiohThemeSelection,
} from "@/lib/games/yugioh/types";

type YugiohStoreState = {
  formatMode: YugiohFormatMode;
  strengthTarget: YugiohStrengthTarget;
  buildIntent: YugiohBuildIntent;
  theme: YugiohThemeSelection | null;
  constraints: YugiohConstraint[];
  main: YugiohDeckEntry[];
  extra: YugiohDeckEntry[];
  side: YugiohDeckEntry[];
  setFormatMode: (formatMode: YugiohFormatMode) => void;
  setStrengthTarget: (strengthTarget: YugiohStrengthTarget) => void;
  setBuildIntent: (buildIntent: YugiohBuildIntent) => void;
  clearTheme: () => void;
  setThemeQuery: (query: string) => void;
  setResolvedArchetype: (resolvedArchetype: string | null) => void;
  toggleBossCard: (card: YugiohCard) => void;
  toggleConstraint: (constraint: YugiohConstraint) => void;
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
      entry.card.id === card.id ? { ...entry, quantity: Math.min(entry.quantity + 1, 3) } : entry,
    );
  }

  return [
    ...entries,
    {
      card,
      quantity: 1,
      section,
      roles: inferCardRoles(card, theme, section),
      rationale:
        theme?.resolvedArchetype && card.archetype === theme.resolvedArchetype
          ? `${card.name} reinforces the ${theme.resolvedArchetype} shell.`
          : undefined,
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

export const useYugiohStore = create<YugiohStoreState>()(
  persist(
    (set) => ({
      formatMode: "open-lab",
      strengthTarget: "strong",
      buildIntent: "anti-meta",
      theme: null,
      constraints: ["low-brick"],
      main: [],
      extra: [],
      side: [],
      setFormatMode: (formatMode) => set({ formatMode }),
      setStrengthTarget: (strengthTarget) => set({ strengthTarget }),
      setBuildIntent: (buildIntent) => set({ buildIntent }),
      clearTheme: () => set({ theme: null }),
      setThemeQuery: (query) =>
        set((state) => {
          const trimmed = query.trim();

          if (!trimmed && !state.theme?.resolvedArchetype && (state.theme?.resolvedBossCards.length ?? 0) === 0) {
            return { theme: null };
          }

          return {
            theme: {
              ...(state.theme ?? emptyTheme()),
              query,
            },
          };
        }),
      setResolvedArchetype: (resolvedArchetype) =>
        set((state) => {
          if (!resolvedArchetype && !state.theme?.query.trim() && (state.theme?.resolvedBossCards.length ?? 0) === 0) {
            return { theme: null };
          }

          return {
            theme: {
              ...(state.theme ?? emptyTheme()),
              resolvedArchetype,
            },
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
                : [...currentTheme.resolvedBossCards, card.name].slice(-3),
            },
          };
        }),
      toggleConstraint: (constraint) =>
        set((state) => ({
          constraints: state.constraints.includes(constraint)
            ? state.constraints.filter((item) => item !== constraint)
            : [...state.constraints, constraint],
        })),
      addCard: (card, section) =>
        set((state) => {
          if (section === "main") {
            return {
              main: updateSection(state.main, card, section, state.theme),
            };
          }

          if (section === "extra") {
            return {
              extra: updateSection(state.extra, card, section, state.theme),
            };
          }

          return {
            side: updateSection(state.side, card, section, state.theme),
          };
        }),
      decrementCard: (cardId, section) =>
        set((state) => {
          if (section === "main") {
            return { main: decrementSection(state.main, cardId) };
          }

          if (section === "extra") {
            return { extra: decrementSection(state.extra, cardId) };
          }

          return { side: decrementSection(state.side, cardId) };
        }),
      removeCard: (cardId, section) =>
        set((state) => {
          if (section === "main") {
            return { main: removeFromSection(state.main, cardId) };
          }

          if (section === "extra") {
            return { extra: removeFromSection(state.extra, cardId) };
          }

          return { side: removeFromSection(state.side, cardId) };
        }),
      clearDeck: () =>
        set({
          main: [],
          extra: [],
          side: [],
        }),
      clearAll: () =>
        set({
          formatMode: "open-lab",
          strengthTarget: "strong",
          buildIntent: "anti-meta",
          theme: null,
          constraints: ["low-brick"],
          main: [],
          extra: [],
          side: [],
        }),
    }),
    {
      name: "card-lab-yugioh-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        formatMode: state.formatMode,
        strengthTarget: state.strengthTarget,
        buildIntent: state.buildIntent,
        theme: state.theme,
        constraints: state.constraints,
        main: state.main,
        extra: state.extra,
        side: state.side,
      }),
    },
  ),
);
