"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  createStructuralReadout,
  createRoleBucketSummary,
  deriveQuickRebuildOptions,
  inferDeckSection,
  YUGIOH_CONSTRAINT_OPTIONS,
  YUGIOH_INTENT_OPTIONS,
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
} from "@/lib/games/yugioh/types";
import { useYugiohStore } from "@/store/yugioh-store";

type SearchScope = "theme" | "all";

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
}: {
  title: string;
  section: YugiohDeckSection;
  entries: YugiohDeckEntry[];
  onAddCopy: (card: YugiohCard, section: YugiohDeckSection) => void;
  onRemoveCopy: (cardId: number, section: YugiohDeckSection) => void;
  onRemoveCard: (cardId: number, section: YugiohDeckSection) => void;
}) {
  return (
    <section className="yugioh-section-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">{title}</p>
          <h3>{sumEntries(entries)} cards</h3>
        </div>
        <span className="status-pill">{sectionLabel(section)}</span>
      </div>

      {entries.length > 0 ? (
        <div className="yugioh-deck-section-list">
          {entries.map((entry) => (
            <article key={`${section}-${entry.card.id}`} className="yugioh-deck-entry">
              {entry.card.images.small ? (
                <Image
                  src={entry.card.images.small}
                  alt={entry.card.name}
                  width={64}
                  height={92}
                  className="yugioh-deck-entry-thumb"
                  unoptimized
                />
              ) : null}

              <div className="yugioh-deck-entry-copy">
                <strong>{entry.card.name}</strong>
                <small>{entry.card.typeLine}</small>
                <div className="tag-row yugioh-role-row">
                  {entry.roles.map((role) => (
                    <span key={`${entry.card.id}-${role}`} className="tag-pill">
                      {roleLabel(role)}
                    </span>
                  ))}
                </div>
                {entry.rationale ? <p className="empty-copy yugioh-rationale">{entry.rationale}</p> : null}
              </div>

              <div className="yugioh-stepper">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onRemoveCopy(entry.card.id, section)}
                  aria-label={`Decrease copies of ${entry.card.name}`}
                >
                  -
                </button>
                <span className="status-pill">{entry.quantity}</span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onAddCopy(entry.card, section)}
                  disabled={entry.quantity >= 3}
                  aria-label={`Increase copies of ${entry.card.name}`}
                >
                  +
                </button>
                <button type="button" className="danger-link" onClick={() => onRemoveCard(entry.card.id, section)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">
          No cards here yet. Add cards from search and the builder will keep the section organized for you.
        </p>
      )}
    </section>
  );
}

export function YugiohBuilderApp() {
  const {
    formatMode,
    strengthTarget,
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
    setBuildIntent,
    setConstraints,
    clearTheme,
    setThemeQuery,
    setResolvedArchetype,
    toggleBossCard,
    toggleConstraint,
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

  function applyArchetype(archetype: YugiohArchetype) {
    setErrorMessage(null);
    setThemeQuery(archetype.name);
    setResolvedArchetype(archetype.name);
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
    <main className="page-shell">
      <section className="hero-panel yugioh-builder-hero">
        <div className="hero-copy">
          <p className="eyebrow">Yu-Gi-Oh Duel Forge</p>
          <h1>Build a persistent shell now, then let the generator get smarter on top of it.</h1>
          <p className="hero-description">
            This phase upgrades Yu-Gi-Oh from a search demo into a real builder workspace. Lock a theme, choose how
            nasty the shell should be, and generate a Main, Extra, and Side shell that you can immediately tune by hand.
          </p>
          <div className="status-row">
            <span className="status-pill">Open Lab default</span>
            <span className="status-pill">Persistent deck state</span>
            <span className="status-pill">Structural readout live</span>
          </div>
        </div>

        <div className="panel yugioh-source-panel">
          <p className="panel-kicker">Current phase</p>
          <h2>Builder shell</h2>
          <p className="hero-description">
            Banlist pressure is intentionally off here. The shell still respects sane card counts and keeps explaining
            what it sees structurally so the future generator has a clean place to take over.
          </p>
          <ul className="launcher-feature-list">
            <li>Theme memory with boss-card anchors</li>
            <li>Main / Extra / Side deck composition</li>
            <li>Heuristic structural scoring and warnings</li>
            <li>Auto-generated shells from live tournament-meta data</li>
          </ul>
          <div className="tag-row">
            <button type="button" className="primary-button" onClick={() => void generateShell()} disabled={isGenerating}>
              {isGenerating ? "Generating shell..." : "Generate strongest shell"}
            </button>
            <span className="status-pill">{formatMode === "open-lab" ? "Open Lab" : formatMode}</span>
          </div>
          {theme ? (
            <div className="yugioh-theme-summary">
              <strong>{theme.resolvedArchetype ?? theme.query ?? "Theme in progress"}</strong>
              <small>
                {theme.resolvedBossCards.length > 0
                  ? `Boss anchors: ${theme.resolvedBossCards.join(", ")}`
                  : "Pick a standout monster or spell to sharpen the build's identity."}
              </small>
            </div>
          ) : (
            <p className="empty-copy">Pick an archetype or anchor a signature card to start shaping the shell.</p>
          )}
        </div>
      </section>

      <section className="dashboard-grid yugioh-builder-grid">
        <div className="panel control-panel yugioh-control-stack">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Build stance</p>
              <h2>Theme and tuning</h2>
            </div>
          </div>

          <label className="field-label" htmlFor="yugioh-archetype-search">
            Search archetypes
          </label>
          <input
            id="yugioh-archetype-search"
            className="app-input"
            placeholder="Yubel, Sky Striker, Tenpai..."
            value={archetypeQuery}
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

          {theme ? (
            <div className="tag-row yugioh-selected-theme">
              <span className="tag-pill tag-pill-active">{theme.resolvedArchetype ?? theme.query ?? "Theme"}</span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  clearTheme();
                  setSearchScope("all");
                }}
              >
                Clear theme
              </button>
            </div>
          ) : null}

          {showArchetypeResults && archetypes.length > 0 ? (
            <>
              <div className="result-list">
                {archetypes.map((archetype) => (
                  <button
                    key={archetype.id}
                    type="button"
                    className={`result-item yugioh-archetype-item ${theme?.resolvedArchetype === archetype.name ? "result-item-active" : ""}`}
                    onClick={() => applyArchetype(archetype)}
                  >
                    <span>
                      <strong>{archetype.name}</strong>
                      <small>Use this as the shell&apos;s primary archetype anchor.</small>
                    </span>
                  </button>
                ))}
              </div>
              <SourceAuditBlock sourceAudit={archetypeAudit} />
            </>
          ) : null}

          <div className="yugioh-open-lab-note">
            <span className="status-pill">Format mode</span>
            <div>
              <strong>Open Lab</strong>
              <small>Legality is ignored on purpose here. The goal is strong ideas and clean structure, not compliance.</small>
            </div>
          </div>

          <div className="panel-header">
            <div>
              <p className="panel-kicker">Intent</p>
              <h3>How should the shell behave?</h3>
            </div>
          </div>

          <div className="yugioh-choice-grid">
            {YUGIOH_INTENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`yugioh-choice-card ${buildIntent === option.value ? "yugioh-choice-card-active" : ""}`}
                onClick={() => setBuildIntent(option.value)}
              >
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="panel-header">
            <div>
              <p className="panel-kicker">Strength</p>
              <h3>How hard should it push?</h3>
            </div>
          </div>

          <div className="yugioh-choice-grid">
            {YUGIOH_STRENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`yugioh-choice-card ${strengthTarget === option.value ? "yugioh-choice-card-active" : ""}`}
                onClick={() => setStrengthTarget(option.value)}
              >
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="panel-header">
            <div>
              <p className="panel-kicker">Constraints</p>
              <h3>Pressure the shell into shape</h3>
            </div>
          </div>

          <div className="yugioh-constraint-grid">
            {YUGIOH_CONSTRAINT_OPTIONS.map((constraint) => (
              <button
                key={constraint.value}
                type="button"
                className={`yugioh-constraint-card ${constraints.includes(constraint.value) ? "yugioh-constraint-card-active" : ""}`}
                onClick={() => toggleConstraint(constraint.value)}
              >
                <strong>{constraint.title}</strong>
                <small>{constraint.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel meta-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Card search</p>
              <h2>Feed the shell</h2>
            </div>
          </div>

          <div className="yugioh-search-toolbar">
            <label className="field-label" htmlFor="yugioh-card-search">
              Search cards
            </label>
            {theme?.resolvedArchetype ? (
              <div className="game-switcher yugioh-search-scope">
                <button
                  type="button"
                  className={`game-switcher-link ${searchScope === "theme" ? "game-switcher-link-active" : ""}`}
                  onClick={() => setSearchScope("theme")}
                >
                  Theme cards
                </button>
                <button
                  type="button"
                  className={`game-switcher-link ${searchScope === "all" ? "game-switcher-link-active" : ""}`}
                  onClick={() => setSearchScope("all")}
                >
                  All cards
                </button>
              </div>
            ) : null}
          </div>

          <input
            id="yugioh-card-search"
            className="app-input"
            placeholder={
              themeScopedArchetype
                ? `Search inside ${themeScopedArchetype}...`
                : "Search any Yu-Gi-Oh card to add into the shell..."
            }
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

          {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}

          {showCardResults && cards.length > 0 ? (
            <>
              <div className="yugioh-card-grid">
                {cards.map((card) => {
                  const suggestedSection = inferDeckSection(card);
                  const suggestedCopies =
                    suggestedSection === "extra" ? countCopies(extra, card.id) : countCopies(main, card.id);
                  const sideCopies = countCopies(side, card.id);
                  const bossCardSelected = theme?.resolvedBossCards.includes(card.name) ?? false;

                  return (
                    <article key={card.id} className="summary-card yugioh-card-record">
                      {card.images.small ? (
                        <Image
                          src={card.images.small}
                          alt={card.name}
                          width={120}
                          height={175}
                          className="yugioh-card-thumb"
                          unoptimized
                        />
                      ) : null}
                      <div className="yugioh-card-copy">
                        <strong>{card.name}</strong>
                        <small>{card.typeLine}</small>
                        {card.archetype ? <span className="tag-pill">{card.archetype}</span> : null}
                        <p className="hero-description yugioh-card-description">{card.desc}</p>
                        <div className="yugioh-card-stats">
                          {card.attribute ? <span>Attribute: {card.attribute}</span> : null}
                          {card.race ? <span>Race: {card.race}</span> : null}
                          {card.levelRankLink ? <span>Level/Rank/Link: {card.levelRankLink}</span> : null}
                          {card.atk !== null ? <span>ATK: {card.atk}</span> : null}
                          {card.def !== null ? <span>DEF: {card.def}</span> : null}
                        </div>
                        <div className="tag-row yugioh-result-actions">
                          <button type="button" className="primary-button" onClick={() => addCard(card, suggestedSection)}>
                            Add to {sectionLabel(suggestedSection)}{suggestedCopies > 0 ? ` (${suggestedCopies})` : ""}
                          </button>
                          <button type="button" className="ghost-button" onClick={() => addCard(card, "side")}>
                            Add to Side{sideCopies > 0 ? ` (${sideCopies})` : ""}
                          </button>
                          <button
                            type="button"
                            className={`ghost-button ${bossCardSelected ? "tag-pill-active" : ""}`}
                            onClick={() => anchorCard(card)}
                          >
                            {bossCardSelected ? "Anchored" : "Anchor build"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <SourceAuditBlock sourceAudit={cardAudit} />
            </>
          ) : (
            <p className="empty-copy">
              Search cards and start dropping them into Main, Extra, or Side. You can mix manual edits with generated
              shells whenever you want to steer the build more aggressively.
            </p>
          )}
        </div>
      </section>

      <section className="dashboard-grid yugioh-workspace-grid">
        <div className="panel meta-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Structural readout</p>
              <h2>What the shell is telling us</h2>
            </div>
            <span className="status-pill">Score {readout.finalScore}</span>
          </div>

          {buildNotes.length > 0 ? (
            <div className="yugioh-generation-block">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Generation notes</p>
                  <h3>Why this shell looks like this</h3>
                </div>
              </div>
              <div className="yugioh-note-list">
                {buildNotes.map((note) => (
                  <article key={note} className="summary-card yugioh-signal-card yugioh-signal-card-neutral">
                    <p className="empty-copy">{note}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {quickRebuildOptions.length > 0 ? (
            <div className="yugioh-generation-block">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Quick rebuilds</p>
                  <h3>One-click tuning paths</h3>
                </div>
              </div>
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

          {metaSnapshot ? (
            <div className="yugioh-generation-block">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Meta snapshot</p>
                  <h3>Live field context</h3>
                </div>
              </div>

              <div className="summary-grid yugioh-summary-grid">
                <article className="summary-card">
                  <span>Matched Decks</span>
                  <strong>{metaSnapshot.matchedDeckCount}</strong>
                </article>
                <article className="summary-card">
                  <span>Field Sample</span>
                  <strong>{metaSnapshot.fieldSampleSize}</strong>
                </article>
                <article className="summary-card">
                  <span>Theme Query</span>
                  <strong>{metaSnapshot.themeQuery}</strong>
                </article>
                <article className="summary-card">
                  <span>Top Field Deck</span>
                  <strong>{metaSnapshot.topFieldDecks[0]?.name ?? "N/A"}</strong>
                </article>
              </div>

              <div className="yugioh-meta-chip-grid">
                {metaSnapshot.topFieldDecks.map((entry) => (
                  <article key={entry.name} className="summary-card yugioh-meta-chip">
                    <strong>{entry.name}</strong>
                    <small>{entry.count} lists in sample</small>
                  </article>
                ))}
              </div>

              {metaSnapshot.matchedDecks.length > 0 ? (
                <div className="yugioh-sample-list">
                  {metaSnapshot.matchedDecks.map((deck) => (
                    <a
                      key={deck.deckUrl}
                      href={deck.deckUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="summary-card yugioh-sample-card"
                    >
                      <strong>{deck.deckName}</strong>
                      <small>
                        {[deck.tournamentName, deck.placement, deck.submitDateLabel].filter(Boolean).join(" · ")}
                      </small>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="summary-grid yugioh-summary-grid">
            <article className="summary-card">
              <span>Consistency</span>
              <strong>{readout.consistency}</strong>
            </article>
            <article className="summary-card">
              <span>Synergy</span>
              <strong>{readout.synergy}</strong>
            </article>
            <article className="summary-card">
              <span>Pressure</span>
              <strong>{readout.pressure}</strong>
            </article>
            <article className="summary-card">
              <span>Adaptability</span>
              <strong>{readout.adaptability}</strong>
            </article>
          </div>

          <div className="summary-grid yugioh-summary-grid">
            <article className="summary-card">
              <span>Main</span>
              <strong>{sumEntries(main)}</strong>
            </article>
            <article className="summary-card">
              <span>Extra</span>
              <strong>{sumEntries(extra)}</strong>
            </article>
            <article className="summary-card">
              <span>Side</span>
              <strong>{sumEntries(side)}</strong>
            </article>
            <article className="summary-card">
              <span>Structural Integrity</span>
              <strong>{readout.structuralIntegrity}</strong>
            </article>
          </div>

          <div className="yugioh-role-map">
            {roleBuckets.map((bucket) => (
              <article key={bucket.id} className="summary-card yugioh-role-bucket">
                <span>{bucket.title}</span>
                <strong>{bucket.count}</strong>
                <small>{bucket.description}</small>
              </article>
            ))}
          </div>

          <div className="yugioh-signal-list">
            {readout.warnings.map((warning) => (
              <article key={warning} className="summary-card yugioh-signal-card yugioh-signal-card-warn">
                <strong>Warning</strong>
                <p className="empty-copy">{warning}</p>
              </article>
            ))}

            {readout.notes.map((note) => (
              <article key={note} className="summary-card yugioh-signal-card yugioh-signal-card-good">
                <strong>Read</strong>
                <p className="empty-copy">{note}</p>
              </article>
            ))}
          </div>

          <SourceAuditBlock sourceAudit={sourceAudit} />
        </div>

        <div className="panel deck-panel yugioh-deck-workspace">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Deck workspace</p>
              <h2>Persistent shell</h2>
            </div>
            <div className="tag-row">
              <Link href="/yugioh/print" className="ghost-button">
                Print proxies
              </Link>
              <button type="button" className="ghost-button" onClick={() => clearDeck()}>
                Clear deck
              </button>
            </div>
          </div>

          <p className="empty-copy yugioh-workspace-copy">
            Use the generated shell as a starting point, then tighten ratios, swap tech cards, and stress-test the
            structure manually. This workspace is the tuning bench, not just a static output.
          </p>

          <div className="yugioh-deck-grid">
            <DeckSectionPanel
              title="Main Deck"
              section="main"
              entries={main}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
            />
            <DeckSectionPanel
              title="Extra Deck"
              section="extra"
              entries={extra}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
            />
            <DeckSectionPanel
              title="Side Deck"
              section="side"
              entries={side}
              onAddCopy={addCard}
              onRemoveCopy={decrementCard}
              onRemoveCard={removeCard}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
