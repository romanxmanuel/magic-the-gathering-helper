"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import { colorIdentityKey, formatColorIdentity, ORDERED_COLORS } from "@/lib/mtg/colors";
import { validateDeck } from "@/lib/mtg/deck-builder";
import { deriveCommanderMechanics } from "@/lib/mtg/mechanics";
import type {
  CardSummary,
  CommanderMeta,
  CommanderOption,
  DeckEntry,
  ManaColor,
  PowerPreset,
  SpellbookDeckEstimate,
  TagOption,
} from "@/lib/mtg/types";
import { useMtgStore } from "@/store/mtg-store";

type DeckBuilderAppProps = {
  initialBannedList: string[];
};

type HoverPreviewCard = {
  name: string;
  typeLine: string;
  image: string;
};

const POWER_PRESETS: Array<{
  value: PowerPreset;
  title: string;
  description: string;
}> = [
  {
    value: "battlecruiser",
    title: "Battlecruiser",
    description: "Slower curve, splashier haymakers, less fast mana.",
  },
  {
    value: "focused",
    title: "Focused",
    description: "Balanced pod-ready shell with interaction and clean lines.",
  },
  {
    value: "high",
    title: "High Power",
    description: "Lean curve, stronger staples, faster closing speed.",
  },
  {
    value: "cooked",
    title: "Cooked",
    description: "Pushes efficient cards and tighter interaction density.",
  },
];

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

