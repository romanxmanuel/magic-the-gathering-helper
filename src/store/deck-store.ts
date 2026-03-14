"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  CommanderOption,
  DeckEntry,
  PowerPreset,
  SpellbookDeckEstimate,
  TagOption,
} from "@/lib/mtg/types";

type DeckStoreState = {
  selectedCommander: CommanderOption | null;
  focusTag: TagOption | null;
  powerPreset: PowerPreset;
  entries: DeckEntry[];
  buildNotes: string[];
  spellbookEstimate: SpellbookDeckEstimate | null;
  setCommander: (commander: CommanderOption | null) => void;
  setFocusTag: (tag: TagOption | null) => void;
  setPowerPreset: (powerPreset: PowerPreset) => void;
  setGeneratedDeck: (payload: {
    commander: CommanderOption;
    focusTag: TagOption | null;
    powerPreset: PowerPreset;
    entries: DeckEntry[];
    buildNotes: string[];
    spellbookEstimate: SpellbookDeckEstimate | null;
  }) => void;
  addCard: (entry: DeckEntry) => void;
  removeCard: (name: string) => void;
  clearDeck: () => void;
};

export const useDeckStore = create<DeckStoreState>()(
  persist(
    (set) => ({
      selectedCommander: null,
      focusTag: null,
      powerPreset: "focused",
      entries: [],
      buildNotes: [],
      spellbookEstimate: null,
      setCommander: (selectedCommander) =>
        set({
          selectedCommander,
          focusTag: null,
          entries: [],
          buildNotes: [],
          spellbookEstimate: null,
        }),
      setFocusTag: (focusTag) => set({ focusTag }),
      setPowerPreset: (powerPreset) => set({ powerPreset }),
      setGeneratedDeck: ({
        commander,
        focusTag,
        powerPreset,
        entries,
        buildNotes,
        spellbookEstimate,
      }) =>
        set({
          selectedCommander: commander,
          focusTag,
          powerPreset,
          entries,
          buildNotes,
          spellbookEstimate,
        }),
      addCard: (entry) =>
        set((state) => {
          const exists = state.entries.some((currentEntry) => currentEntry.name === entry.name);

          if (exists && !entry.isBasicLand) {
            return state;
          }

          return {
            entries: [...state.entries, entry],
            spellbookEstimate: null,
          };
        }),
      removeCard: (name) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.name !== name),
          spellbookEstimate: null,
        })),
      clearDeck: () =>
        set({
          entries: [],
          buildNotes: [],
          spellbookEstimate: null,
        }),
    }),
    {
      name: "magic-the-gathering-helper",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedCommander: state.selectedCommander,
        focusTag: state.focusTag,
        powerPreset: state.powerPreset,
        entries: state.entries,
        buildNotes: state.buildNotes,
        spellbookEstimate: state.spellbookEstimate,
      }),
    },
  ),
);
