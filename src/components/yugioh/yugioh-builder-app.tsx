"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  createStructuralReadout,
  createRoleBucketSummary,
  computeOpeningHandOdds,
  deriveQuickRebuildOptions,
  inferDeckSection,
  YUGIOH_STRENGTH_OPTIONS,
} from "@/lib/games/yugioh/builder-shell";
import type { SourceAudit } from "@/lib/games/shared/types";
import type {
  YugiohArchetype,
  YugiohArchetypeSearchResponse,
  YugiohCard,
  YugiohCardRole,
  YugiohGeneratedDeckResponse,
  YugiohCardSearchResponse,
  YugiohDeckEntry,
  YugiohDeckSection,
  YugiohTurnPreference,
} from "@/lib/games/yugioh/types";
import { useYugiohStore } from "@/store/yugioh-store";

type SearchScope = "theme" | "all";

type HoverPreviewCard = {
  name: string;
  typeLine: string;
  image: string;
  desc: string;
};

const STARTER_THEME_SEEDS = ["Yubel", "Sky Striker", "Tenpai", "Branded", "Blue-Eyes"];

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

function roleLabel(role: YugiohCardRole) {
  switch (role) {
    case "engine-core":
      return "Engine Core";
    case "engine-support":
      return "Engine Support";
    case "hand-trap":
      return "Hand Trap";
    case "board-breaker":
      return "Board Breaker";
    case "grind-tool":
      return "Grind Tool";
    case "brick-risk":
      return "Brick Risk";
    case "side-tech":
      return "Side Tech";
    case "extra-toolbox":
      return "Extra Toolbox";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function sectionLabel(section: YugiohDeckSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function countCopies(entries: YugiohDeckEntry[], cardId: number) {
  return entries.find((entry) => entry.card.id === cardId)?.quantity ?? 0;
}

function sumEntries(entries: YugiohDeckEntry[]) {
  return entries.reduce((count, entry) => count + entry.quantity, 0);
}

function SourceAuditBlock({ sourceAudit }: { sourceAudit: SourceAudit[] }) {
  if (sourceAudit.length === 0) {
    return null;
  }

  return (
    <div className="yugioh-source-block">
      {sourceAudit.map((entry, index) => (
        <div key={`${entry.sourceName}-${entry.sourceUrl}-${index}`} className="yugioh-source-row">
          <strong>{entry.sourceName}</strong>
          <small>{entry.notes}</small>
        </div>
      ))}
    </div>
  );
}

function DeckSectionPanel({
  title,
  section,
  entries,
  onAddCopy,
  onRemoveCopy,
  onRemoveCard,
  setHoverPreviewCard,
}: {
  title: string;
  section: YugiohDeckSection;
  entries: YugiohDeckEntry[];
  onAddCopy: (card: YugiohCard, section: YugiohDeckSection) => void;
  onRemoveCopy: (cardId: number, section: YugiohDeckSection) => void;
  onRemoveCard: (cardId: number, section: YugiohDeckSection) => void;
  setHoverPreviewCard: (card: HoverPreviewCard | null) => void;
}) {
  return (
    <section className="ygo-list-panel ygo-builder-section">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{title}</p>
          <h3>{sumEntries(entries)} cards</h3>
        </div>
        <span className="status-pill">{sectionLabel(section)}</span>
      </div>

      {entries.length > 0 ? (
        <div className="ygo-visual-deck-grid">
          {entries.map((entry) => (
            <div
              key={`${section}-${entry.card.id}`}
              className="ygo-visual-deck-item"
              onMouseEnter={() => setHoverPreviewCard({
                name: entry.card.name,
                typeLine: entry.card.typeLine,
                image: entry.card.images.full || entry.card.images.small || "",
                desc: entry.card.desc,
              })}
              onMouseLeave={() => setHoverPreviewCard(null)}
              title={entry.rationale ?? undefined}
            >
              <div className="ygo-visual-deck-image-wrapper">
                {entry.card.images.small ? (
                  <img
                    src={entry.card.images.small}
                    alt={entry.card.name}
                    className="ygo-visual-deck-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="ygo-visual-deck-image placeholder">Missing Card Image</div>
                )}
                
                {entry.quantity > 1 ? (
                  <div className="ygo-visual-deck-quantity">
                    x{entry.quantity}
                  </div>
                ) : null}

                {/* Hover Action Overlay */}
                <div className="ygo-visual-deck-actions">
                  <button type="button" onClick={() => onAddCopy(entry.card, section)} disabled={entry.quantity >= 3} aria-label="Add Copy">+</button>
                  <button type="button" onClick={() => onRemoveCopy(entry.card.id, section)} aria-label="Remove Copy">-</button>
                  <button type="button" onClick={() => onRemoveCard(entry.card.id, section)} aria-label="Remove All" className="danger-link" style={{fontSize: '10px'}}>Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-copy">Empty</p>
      )}
    </section>
  );
}

export function YugiohBuilderApp() {
  const {
    strengthTarget,
    turnPreference,
    buildIntent,
    theme,
    constraints,
    main,
    extra,
    side,
    buildNotes,
    sourceAudit,
    metaSnapshot,
    setStrengthTarget,
    setTurnPreference,
    setBuildIntent,
    setConstraints,
    setThemeQuery,
    setResolvedArchetype,
    toggleBossCard,
    setGeneratedDeck,
    addCard,
    decrementCard,
    removeCard,
    clearDeck,
  } = useYugiohStore();

  const [archetypeQuery, setArchetypeQuery] = useState(theme?.resolvedArchetype ?? theme?.query ?? "");
  const [cardQuery, setCardQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>(theme?.resolvedArchetype ? "theme" : "all");
  const deferredArchetypeQuery = useDeferredValue(archetypeQuery);
  const deferredCardQuery = useDeferredValue(cardQuery);
  const [archetypes, setArchetypes] = useState<YugiohArchetype[]>([]);
  const [cards, setCards] = useState<YugiohCard[]>([]);
  const [archetypeAudit, setArchetypeAudit] = useState<SourceAudit[]>([]);
  const [cardAudit, setCardAudit] = useState<SourceAudit[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoverPreviewCard, setHoverPreviewCard] = useState<HoverPreviewCard | null>(null);
  
  const showArchetypeResults = deferredArchetypeQuery.trim().length >= 2;
  const showCardResults = deferredCardQuery.trim().length >= 2;
  const themeScopedArchetype = searchScope === "theme" ? theme?.resolvedArchetype ?? null : null;

  useEffect(() => {
    if (!showArchetypeResults) {
      return;
    }

    let isActive = true;

    fetchJson<YugiohArchetypeSearchResponse>(`/api/yugioh/archetypes?q=${encodeURIComponent(deferredArchetypeQuery)}`)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setArchetypes(payload.archetypes);
        setArchetypeAudit(payload.sourceAudit);
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deferredArchetypeQuery, showArchetypeResults]);

  useEffect(() => {
    if (!showCardResults) {
      return;
    }

    let isActive = true;
    const params = new URLSearchParams({
      q: deferredCardQuery.trim(),
    });

    if (themeScopedArchetype) {
      params.set("archetype", themeScopedArchetype);
    }

    fetchJson<YugiohCardSearchResponse>(`/api/yugioh/cards?${params.toString()}`)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setCards(payload.cards);
        setCardAudit(payload.sourceAudit);
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deferredCardQuery, showCardResults, themeScopedArchetype]);

  const readout = useMemo(
    () =>
      createStructuralReadout({
        main,
        extra,
        side,
        theme,
        buildIntent,
        strengthTarget,
        constraints,
      }),
    [buildIntent, constraints, extra, main, side, strengthTarget, theme],
  );
  const roleBuckets = useMemo(
    () =>
      createRoleBucketSummary({
        main,
        extra,
        side,
        theme,
      }),
    [extra, main, side, theme],
  );
  const quickRebuildOptions = useMemo(
    () =>
      deriveQuickRebuildOptions({
        buildIntent,
        constraints,
        readout,
        theme,
        metaSnapshot,
      }),
    [buildIntent, constraints, metaSnapshot, readout, theme],
  );
  const openingHandOdds = useMemo(
    () => computeOpeningHandOdds({ main, turnPreference }),
    [main, turnPreference],
  );
  const totalDeckCards = sumEntries(main) + sumEntries(extra) + sumEntries(side);
  const hasGeneratedShell = buildNotes.length > 0 || metaSnapshot !== null;
  const canPrint = totalDeckCards > 0;
  const showQuickRebuilds = hasGeneratedShell && quickRebuildOptions.length > 0;

  function applyArchetype(archetype: YugiohArchetype) {
    setErrorMessage(null);
    clearDeck();
    setThemeQuery(archetype.name);
    setResolvedArchetype(archetype.name);
    setSearchScope("theme");
  }

  function primeTheme(themeName: string) {
    setErrorMessage(null);
    clearDeck();
    setArchetypeQuery(themeName);
    setThemeQuery(themeName);
    setResolvedArchetype(themeName);
    setSearchScope("theme");
  }

  function anchorCard(card: YugiohCard) {
    setErrorMessage(null);

    if (card.archetype) {
      setResolvedArchetype(card.archetype);
      setArchetypeQuery(card.archetype);
      setSearchScope("theme");
    }

    if (!theme?.resolvedBossCards.includes(card.name)) {
      toggleBossCard(card);
    }
  }

  function handleExportYdk() {
    const lines: string[] = [];
    
    lines.push("#created by Yu-Gi-Oh Deck Builder");
    lines.push("#main");
    for (const entry of main) {
      for (let i = 0; i < entry.quantity; i++) {
        lines.push(entry.card.id.toString());
      }
    }
    
    lines.push("#extra");
    for (const entry of extra) {
      for (let i = 0; i < entry.quantity; i++) {
        lines.push(entry.card.id.toString());
      }
    }
    
    lines.push("!side");
    for (const entry of side) {
      for (let i = 0; i < entry.quantity; i++) {
        lines.push(entry.card.id.toString());
      }
    }
    
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const deckName = theme?.resolvedArchetype ?? theme?.query ?? "custom-deck";
    const filename = `${deckName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ydk`;
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function generateShell(overrides?: {
    buildIntent?: typeof buildIntent;
    constraints?: typeof constraints;
  }) {
    const activeTheme = theme ?? {
      query: archetypeQuery.trim(),
      resolvedArchetype: null,
      resolvedBossCards: [],
      resolvedSupportCards: [],
    };
    const nextBuildIntent = overrides?.buildIntent ?? buildIntent;
    const nextConstraints = overrides?.constraints ?? constraints;
    const activeThemeLabel =
      activeTheme.resolvedArchetype ?? activeTheme.resolvedBossCards[0] ?? activeTheme.query.trim();

    if (!activeThemeLabel) {
      setErrorMessage("Pick an archetype or anchor a boss card before generating a shell.");
      return;
    }

    setErrorMessage(null);
    clearDeck();
    setIsGenerating(true);

    try {
      const generatedDeck = await fetchJson<YugiohGeneratedDeckResponse>("/api/yugioh/deck-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          theme: activeTheme,
          buildIntent: nextBuildIntent,
          strengthTarget,
          constraints: nextConstraints,
        }),
      });

      setGeneratedDeck(generatedDeck);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate Yu-Gi-Oh shell.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyRebuildOption(option: {
    buildIntent: typeof buildIntent;
    constraints: typeof constraints;
  }) {
    setBuildIntent(option.buildIntent);
    setConstraints(option.constraints);
    await generateShell({
      buildIntent: option.buildIntent,
      constraints: option.constraints,
    });
  }

  return (
    <div className="ygo-builder-layout ygo-forge-layout">

      {/* ── Top bar ── */}
      <div className="ygo-forge-topbar">
        <div className="ygo-forge-title">
          <h1 className="ygo-forge-heading">Duel Forge</h1>
          {theme ? (
            <span className="ygo-forge-theme-pill">
              {theme.resolvedArchetype ?? theme.query}
            </span>
          ) : null}
        </div>
        <div className="ygo-forge-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => void generateShell()}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "⚡ Generate"}
          </button>
          {canPrint ? (
            <Link href="/yugioh/print" className="ghost-button">Print</Link>
          ) : null}
          {totalDeckCards > 0 ? (
            <button type="button" className="ghost-button" onClick={handleExportYdk}>
              Export .ydk
            </button>
          ) : null}
          {totalDeckCards > 0 ? (
            <button type="button" className="ghost-button ygo-forge-clear" onClick={() => clearDeck()}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? <p className="error-copy ygo-forge-error">{errorMessage}</p> : null}

      {/* ── 3-column layout ── */}
      <div className="ygo-forge-columns">

        {/* LEFT — Controls */}
        <div className="ygo-forge-left">

          {/* Theme */}
          <div className="ygo-forge-control-block">
            <p className="ygo-forge-label">Theme</p>
            <div className="ygo-archetype-search-wrapper">
              <input
                id="yugioh-archetype-search"
                className="app-input"
                placeholder="Blue-Eyes, Sky Striker, Tenpai..."
                value={archetypeQuery}
                autoComplete="off"
                onChange={(event) => {
                  setErrorMessage(null);
                  const nextValue = event.target.value;
                  setArchetypeQuery(nextValue);
                  setThemeQuery(nextValue);
                  if (nextValue.trim().length < 2) {
                    setArchetypes([]);
                    setArchetypeAudit([]);
                  }
                }}
              />
              {showArchetypeResults && (archetypes.length > 0 || archetypeQuery.trim().length >= 2) ? (
                <div className="ygo-archetype-dropdown">
                  {archetypes.map((archetype) => (
                    <button
                      key={archetype.id}
                      type="button"
                      className={`ygo-archetype-dropdown-item ${theme?.resolvedArchetype === archetype.name ? "active" : ""}`}
                      onClick={() => {
                        applyArchetype(archetype);
                        setArchetypeQuery(archetype.name);
                      }}
                    >
                      {archetype.previewCardImageUrl ? (
                        <Image
                          src={archetype.previewCardImageUrl}
                          alt={archetype.previewCardName ?? archetype.name}
                          width={38}
                          height={55}
                          className="ygo-archetype-thumb"
                          unoptimized
                        />
                      ) : (
                        <div className="ygo-archetype-thumb-placeholder">🃏</div>
                      )}
                      <div className="ygo-archetype-dropdown-copy">
                        <span className="ygo-archetype-dropdown-name">{archetype.name}</span>
                        {archetype.previewCardName && (
                          <span className="ygo-archetype-dropdown-sub">e.g. {archetype.previewCardName}</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {archetypeQuery.trim().length >= 2 && (
                    <button
                      type="button"
                      className="ygo-archetype-freeform-item"
                      onClick={() => primeTheme(archetypeQuery.trim())}
                    >
                      <span>→</span>
                      <span>Use &ldquo;{archetypeQuery.trim()}&rdquo; as custom theme</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <div className="ygo-forge-seeds">
              {STARTER_THEME_SEEDS.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  className={`ygo-forge-seed ${theme?.resolvedArchetype === seed ? "active" : ""}`}
                  onClick={() => { setArchetypeQuery(seed); primeTheme(seed); }}
                >
                  {seed}
                </button>
              ))}
            </div>
          </div>

          {/* Turn order */}
          <div className="ygo-forge-control-block">
            <p className="ygo-forge-label">Turn order</p>
            <div className="yugioh-turn-toggle">
              <button
                type="button"
                className={`yugioh-turn-card ${turnPreference === "going-first" ? "yugioh-turn-card-active" : ""}`}
                onClick={() => setTurnPreference("going-first")}
              >
                <span className="yugioh-turn-icon">⚡</span>
                <strong>Going First</strong>
                <small>Board builder. Max combo ceiling.</small>
              </button>
              <button
                type="button"
                className={`yugioh-turn-card ${turnPreference === "going-second" ? "yugioh-turn-card-active" : ""}`}
                onClick={() => setTurnPreference("going-second")}
              >
                <span className="yugioh-turn-icon">💥</span>
                <strong>Going Second</strong>
                <small>Board cracker. Breakers + hand traps.</small>
              </button>
            </div>
          </div>

          {/* Strength */}
          <div className="ygo-forge-control-block">
            <p className="ygo-forge-label">Strength</p>
            <div className="ygo-forge-strength-row">
              {YUGIOH_STRENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`ygo-forge-strength-pill ${strengthTarget === option.value ? "active" : ""}`}
                  onClick={() => setStrengthTarget(option.value)}
                  title={option.description}
                >
                  {option.title}
                </button>
              ))}
            </div>
          </div>

          {/* Quick rebuilds */}
          {showQuickRebuilds ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Quick rebuilds</p>
              <div className="yugioh-rebuild-grid">
                {quickRebuildOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="yugioh-rebuild-card"
                    onClick={() => void applyRebuildOption(option)}
                    disabled={isGenerating}
                  >
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* CENTER — Deck */}
        <div className="ygo-forge-center">

          {/* Stats + odds bar */}
          {totalDeckCards > 0 ? (
            <div className="ygo-forge-stats-bar">
              <span>Main <strong>{sumEntries(main)}</strong></span>
              <span>Extra <strong>{sumEntries(extra)}</strong></span>
              <span>Side <strong>{sumEntries(side)}</strong></span>
              <span>Score <strong>{readout.finalScore}</strong></span>
              <div className="ygo-forge-odds-inline">
                <span className={openingHandOdds.starterOdds >= 80 ? "odds-good" : openingHandOdds.starterOdds >= 60 ? "odds-ok" : "odds-low"}>
                  Starter {openingHandOdds.starterOdds}%
                </span>
                <span className={openingHandOdds.handTrapOdds >= 75 ? "odds-good" : openingHandOdds.handTrapOdds >= 50 ? "odds-ok" : "odds-low"}>
                  HT {openingHandOdds.handTrapOdds}%
                </span>
                {openingHandOdds.breakerOdds > 0 ? (
                  <span className={openingHandOdds.breakerOdds >= 60 ? "odds-good" : openingHandOdds.breakerOdds >= 40 ? "odds-ok" : "odds-low"}>
                    Breaker {openingHandOdds.breakerOdds}%
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {totalDeckCards === 0 ? (
            <div className="empty-state-card">
              <strong>No shell yet</strong>
              <p className="empty-copy">Pick a theme on the left and hit Generate, or search cards on the right to hand-build.</p>
            </div>
          ) : null}

          <div className="yugioh-deck-grid">
            <DeckSectionPanel
              title="Main Deck"
              section="main"
              entries={main}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
              setHoverPreviewCard={setHoverPreviewCard}
            />
            <DeckSectionPanel
              title="Extra Deck"
              section="extra"
              entries={extra}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
              setHoverPreviewCard={setHoverPreviewCard}
            />
            <DeckSectionPanel
              title="Side Deck"
              section="side"
              entries={side}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
              setHoverPreviewCard={setHoverPreviewCard}
            />
          </div>
        </div>

        {/* RIGHT — Card search + analysis */}
        <div className="ygo-forge-right">

          {/* Card search */}
          <div className="ygo-forge-control-block">
            <div className="ygo-forge-search-header">
              <p className="ygo-forge-label">Card search</p>
              {theme?.resolvedArchetype ? (
                <div className="game-switcher yugioh-search-scope">
                  <button
                    type="button"
                    className={`game-switcher-link ${searchScope === "theme" ? "game-switcher-link-active" : ""}`}
                    onClick={() => setSearchScope("theme")}
                  >
                    Theme
                  </button>
                  <button
                    type="button"
                    className={`game-switcher-link ${searchScope === "all" ? "game-switcher-link-active" : ""}`}
                    onClick={() => setSearchScope("all")}
                  >
                    All
                  </button>
                </div>
              ) : null}
            </div>
            <input
              id="yugioh-card-search"
              className="app-input"
              placeholder={themeScopedArchetype ? `Search inside ${themeScopedArchetype}...` : "Search any card..."}
              value={cardQuery}
              onChange={(event) => {
                setErrorMessage(null);
                const nextValue = event.target.value;
                setCardQuery(nextValue);
                if (nextValue.trim().length < 2) {
                  setCards([]);
                  setCardAudit([]);
                }
              }}
            />
            {showCardResults && cards.length === 0 ? (
              <p className="empty-copy" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                {themeScopedArchetype ? `Nothing in ${themeScopedArchetype}. Switch to All.` : "No matches."}
              </p>
            ) : null}
            {showCardResults && cards.length > 0 ? (
              <>
                <div className="ygo-compact-result-list">
                  {cards.map((card) => {
                    const suggestedSection = inferDeckSection(card);
                    const suggestedCopies =
                      suggestedSection === "extra" ? countCopies(extra, card.id) : countCopies(main, card.id);
                    const sideCopies = countCopies(side, card.id);
                    const bossCardSelected = theme?.resolvedBossCards.includes(card.name) ?? false;

                    return (
                      <div key={card.id} className="ygo-compact-card-item">
                        <div
                          style={{ cursor: 'pointer', flexShrink: 0, display: 'flex' }}
                          onMouseEnter={() => setHoverPreviewCard({
                            name: card.name,
                            typeLine: card.typeLine,
                            image: card.images.full || card.images.small || "",
                            desc: card.desc,
                          })}
                          onMouseLeave={() => setHoverPreviewCard(null)}
                        >
                          {card.images.small ? (
                            <Image
                              src={card.images.small}
                              alt={card.name}
                              width={48}
                              height={70}
                              className="ygo-compact-card-thumb"
                              unoptimized
                            />
                          ) : (
                            <div className="ygo-compact-card-thumb" style={{display: 'grid', placeItems: 'center', fontSize: '10px', color: '#64748b', border: '1px solid rgba(255,255,255,0.1)'}}>No img</div>
                          )}
                        </div>
                        <div className="ygo-compact-card-copy">
                          <strong>{card.name}</strong>
                          <small>{card.typeLine}</small>
                        </div>
                        <div className="ygo-compact-card-actions">
                          <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => addCard(card, suggestedSection)}>
                            +{suggestedCopies > 0 ? suggestedCopies : ""}
                          </button>
                          <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => addCard(card, "side")}>
                            S{sideCopies > 0 ? sideCopies : ""}
                          </button>
                          <button
                            type="button"
                            className={`ygo-filter-chip ${bossCardSelected ? "tag-pill-active" : ""}`}
                            style={{padding: '0.2rem 0.5rem', margin: 0, background: bossCardSelected ? 'rgba(59, 130, 246, 0.4)' : undefined, color: bossCardSelected ? '#fff' : undefined}}
                            onClick={() => anchorCard(card)}
                            title="Anchor as boss card"
                          >
                            ⚓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <SourceAuditBlock sourceAudit={cardAudit} />
              </>
            ) : null}
          </div>

          {/* Role breakdown */}
          {totalDeckCards > 0 ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Role breakdown</p>
              <div className="yugioh-role-map">
                {roleBuckets.map((bucket) => (
                  <article key={bucket.id} className="summary-card yugioh-role-bucket">
                    <span>{bucket.title}</span>
                    <strong>{bucket.count}</strong>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {/* Warnings + reads */}
          {totalDeckCards > 0 && (readout.warnings.length > 0 || readout.notes.length > 0) ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Reads</p>
              <div className="yugioh-signal-list">
                {readout.warnings.map((warning) => (
                  <article key={warning} className="summary-card yugioh-signal-card yugioh-signal-card-warn">
                    <strong>⚠</strong>
                    <p className="empty-copy">{warning}</p>
                  </article>
                ))}
                {readout.notes.map((note) => (
                  <article key={note} className="summary-card yugioh-signal-card yugioh-signal-card-good">
                    <p className="empty-copy">{note}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {/* Generation notes */}
          {buildNotes.length > 0 ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Generation notes</p>
              <div className="yugioh-note-list">
                {buildNotes.map((note) => (
                  <article key={note} className="summary-card yugioh-signal-card yugioh-signal-card-neutral">
                    <p className="empty-copy">{note}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {/* Meta field */}
          {metaSnapshot ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Meta field — {metaSnapshot.matchedDeckCount} matched</p>
              <div className="yugioh-meta-chip-grid">
                {metaSnapshot.topFieldDecks.map((entry) => (
                  <article key={entry.name} className="summary-card yugioh-meta-chip">
                    <strong>{entry.name}</strong>
                    <small>{entry.count} lists</small>
                  </article>
                ))}
              </div>
              {metaSnapshot.matchedDecks.length > 0 ? (
                <div className="yugioh-sample-list" style={{ marginTop: '0.5rem' }}>
                  {metaSnapshot.matchedDecks.slice(0, 4).map((deck) => (
                    <a
                      key={deck.deckUrl}
                      href={deck.deckUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="summary-card yugioh-sample-card"
                    >
                      <strong>{deck.deckName}</strong>
                      <small>{[deck.tournamentName, deck.placement].filter(Boolean).join(" | ")}</small>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <SourceAuditBlock sourceAudit={sourceAudit} />
        </div>
      </div>

      {/* Hover overlay */}
      {hoverPreviewCard?.image ? (
        <div className="deck-preview-overlay" aria-hidden="true" style={{ zIndex: 100 }}>
          <div className="deck-preview-scrim" />
          <div className="deck-preview-frame">
            <Image
              src={hoverPreviewCard.image}
              alt={hoverPreviewCard.name}
              width={421}
              height={614}
              className="deck-preview-image"
              unoptimized
            />
            {hoverPreviewCard.desc ? (
              <div className="deck-preview-desc">
                <p className="deck-preview-desc-name">{hoverPreviewCard.name}</p>
                <p className="deck-preview-desc-type">{hoverPreviewCard.typeLine}</p>
                <p className="deck-preview-desc-text">{hoverPreviewCard.desc}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