function roleLabel(role: DeckEntry["role"]) {
  switch (role) {
    case "draw":
      return "Card Draw";
    case "wipe":
      return "Board Wipes";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function DeckBuilderApp({ initialBannedList }: DeckBuilderAppProps) {
  const {
    selectedCommander,
    focusTag,
    powerPreset,
    entries,
    buildNotes,
    spellbookEstimate,
    setCommander,
    setFocusTag,
    setPowerPreset,
    setGeneratedDeck,
    addCard,
    removeCard,
    clearDeck,
  } = useMtgStore();

  const [selectedColors, setSelectedColors] = useState<ManaColor[]>(selectedCommander?.colorIdentity ?? []);
  const [commanderQuery, setCommanderQuery] = useState(selectedCommander?.name ?? "");
  const [cardQuery, setCardQuery] = useState("");
  const deferredCommanderQuery = useDeferredValue(commanderQuery);
  const deferredCardQuery = useDeferredValue(cardQuery);
  const [commanderResults, setCommanderResults] = useState<CommanderOption[]>([]);
  const [colorSuggestions, setColorSuggestions] = useState<CommanderOption[]>([]);
  const [cardResults, setCardResults] = useState<CardSummary[]>([]);
  const [commanderMeta, setCommanderMeta] = useState<CommanderMeta | null>(null);
  const [hoverPreviewCard, setHoverPreviewCard] = useState<HoverPreviewCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedCommander) {
      setHoverPreviewCard(null);
      return;
    }

    setSelectedColors(selectedCommander.colorIdentity);
    setCommanderQuery(selectedCommander.name);
    setHoverPreviewCard(null);
  }, [selectedCommander]);

  useEffect(() => {
    if (deferredCommanderQuery.trim().length < 2) {
      setCommanderResults([]);
      return;
    }

    let isActive = true;

    fetchJson<CommanderOption[]>(`/api/commanders?q=${encodeURIComponent(deferredCommanderQuery.trim())}`)
      .then((results) => {
        if (isActive) {
          setCommanderResults(results);
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deferredCommanderQuery]);

  useEffect(() => {
    if (selectedColors.length === 0 || selectedCommander) {
      setColorSuggestions([]);
      return;
    }

    let isActive = true;
    const colorKey = selectedColors.join(",");

    fetchJson<CommanderOption[]>(`/api/color-commanders?colors=${encodeURIComponent(colorKey)}`)
      .then((results) => {
        if (isActive) {
          setColorSuggestions(results);
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedColors, selectedCommander]);

  useEffect(() => {
    if (!selectedCommander) {
      setCommanderMeta(null);
      return;
    }

    let isActive = true;
    const params = new URLSearchParams({
      slug: selectedCommander.slug,
      name: selectedCommander.name,
    });

    if (focusTag) {
      params.set("tag", focusTag.slug);
    }

    fetchJson<CommanderMeta>(`/api/commander-meta?${params.toString()}`)
      .then((meta) => {
        if (isActive) {
          setCommanderMeta(meta);
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedCommander, focusTag]);

  useEffect(() => {
    if (deferredCardQuery.trim().length < 2 || !selectedCommander) {
      setCardResults([]);
      return;
    }

    let isActive = true;
    const params = new URLSearchParams({
      q: deferredCardQuery.trim(),
      colors: selectedCommander.colorIdentity.join(","),
    });

    fetchJson<CardSummary[]>(`/api/cards?${params.toString()}`)
      .then((results) => {
        if (isActive) {
          setCardResults(results);
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deferredCardQuery, selectedCommander]);

  const validation = useMemo(() => {
    if (!selectedCommander) {
      return null;
    }

    return validateDeck(entries, selectedCommander, initialBannedList);
  }, [entries, initialBannedList, selectedCommander]);
  const mechanicsInsight = useMemo(
    () =>
      deriveCommanderMechanics(
        selectedCommander,
        commanderMeta?.tags ?? [],
        commanderMeta?.spellbook ?? null,
      ),
    [commanderMeta, selectedCommander],
  );

  const groupedEntries = useMemo(() => {
    return entries.reduce<Record<string, DeckEntry[]>>((groups, entry) => {
      groups[entry.role] ??= [];
      groups[entry.role].push(entry);
      groups[entry.role].sort((left, right) => left.name.localeCompare(right.name));
      return groups;
    }, {});
  }, [entries]);

  const deckCount = entries.length + (selectedCommander ? 1 : 0);
  const canOpenPrintSheet = entries.length > 0;
  const colorIdentityDisplay = selectedCommander
    ? formatColorIdentity(selectedCommander.colorIdentity)
    : formatColorIdentity(selectedColors);
  const activePreviewCard = hoverPreviewCard;

  function setPreviewCard(card: HoverPreviewCard) {
    setHoverPreviewCard(card);
  }

  function toggleColor(color: ManaColor) {
    setErrorMessage(null);
    setCommander(null);
    setSelectedColors((currentColors) =>
      currentColors.includes(color)
        ? currentColors.filter((currentColor) => currentColor !== color)
        : ORDERED_COLORS.filter((candidate) => currentColors.includes(candidate) || candidate === color),
    );
  }

  function selectCommander(commander: CommanderOption) {
    setErrorMessage(null);
    setCommander(commander);
    setCommanderResults([]);
    setSelectedColors(commander.colorIdentity);
  }

  function hydrateColorSuggestion(suggestion: CommanderOption) {
    startTransition(() => {
      void (async () => {
        try {
          const matches = await fetchJson<CommanderOption[]>(
            `/api/commanders?q=${encodeURIComponent(suggestion.name)}`,
          );
          const exact = matches.find((candidate) => candidate.name === suggestion.name) ?? matches[0];

          if (!exact) {
            throw new Error(`Could not resolve ${suggestion.name} to a card record.`);
          }

          selectCommander(exact);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to select this commander.");
        }
      })();
    });
  }

  function generateDeck() {
    if (!selectedCommander) {
      setErrorMessage("Pick a commander first so the builder can stay inside Commander rules.");
      return;
    }

    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          const generatedDeck = await fetchJson<{
            commander: CommanderOption;
            focusTag: TagOption | null;
            powerPreset: PowerPreset;
            entries: DeckEntry[];
            buildNotes: string[];
            spellbookEstimate: SpellbookDeckEstimate | null;
          }>("/api/deck-generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              commander: selectedCommander,
              focusTag,
              powerPreset,
            }),
          });

          setGeneratedDeck(generatedDeck);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to generate a deck shell.");
        }
      })();
    });
  }

  function handleAddCard(card: CardSummary) {
    addCard({
      ...card,
      quantity: 1,
      role: "synergy",
    });
    setCardQuery("");
    setCardResults([]);
  }

  return (
    <main className="page-shell page-shell-mtg">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Commander Deck Lab</p>
          <h1>Build legal EDH decks, tune them fast, and print true-size proxy sheets.</h1>
          <p className="hero-description">
            This workflow stays Commander-first: Scryfall handles cards and images, EDHREC shapes the meta shell,
            Commander Spellbook adds power context, and the official Wizards banned list keeps the rules honest.
          </p>
          <div className="status-row">
            <span className="status-pill">Commander only</span>
            <span className="status-pill">Meta-backed</span>
            <span className="status-pill">Proxy-print ready</span>
          </div>
          {selectedCommander ? (
            <div className="tag-row">
              <span className="tag-pill tag-pill-active">{selectedCommander.name}</span>
              <span className="tag-pill">{colorIdentityDisplay}</span>
              <span className="tag-pill">{deckCount}/100 cards</span>
            </div>
          ) : null}
        </div>
        <div className="hero-card">
          {selectedCommander?.imageUris.normal ? (
            <Image
              src={selectedCommander.imageUris.normal}
              alt={selectedCommander.name}
              width={320}
              height={446}
              className="hero-card-image"
              priority
            />
          ) : (
            <div className="hero-card-placeholder hero-guide-card">
              <strong>Start with a commander</strong>
              <p className="empty-copy">
                Pick colors or search a commander first. Once that anchor is locked, the builder can shape the shell,
                validate legality, and open the print workflow.
              </p>
              <ul className="hero-guide-list">
                <li>Choose colors or search a commander</li>
                <li>Pick a focus tag and power lane</li>
                <li>Generate, tweak, and print proxies</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-grid mtg-dashboard-grid">
        <div className="panel-stack mtg-sidebar-stack">
          <div className="panel control-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Step 1</p>
                <h2>Choose your lane</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setCommander(null);
                  setSelectedColors([]);
                  clearDeck();
                  setCommanderQuery("");
                }}
              >
                Reset
              </button>
            </div>

            <label className="field-label">Color identity</label>
            <div className="mana-chip-row">
              {ORDERED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`mana-chip mana-${color.toLowerCase()} ${
                    selectedColors.includes(color) ? "mana-chip-active" : ""
                  }`}
                  onClick={() => toggleColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="commander-search">
              Search for a commander
            </label>
            <input
              id="commander-search"
              className="app-input"
              placeholder="Atraxa, Yuriko, Y'shtola..."
              value={commanderQuery}
              onChange={(event) => setCommanderQuery(event.target.value)}
            />

            {commanderResults.length > 0 ? (
              <div className="result-list">
                {commanderResults.map((commander) => (
                  <button
                    key={commander.id}
                    type="button"
                    className="result-item"
                    onClick={() => selectCommander(commander)}
                  >
                    {commander.imageUris.artCrop ? (
                      <Image
                        src={commander.imageUris.artCrop}
                        alt=""
                        width={64}
                        height={64}
                        className="result-thumb"
                      />
                    ) : (
                      <div className="result-thumb result-thumb-placeholder" />
                    )}
                    <span>
                      <strong>{commander.name}</strong>
                      <small>{formatColorIdentity(commander.colorIdentity)}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {!selectedCommander && colorSuggestions.length > 0 ? (
              <>
                <label className="field-label">Top commanders for {colorIdentityDisplay}</label>
                <div className="suggestion-grid">
                  {colorSuggestions.slice(0, 6).map((suggestion) => (
                    <button
                      key={suggestion.slug}
                      type="button"
                      className="suggestion-card"
                      onClick={() => hydrateColorSuggestion(suggestion)}
                    >
                      <span>{suggestion.name}</span>
                      <small>{suggestion.inclusion?.toLocaleString()} decks</small>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {selectedCommander ? (
              <>
                <label className="field-label">Focus tag</label>
                <div className="tag-row">
                  <button
                    type="button"
                    className={`tag-pill ${focusTag === null ? "tag-pill-active" : ""}`}
                    onClick={() => setFocusTag(null)}
                  >
                    Best stuff
                  </button>
                  {(commanderMeta?.tags ?? []).slice(0, 10).map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      className={`tag-pill ${focusTag?.slug === tag.slug ? "tag-pill-active" : ""}`}
                      onClick={() => setFocusTag(tag)}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <label className="field-label">Power preset</label>
            <div className="power-grid">
              {POWER_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`power-card ${powerPreset === preset.value ? "power-card-active" : ""}`}
                  onClick={() => setPowerPreset(preset.value)}
                >
                  <strong>{preset.title}</strong>
                  <small>{preset.description}</small>
                </button>
              ))}
            </div>

            <button type="button" className="primary-button" onClick={generateDeck} disabled={isPending}>
              {isPending ? "Building deck shell..." : "Build Commander Deck"}
            </button>

            {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
          </div>

          <div className="panel meta-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Step 2</p>
                <h2>Meta snapshot</h2>
              </div>
            </div>

          {selectedCommander ? (
            <>
              <div className="meta-heading">
                <div>
                  <h3>{selectedCommander.name}</h3>
                  <p>{selectedCommander.typeLine}</p>
                  <small>{colorIdentityDisplay}</small>
                </div>
                <div className="meta-badge">{colorIdentityKey(selectedCommander.colorIdentity)}</div>
              </div>
              <p className="meta-description">
                {commanderMeta?.description ||
                  "Fetching commander context. The app will use EDHREC data for synergy and combo suggestions."}
              </p>

              {commanderMeta?.comboIdeas?.length ? (
                <div className="meta-block">
                  <h4>Combo hints</h4>
                  <ul className="meta-list">
                    {commanderMeta.comboIdeas.map((combo) => (
                      <li key={combo}>{combo}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {mechanicsInsight ? (
                <div className="meta-block">
                  <h4>Mechanics primer</h4>
                  <p className="meta-description">{mechanicsInsight.primer}</p>
                  {mechanicsInsight.signatureMechanics.length > 0 ? (
                    <div className="tag-row">
                      {mechanicsInsight.signatureMechanics.map((mechanic) => (
                        <span key={mechanic} className="tag-pill">
                          {mechanic}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {mechanicsInsight.playPatterns.length > 0 ? (
                    <ul className="meta-list">
                      {mechanicsInsight.playPatterns.map((pattern) => (
                        <li key={pattern}>{pattern}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {commanderMeta?.spellbook ? (
                <div className="meta-block">
                  <h4>Spellbook profile</h4>
                  <div className="distribution-grid">
                    <div className="distribution-card">
                      <span>Known variants</span>
                      <strong>{commanderMeta.spellbook.variantCount}</strong>
                    </div>
                    <div className="distribution-card">
                      <span>Pressure flags</span>
                      <strong>
                        {[
                          commanderMeta.spellbook.gameChanger ? "GC" : "",
                          commanderMeta.spellbook.tutor ? "Tutor" : "",
                          commanderMeta.spellbook.extraTurn ? "Turns" : "",
                          commanderMeta.spellbook.massLandDenial ? "MLD" : "",
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Clean"}
                      </strong>
                    </div>
                  </div>
                  {commanderMeta.spellbook.features.length > 0 ? (
                    <ul className="meta-list">
                      {commanderMeta.spellbook.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {buildNotes.length > 0 ? (
                <div className="meta-block">
                  <h4>Builder notes</h4>
                  <ul className="meta-list">
                    {buildNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {commanderMeta?.averageTypeDistribution?.length ? (
                <div className="meta-block">
                  <h4>Average deck shape</h4>
                  <div className="distribution-grid">
                    {commanderMeta.averageTypeDistribution.map((slice) => (
                      <div key={slice.label} className="distribution-card">
                        <span>{slice.label}</span>
                        <strong>{slice.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
            ) : (
              <div className="empty-state-card">
                <strong>Commander context appears here</strong>
                <p className="empty-copy">
                  Once you lock a commander, this panel fills with synergy tags, combo hints, mechanics guidance, and
                  average shell shape so the build starts from something grounded.
                </p>
                <ul className="empty-state-list">
                  <li>EDHREC tags and shape data</li>
                  <li>Commander Spellbook combo pressure</li>
                  <li>Mechanics primer and play pattern hints</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="panel deck-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Step 3</p>
              <h2>Deck shell</h2>
            </div>
            <div className="tag-row">
              {canOpenPrintSheet ? (
                <Link href="/mtg/print" className="ghost-button">
                  Open print sheet
                </Link>
              ) : (
                <span className="ghost-button button-disabled">Open print sheet</span>
              )}
              <button type="button" className="ghost-button" onClick={() => clearDeck()}>
                Clear deck
              </button>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Total cards</span>
              <strong>{deckCount}/100</strong>
            </div>
            <div className="summary-card">
              <span>Banned list</span>
              <strong>{validation?.bannedCards.length ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span>Off-color</span>
              <strong>{validation?.offColorCards.length ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span>Spellbook bracket</span>
              <strong>{spellbookEstimate?.bracketLabel ?? "--"}</strong>
            </div>
            <div className="summary-card">
              <span>Status</span>
              <strong>{validation?.isComplete ? "Ready" : "Tuning"}</strong>
            </div>
          </div>

          <label className="field-label" htmlFor="card-search">
            Add or tweak cards
          </label>
          <input
            id="card-search"
            className="app-input"
            placeholder={selectedCommander ? "Search commander-legal cards..." : "Pick a commander first"}
            value={cardQuery}
            onChange={(event) => setCardQuery(event.target.value)}
            disabled={!selectedCommander}
          />

          {cardResults.length > 0 ? (
            <div className="result-list compact">
              {cardResults.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="result-item compact"
                  onClick={() => handleAddCard(card)}
                >
                  {card.imageUris.artCrop ? (
                    <Image src={card.imageUris.artCrop} alt="" width={56} height={56} className="result-thumb" />
                  ) : (
                    <div className="result-thumb result-thumb-placeholder" />
                  )}
                  <span>
                    <strong>{card.name}</strong>
                    <small>{card.typeLine}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {validation?.warnings.length ? (
            <div className="warning-box">
              {validation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {!spellbookEstimate && entries.length > 0 ? (
            <p className="empty-copy">
              Rebuild the shell after manual tweaks if you want a fresh Spellbook bracket and combo-pressure read.
            </p>
          ) : null}

          {spellbookEstimate ? (
            <div className="meta-block">
              <h4>Combo pressure check</h4>
              <p className="meta-description">
                Spellbook tags this list as <strong>{spellbookEstimate.bracketLabel}</strong> based on combo density,
                Game Changers, and sharp patterns in the current shell.
              </p>
              <div className="distribution-grid">
                <div className="distribution-card">
                  <span>Compact combos</span>
                  <strong>{spellbookEstimate.twoCardComboCount}</strong>
                </div>
                <div className="distribution-card">
                  <span>Lock lines</span>
                  <strong>{spellbookEstimate.lockComboCount}</strong>
                </div>
                <div className="distribution-card">
                  <span>Extra-turn lines</span>
                  <strong>{spellbookEstimate.extraTurnComboCount}</strong>
                </div>
                <div className="distribution-card">
                  <span>Game changers</span>
                  <strong>{spellbookEstimate.gameChangerCards.length}</strong>
                </div>
              </div>
              {spellbookEstimate.comboHighlights.length > 0 ? (
                <ul className="meta-list">
                  {spellbookEstimate.comboHighlights.map((combo) => (
                    <li key={combo.id}>
                      <strong>{combo.uses.join(" + ")}</strong>
                      {combo.speed ? ` (speed ${combo.speed})` : ""}
                      {combo.prerequisites ? ` - ${combo.prerequisites}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {selectedCommander ? (
            <div className="deck-list-shell">
              {entries.length === 0 ? (
                <div className="empty-state-card">
                  <strong>Ready for the first shell</strong>
                  <p className="empty-copy">
                    Your commander is locked. Pick a focus tag if you want a specific lane, then build the initial 99
                    and start tuning from there.
                  </p>
                  <div className="status-row">
                    <span className="status-pill">Commander chosen</span>
                    <span className="status-pill">Power lane ready</span>
                    <span className="status-pill">Print opens after build</span>
                  </div>
                </div>
              ) : null}

              <div className="deck-section-list">
                <div className="deck-group">
                  <div className="deck-group-header">
                    <h3>Commander</h3>
                    <span>1</span>
                  </div>
                  <div className="deck-row commander-row">
                    <div className="deck-row-copy">
                      <div
                        className="deck-row-thumb-trigger"
                        onMouseEnter={() =>
                          setPreviewCard({
                            name: selectedCommander.name,
                            typeLine: selectedCommander.typeLine,
                            image: selectedCommander.imageUris.normal || selectedCommander.imageUris.png,
                          })
                        }
                        onMouseLeave={() => setHoverPreviewCard(null)}
                      >
                        {selectedCommander.imageUris.normal || selectedCommander.imageUris.png ? (
                          <Image
                            src={selectedCommander.imageUris.normal || selectedCommander.imageUris.png}
                            alt={selectedCommander.name}
                            width={80}
                            height={112}
                            className="deck-row-thumb"
                            unoptimized
                          />
                        ) : (
                          <div className="deck-row-thumb deck-row-thumb-placeholder" />
                        )}
                      </div>
                      <div>
                        <span>{selectedCommander.name}</span>
                        <small>{selectedCommander.typeLine}</small>
                      </div>
                    </div>
                  </div>
                </div>

                {Object.entries(groupedEntries).map(([role, roleEntries]) => (
                  <div key={role} className="deck-group">
                    <div className="deck-group-header">
                      <h3>{roleLabel(role as DeckEntry["role"])}</h3>
                      <span>{roleEntries.length}</span>
                    </div>
                    <div className="deck-rows">
                      {roleEntries.map((entry) => (
                        <div key={`${entry.name}-${entry.id}`} className="deck-row">
                          <div className="deck-row-copy">
                            <div
                              className="deck-row-thumb-trigger"
                              onMouseEnter={() =>
                                setPreviewCard({
                                  name: entry.name,
                                  typeLine: entry.typeLine,
                                  image: entry.imageUris.normal || entry.imageUris.png,
                                })
                              }
                              onMouseLeave={() => setHoverPreviewCard(null)}
                            >
                              {entry.imageUris.normal || entry.imageUris.png ? (
                                <Image
                                  src={entry.imageUris.normal || entry.imageUris.png}
                                  alt={entry.name}
                                  width={80}
                                  height={112}
                                  className="deck-row-thumb"
                                  unoptimized
                                />
                              ) : (
                                <div className="deck-row-thumb deck-row-thumb-placeholder" />
                              )}
                            </div>
                            <div>
                              <span>{entry.name}</span>
                              <small>{entry.typeLine}</small>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="danger-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeCard(entry.name);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state-card">
              <strong>The deck shell appears here</strong>
              <p className="empty-copy">
                Choose a commander first, then build or tweak the shell. Once cards are in place, this panel becomes
                your live list plus the gateway into print-ready proxies.
              </p>
            </div>
          )}
        </div>
      </section>

      {activePreviewCard?.image ? (
        <div className="deck-preview-overlay" aria-hidden="true">
          <div className="deck-preview-scrim" />
          <div className="deck-preview-frame">
            <Image
              src={activePreviewCard.image}
              alt={activePreviewCard.name}
              width={488}
              height={680}
              className="deck-preview-image"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
