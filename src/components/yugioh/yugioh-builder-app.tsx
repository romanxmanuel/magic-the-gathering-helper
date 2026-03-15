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

type HoverPreviewCard = {
  name: string;
  typeLine: string;
  image: string;
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
                image: entry.card.images.full || entry.card.images.small || ""
              })}
              onMouseLeave={() => setHoverPreviewCard(null)}
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
    <div className="ygo-dashboard-layout ygo-builder-layout">
      <section className="ygo-welcome-panel yugioh-builder-hero" style={{ padding: '2rem' }}>
        <div className="hero-copy ygo-welcome-copy">
          <h1 style={{ marginBottom: '1rem' }}>Yu-Gi-Oh Duel Forge</h1>
          <p className="hero-description" style={{ color: '#cbd5e1', marginBottom: '1.5rem' }}>
            Duel Forge is now a real archetype-first workspace. Lock a theme, bias the shell toward the field, rebuild
            it in one click, and print the result when you want to test it physically.
          </p>
          <div className="status-row">
            <span className="ygo-live-badge">Open Lab default</span>
            <span className="ygo-live-badge">Meta-powered shells</span>
          </div>
        </div>

        <div className="ygo-list-panel yugioh-source-panel" style={{ flexShrink: 0, width: '450px', background: 'rgba(15,23,42,0.6)' }}>
          <p className="panel-kicker">Open Lab</p>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', margin: '0 0 0.5rem 0', color: '#f8fafc' }}>Duel Forge workspace</h2>
          <p className="hero-description" style={{ fontSize: '0.85rem' }}>
            Banlist pressure is intentionally off here. The generator is chasing structurally strong, anti-meta ideas,
            then giving you clean rebuild paths instead of hiding the logic.
          </p>
          <div className="tag-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => void generateShell()}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating shell..." : "Generate strongest shell"}
            </button>
            {canPrint ? (
              <Link href="/yugioh/print" className="ygo-section-action">
                Open print view
              </Link>
            ) : (
              <span className="ygo-section-action" style={{ opacity: 0.5, cursor: 'not-allowed' }}>Open print view</span>
            )}
          </div>
          {theme ? (
            <div className="yugioh-theme-summary" style={{ marginTop: '1rem' }}>
              <strong>{theme.resolvedArchetype ?? theme.query ?? "Theme in progress"}</strong>
              <small>
                {theme.resolvedBossCards.length > 0
                  ? `Boss anchors: ${theme.resolvedBossCards.join(", ")}`
                  : "Pick a standout monster or spell to sharpen the build's identity."}
              </small>
            </div>
          ) : null}
        </div>
      </section>

      <section className="ygo-bottom-grid yugioh-builder-grid">
        <div className="ygo-list-panel control-panel yugioh-control-stack">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Build stance</p>
              <h2>Theme and tuning</h2>
            </div>
          </div>

          <label className="field-label" htmlFor="yugioh-archetype-search">
            Search archetypes
          </label>
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

                {/* Freeform theme fallback */}
                {archetypeQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    className="ygo-archetype-freeform-item"
                    onClick={() => primeTheme(archetypeQuery.trim())}
                  >
                    <span>→</span>
                    <span>Use &ldquo;{archetypeQuery.trim()}&rdquo; as a custom theme</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>

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
              <div className="ygo-compact-result-list">
                {cards.map((card) => {
                  const suggestedSection = inferDeckSection(card);
                  const suggestedCopies =
                    suggestedSection === "extra" ? countCopies(extra, card.id) : countCopies(main, card.id);
                  const sideCopies = countCopies(side, card.id);
                  const bossCardSelected = theme?.resolvedBossCards.includes(card.name) ?? false;

                  return (
                    <div 
                      key={card.id} 
                      className="ygo-compact-card-item"
                    >
                      <div
                        style={{ cursor: 'pointer', flexShrink: 0, display: 'flex' }}
                        onMouseEnter={() => setHoverPreviewCard({
                          name: card.name,
                          typeLine: card.typeLine,
                          image: card.images.full || card.images.small || ""
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
                        <strong>{card.name} {card.archetype ? <span style={{opacity: 0.5}}>- {card.archetype}</span> : null}</strong>
                        <small>{card.typeLine}</small>
                        <div className="ygo-compact-card-stats">
                          {card.attribute ? <span>{card.attribute}</span> : null}
                          {card.race ? <span>{card.race}</span> : null}
                          {card.levelRankLink ? <span>L/R/L: {card.levelRankLink}</span> : null}
                          {card.atk !== null ? <span>ATK: {card.atk}</span> : null}
                          {card.def !== null ? <span>DEF: {card.def}</span> : null}
                        </div>
                      </div>

                      <div className="ygo-compact-card-actions">
                        <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => addCard(card, suggestedSection)}>
                          Add{suggestedCopies > 0 ? ` (${suggestedCopies})` : ""}
                        </button>
                        <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => addCard(card, "side")}>
                          Side{sideCopies > 0 ? ` (${sideCopies})` : ""}
                        </button>
                        <button
                          type="button"
                          className={`ygo-filter-chip ${bossCardSelected ? "tag-pill-active" : ""}`}
                          style={{padding: '0.2rem 0.5rem', margin: 0, background: bossCardSelected ? 'rgba(59, 130, 246, 0.4)' : undefined, color: bossCardSelected ? '#fff' : undefined}}
                          onClick={() => anchorCard(card)}
                        >
                          Anchor
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <SourceAuditBlock sourceAudit={cardAudit} />
            </>
          ) : (
            <div className="empty-state-card">
              <strong>Search and hand-tune anything</strong>
              <p className="empty-copy">
                Search cards to sharpen the shell manually, add off-theme tech, or anchor a specific boss monster that
                the auto-generator should respect on the next pass.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="ygo-bottom-grid yugioh-workspace-grid" style={{ gridTemplateColumns: 'minmax(350px, 1fr) 2fr' }}>
        <div className="ygo-list-panel meta-panel">
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

          {showQuickRebuilds ? (
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

          {!hasGeneratedShell && totalDeckCards === 0 ? (
            <div className="empty-state-card">
              <strong>Generate or hand-build a shell first</strong>
              <p className="empty-copy">
                This panel gets much smarter after the first generated list or a meaningful manual shell. That is when
                rebuild paths, field context, and role distribution become genuinely useful.
              </p>
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
                      <small>{[deck.tournamentName, deck.placement, deck.submitDateLabel].filter(Boolean).join(" | ")}</small>
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

          {totalDeckCards > 0 ? (
            <div className="yugioh-role-map">
              {roleBuckets.map((bucket) => (
                <article key={bucket.id} className="summary-card yugioh-role-bucket">
                  <span>{bucket.title}</span>
                  <strong>{bucket.count}</strong>
                  <small>{bucket.description}</small>
                </article>
              ))}
            </div>
          ) : null}

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
              {totalDeckCards > 0 ? (
                <button type="button" className="ygo-filter-chip" onClick={handleExportYdk}>
                  Export .ydk
                </button>
              ) : null}
              {canPrint ? (
                <Link href="/yugioh/print" className="ghost-button">
                  Print proxies
                </Link>
              ) : (
                <span className="ghost-button button-disabled">Print proxies</span>
              )}
              <button type="button" className="ghost-button" onClick={() => clearDeck()}>
                Clear deck
              </button>
            </div>
          </div>

          <p className="empty-copy yugioh-workspace-copy">
            Use the generated shell as a starting point, then tighten ratios, swap tech cards, and stress-test the
            structure manually. This workspace is the tuning bench, not just a static output.
          </p>

          {totalDeckCards === 0 ? (
            <div className="empty-state-card">
              <strong>No shell yet</strong>
              <p className="empty-copy">
                Pick a theme and generate a shell, or search cards and build by hand. The workspace becomes much easier
                to read once at least the first 40-card idea is on the table.
              </p>
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
      </section>

      {hoverPreviewCard?.image ? (
        <div className="deck-preview-overlay" aria-hidden="true" style={{ zIndex: 100 }}>
          <div className="deck-preview-scrim" />
          <div className="deck-preview-frame">
            <Image
              src={hoverPreviewCard.image}
              alt={hoverPreviewCard.name}
              width={488}
              height={680}
              className="deck-preview-image"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
