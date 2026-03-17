"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  createStructuralReadout,
  createRoleBucketSummary,
  computeOpeningHandOdds,
  deriveQuickRebuildOptions,
  inferDeckSection,
  YUGIOH_STRENGTH_OPTIONS,
} from "@/lib/games/yugioh/builder-shell";
import type {
  YugiohArchetype,
  YugiohArchetypeSearchResponse,
  YugiohCard,
  YugiohGeneratedDeckResponse,
  YugiohCardSearchResponse,
  YugiohDeckEntry,
  YugiohDeckSection,
} from "@/lib/games/yugioh/types";
import { useYugiohStore } from "@/store/yugioh-store";

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

function sectionLabel(section: YugiohDeckSection) {
  return section.charAt(0).toUpperCase() + section.slice(1);
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (value && typeof value === "object") {
    return Object.values(value).filter((item): item is string => typeof item === "string");
  }

  return [] as string[];
}

function normalizeConstraintArray(value: unknown) {
  return normalizeStringArray(value);
}

function countCopies(entries: YugiohDeckEntry[], cardId: number) {
  return entries.find((entry) => entry.card.id === cardId)?.quantity ?? 0;
}

function sumEntries(entries: YugiohDeckEntry[]) {
  return entries.reduce((count, entry) => count + entry.quantity, 0);
}

function formatSectionForToast(section: YugiohDeckSection) {
  return section === "main" ? "Main Deck" : section === "extra" ? "Extra Deck" : "Side Deck";
}

function DeckSectionPanel({
  title,
  section,
  entries,
  onAddCopy,
  onRemoveCopy,
  onRemoveCard,
  hoverPreviewCard,
  onTogglePreview,
}: {
  title: string;
  section: YugiohDeckSection;
  entries: YugiohDeckEntry[];
  onAddCopy: (card: YugiohCard, section: YugiohDeckSection) => void;
  onRemoveCopy: (card: YugiohCard, section: YugiohDeckSection) => void;
  onRemoveCard: (card: YugiohCard, section: YugiohDeckSection) => void;
  hoverPreviewCard: HoverPreviewCard | null;
  onTogglePreview: (card: HoverPreviewCard) => void;
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
        <div className="ygo-builder-card-list">
          {entries.map((entry) => (
            <article key={`${section}-${entry.card.id}`} className="ygo-builder-card-row" title={entry.rationale ?? undefined}>
              <button
                type="button"
                className={`ygo-builder-card-thumb-button ${hoverPreviewCard?.name === entry.card.name ? "active" : ""}`}
                onClick={() =>
                  onTogglePreview({
                    name: entry.card.name,
                    typeLine: entry.card.typeLine,
                    image: entry.card.images.full || entry.card.images.small || "",
                    desc: entry.card.desc,
                  })
                }
                aria-pressed={hoverPreviewCard?.name === entry.card.name}
              >
                {entry.card.images.small ? (
                  <Image
                    src={entry.card.images.small}
                    alt={entry.card.name}
                    width={56}
                    height={81}
                    className="ygo-builder-card-thumb"
                    unoptimized
                  />
                ) : (
                  <span className="ygo-builder-card-thumb ygo-builder-card-thumb-placeholder">No image</span>
                )}
              </button>
              <div className="ygo-builder-card-copy">
                <div className="ygo-builder-card-copy-top">
                  <strong>{entry.card.name}</strong>
                  <span className="ygo-builder-card-qty">x{entry.quantity}</span>
                </div>
                <small>{entry.card.typeLine}</small>
                {entry.rationale ? <p>{entry.rationale}</p> : null}
              </div>
              <div className="ygo-builder-card-actions">
                <button type="button" onClick={() => onAddCopy(entry.card, section)} disabled={entry.quantity >= 3} aria-label="Add Copy">+</button>
                <button type="button" onClick={() => onRemoveCopy(entry.card, section)} aria-label="Remove Copy">-</button>
                <button type="button" onClick={() => onRemoveCard(entry.card, section)} aria-label="Remove All" className="danger-link">Del</button>
              </div>
            </article>
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
    metaSnapshot,
    selectedDeckVersion,
    setStrengthTarget,
    setTurnPreference,
    setBuildIntent,
    setConstraints,
    setSelectedDeckVersion,
    setThemeQuery,
    addThemeAnchor,
    toggleThemeAnchorActive,
    removeThemeAnchor,
    toggleBossCard,
    toggleBossAnchorActive,
    removeBossCardByName,
    setGeneratedDeck,
    addCard,
    decrementCard,
    removeCard,
    clearDeck,
  } = useYugiohStore();

  const [archetypeQuery, setArchetypeQuery] = useState(theme?.resolvedArchetype ?? theme?.query ?? "");
  const [cardQuery, setCardQuery] = useState("");
  const deferredArchetypeQuery = useDeferredValue(archetypeQuery);
  const deferredCardQuery = useDeferredValue(cardQuery);
  const [archetypes, setArchetypes] = useState<YugiohArchetype[]>([]);
  const [cards, setCards] = useState<YugiohCard[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isArchetypeDropdownOpen, setIsArchetypeDropdownOpen] = useState(false);
  const [hoverPreviewCard, setHoverPreviewCard] = useState<HoverPreviewCard | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const showArchetypeResults = deferredArchetypeQuery.trim().length >= 2;
  const showCardResults = deferredCardQuery.trim().length >= 2;

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

    fetchJson<YugiohCardSearchResponse>(`/api/yugioh/cards?${params.toString()}`)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setCards(payload.cards);
      })
      .catch((error: Error) => {
        if (isActive) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, [deferredCardQuery, showCardResults]);

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
  const uniqueBuildNotes = useMemo(() => [...new Set(buildNotes)], [buildNotes]);
  const uniqueWarnings = useMemo(() => [...new Set(readout.warnings)], [readout.warnings]);
  const uniqueNotes = useMemo(() => [...new Set(readout.notes)], [readout.notes]);
  const buildReads = useMemo(
    () => [...new Set([...uniqueWarnings.map((warning) => `Warning: ${warning}`), ...uniqueNotes, ...uniqueBuildNotes])],
    [uniqueBuildNotes, uniqueNotes, uniqueWarnings],
  );
  const totalDeckCards = sumEntries(main) + sumEntries(extra) + sumEntries(side);
  const hasGeneratedShell = buildNotes.length > 0 || metaSnapshot !== null;
  const canPrint = totalDeckCards > 0;
  const showQuickRebuilds = hasGeneratedShell && quickRebuildOptions.length > 0;
  const deckVersions = metaSnapshot?.deckVersions ?? [];
  const matchedDeckSamples = metaSnapshot?.matchedDecks ?? [];
  const activeThemeAnchors = theme?.resolvedSupportCards ?? [];
  const inactiveThemeAnchors = theme?.inactiveSupportCards ?? [];
  const activeBossAnchors = theme?.resolvedBossCards ?? [];
  const inactiveBossAnchors = theme?.inactiveBossCards ?? [];

  function showToast(message: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 1400);
  }

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    },
    [],
  );

  function applyArchetype(archetype: YugiohArchetype) {
    setErrorMessage(null);
    setArchetypeQuery(archetype.name);
    setArchetypes([]);
    setIsArchetypeDropdownOpen(false);
    showToast(`${archetype.name} ready to add.`);
  }

  function addThemeToAnchors(themeName: string) {
    const normalized = themeName.trim();

    if (!normalized) {
      return;
    }

    if (activeThemeAnchors.includes(normalized) || inactiveThemeAnchors.includes(normalized)) {
      showToast(`${normalized} is already in your theme anchors.`);
      return;
    }

    setErrorMessage(null);
    setArchetypeQuery(normalized);
    setThemeQuery(normalized);
    addThemeAnchor(normalized);
    setArchetypes([]);
    setIsArchetypeDropdownOpen(false);
    showToast(`${normalized} added to your theme anchors.`);
  }

  function togglePreviewCard(card: HoverPreviewCard) {
    setHoverPreviewCard((current) => (current?.name === card.name ? null : card));
  }

  function anchorCard(card: YugiohCard) {
    setErrorMessage(null);

    if (
      card.archetype &&
      !activeThemeAnchors.includes(card.archetype) &&
      !inactiveThemeAnchors.includes(card.archetype)
    ) {
      addThemeAnchor(card.archetype);
      setArchetypeQuery(card.archetype);
    }

    toggleBossCard(card);
    showToast(`${card.name} locked in as an anchored card.`);
  }

  function removeAnchoredCard(cardName: string) {
    removeBossCardByName(cardName);
    showToast(`${cardName} removed from anchored cards.`);
  }

  function removeAnchoredTheme(themeName: string) {
    removeThemeAnchor(themeName);
    showToast(`${themeName} removed from theme anchors.`);
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
    showToast(`${filename} exported.`);
  }

  async function generateDeck(overrides?: {
    buildIntent?: typeof buildIntent;
    constraints?: typeof constraints;
    preferredDeckVersion?: string | null;
  }) {
    const rawTheme = theme ?? {
      query: archetypeQuery.trim(),
      resolvedArchetype: null,
      resolvedBossCards: [],
      resolvedSupportCards: [],
      inactiveBossCards: [],
      inactiveSupportCards: [],
    };
    const activeTheme = {
      query: typeof rawTheme.query === "string" ? rawTheme.query : "",
      resolvedArchetype:
        typeof rawTheme.resolvedArchetype === "string" || rawTheme.resolvedArchetype === null
          ? rawTheme.resolvedArchetype
          : null,
      resolvedBossCards: normalizeStringArray(rawTheme.resolvedBossCards),
      resolvedSupportCards: normalizeStringArray(rawTheme.resolvedSupportCards),
      inactiveBossCards: normalizeStringArray(rawTheme.inactiveBossCards),
      inactiveSupportCards: normalizeStringArray(rawTheme.inactiveSupportCards),
    };
    const nextBuildIntent = overrides?.buildIntent ?? buildIntent;
    const nextConstraints = normalizeConstraintArray(overrides?.constraints ?? constraints) as typeof constraints;
    const nextPreferredDeckVersion =
      typeof overrides?.preferredDeckVersion === "string" || overrides?.preferredDeckVersion === null
        ? overrides.preferredDeckVersion
        : selectedDeckVersion;
    const seedEntries = [...main, ...extra, ...side]
      .filter((entry) => entry.locked)
      .map((entry) => ({
        cardId: entry.card.id,
        quantity: entry.quantity,
        section: entry.section,
      }));
    const activeThemeLabel =
      activeTheme.resolvedArchetype ??
      activeTheme.resolvedSupportCards[0] ??
      activeTheme.resolvedBossCards[0] ??
      activeTheme.query.trim() ??
      main[0]?.card.name ??
      extra[0]?.card.name ??
      side[0]?.card.name;

    if (!activeThemeLabel && seedEntries.length === 0) {
      setErrorMessage("Pick a theme, anchor a card, or add a few cards to the deck before generating.");
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
          preferredDeckVersion: nextPreferredDeckVersion,
          seedEntries,
          buildIntent: nextBuildIntent,
          strengthTarget,
          constraints: nextConstraints,
        }),
      });

      setGeneratedDeck(generatedDeck);
      showToast(
        activeThemeLabel
          ? `${activeThemeLabel} deck generated.`
          : "Deck generated around your selected cards.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate Yu-Gi-Oh deck.");
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
    await generateDeck({
      buildIntent: option.buildIntent,
      constraints: option.constraints,
    });
  }

  async function applyDeckVersion(versionId: string | null) {
    setSelectedDeckVersion(versionId);
    await generateDeck({
      preferredDeckVersion: versionId,
    });
  }

  function handleAddCard(card: YugiohCard, section: YugiohDeckSection) {
    addCard(card, section);
    showToast(`${card.name} added to ${formatSectionForToast(section)}.`);
  }

  function handleRemoveCopy(card: YugiohCard, section: YugiohDeckSection) {
    decrementCard(card.id, section);
    showToast(`${card.name} reduced in ${formatSectionForToast(section)}.`);
  }

  function handleRemoveCard(card: YugiohCard, section: YugiohDeckSection) {
    removeCard(card.id, section);
    showToast(`${card.name} removed from ${formatSectionForToast(section)}.`);
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
            onClick={() => void generateDeck()}
            disabled={isGenerating}
          >
            {isGenerating ? "Building deck..." : "⚡ Build deck"}
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

          {/* Archetype */}
          <div className="ygo-forge-control-block">
            <p className="ygo-forge-label">Archetype / theme</p>
            <div className="ygo-archetype-search-wrapper">
              <input
                id="yugioh-archetype-search"
                className="app-input"
                placeholder="Blue-Eyes, Sky Striker, Tenpai..."
                value={archetypeQuery}
                autoComplete="off"
                onFocus={() => {
                  if (archetypeQuery.trim().length >= 2) {
                    setIsArchetypeDropdownOpen(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => setIsArchetypeDropdownOpen(false), 120);
                }}
                onChange={(event) => {
                  setErrorMessage(null);
                  const nextValue = event.target.value;
                  setIsArchetypeDropdownOpen(nextValue.trim().length >= 2);
                  setArchetypeQuery(nextValue);
                  setThemeQuery(nextValue);
                  if (nextValue.trim().length < 2) {
                    setArchetypes([]);
                  }
                }}
              />
              {isArchetypeDropdownOpen && showArchetypeResults && (archetypes.length > 0 || archetypeQuery.trim().length >= 2) ? (
                <div className="ygo-archetype-dropdown">
                  {archetypes.map((archetype) => (
                    <button
                      key={archetype.id}
                      type="button"
                      className={`ygo-archetype-dropdown-item ${
                        activeThemeAnchors.includes(archetype.name) || inactiveThemeAnchors.includes(archetype.name)
                          ? "active"
                          : ""
                      }`}
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
                      onClick={() => addThemeToAnchors(archetypeQuery.trim())}
                    >
                      <span>+</span>
                      <span>Add &ldquo;{archetypeQuery.trim()}&rdquo; as a theme anchor</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="primary-button ygo-theme-anchor-button"
              onClick={() => addThemeToAnchors(archetypeQuery)}
              disabled={!archetypeQuery.trim()}
            >
              Add theme anchor
            </button>
            <div className="ygo-forge-seeds">
              {STARTER_THEME_SEEDS.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  className={`ygo-forge-seed ${
                    activeThemeAnchors.includes(seed) || inactiveThemeAnchors.includes(seed) ? "active" : ""
                  }`}
                  onClick={() => {
                    setArchetypeQuery(seed);
                  }}
                >
                  {seed}
                </button>
              ))}
            </div>
          </div>

          {(activeThemeAnchors.length > 0 ||
            inactiveThemeAnchors.length > 0 ||
            activeBossAnchors.length > 0 ||
            inactiveBossAnchors.length > 0) ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Anchored themes and cards</p>
              <div className="ygo-anchored-stack">
                {activeThemeAnchors.map((themeName) => (
                  <article key={themeName} className="ygo-anchored-card">
                    <div className="ygo-anchored-card-top">
                      <span className="ygo-anchored-tag">Theme</span>
                      <div className="ygo-anchored-actions">
                        <button
                          type="button"
                          className="ygo-anchored-toggle"
                          onClick={() => {
                            toggleThemeAnchorActive(themeName);
                            showToast(`${themeName} set inactive.`);
                          }}
                          aria-label={`Set ${themeName} inactive`}
                          aria-pressed={true}
                        >
                          Disable
                        </button>
                        <button
                          type="button"
                          className="ygo-anchored-remove"
                          onClick={() => removeAnchoredTheme(themeName)}
                          aria-label={`Remove ${themeName} from theme anchors`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{themeName}</strong>
                    <small>Theme anchor</small>
                  </article>
                ))}
                {inactiveThemeAnchors.map((themeName) => (
                  <article key={`inactive-${themeName}`} className="ygo-anchored-card is-inactive">
                    <div className="ygo-anchored-card-top">
                      <span className="ygo-anchored-tag is-inactive">Theme</span>
                      <div className="ygo-anchored-actions">
                        <button
                          type="button"
                          className="ygo-anchored-toggle is-inactive"
                          onClick={() => {
                            toggleThemeAnchorActive(themeName);
                            showToast(`${themeName} reactivated.`);
                          }}
                          aria-label={`Reactivate ${themeName}`}
                          aria-pressed={false}
                        >
                          Enable
                        </button>
                        <button
                          type="button"
                          className="ygo-anchored-remove"
                          onClick={() => removeAnchoredTheme(themeName)}
                          aria-label={`Remove ${themeName} from theme anchors`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{themeName}</strong>
                    <small>Saved theme anchor</small>
                  </article>
                ))}
                {activeBossAnchors.map((name) => (
                  <article key={name} className="ygo-anchored-card">
                    <div className="ygo-anchored-card-top">
                      <span className="ygo-anchored-tag">Locked</span>
                      <div className="ygo-anchored-actions">
                        <button
                          type="button"
                          className="ygo-anchored-toggle"
                          onClick={() => {
                            toggleBossAnchorActive(name);
                            showToast(`${name} set inactive.`);
                          }}
                          aria-label={`Set ${name} inactive`}
                          aria-pressed={true}
                        >
                          Disable
                        </button>
                        <button
                          type="button"
                          className="ygo-anchored-remove"
                          onClick={() => removeAnchoredCard(name)}
                          aria-label={`Remove ${name} from anchored cards`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{name}</strong>
                    <small>Anchored card</small>
                  </article>
                ))}
                {inactiveBossAnchors.map((name) => (
                  <article key={`inactive-boss-${name}`} className="ygo-anchored-card is-inactive">
                    <div className="ygo-anchored-card-top">
                      <span className="ygo-anchored-tag is-inactive">Locked</span>
                      <div className="ygo-anchored-actions">
                        <button
                          type="button"
                          className="ygo-anchored-toggle is-inactive"
                          onClick={() => {
                            toggleBossAnchorActive(name);
                            showToast(`${name} reactivated.`);
                          }}
                          aria-label={`Reactivate ${name}`}
                          aria-pressed={false}
                        >
                          Enable
                        </button>
                        <button
                          type="button"
                          className="ygo-anchored-remove"
                          onClick={() => removeAnchoredCard(name)}
                          aria-label={`Remove ${name} from anchored cards`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <strong>{name}</strong>
                    <small>Saved anchored card</small>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

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
                <small>Combo-first setup. Push your strongest opening board.</small>
              </button>
              <button
                type="button"
                className={`yugioh-turn-card ${turnPreference === "going-second" ? "yugioh-turn-card-active" : ""}`}
                onClick={() => setTurnPreference("going-second")}
              >
                <span className="yugioh-turn-icon">💥</span>
                <strong>Going Second</strong>
                <small>Board-breaking plan. More breakers and pressure cards.</small>
              </button>
            </div>
          </div>

          {/* Power Level */}
          <div className="ygo-forge-control-block">
            <p className="ygo-forge-label">Power Level</p>
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

          {/* Deck variants */}
          {showQuickRebuilds ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Deck variants</p>
              <div className="yugioh-rebuild-grid">
                {quickRebuildOptions.map((option, index) => (
                  <button
                    key={`${option.id}-${index}`}
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

          <div className="ygo-forge-control-block ygo-forge-search-spotlight">
            <div className="ygo-forge-search-header ygo-forge-search-header-stack">
              <div>
                <p className="ygo-forge-label">Card search</p>
                <h2 className="ygo-forge-search-title">Add any card to your deck</h2>
                <p className="empty-copy ygo-forge-search-copy">
                  Search the full card pool, lock in whatever you want, then print the exact list you built.
                </p>
              </div>
            </div>
            <input
              id="yugioh-card-search"
              className="app-input ygo-forge-search-input"
              placeholder="Search any card, staple, boss monster, hand trap, or tech..."
              value={cardQuery}
              onChange={(event) => {
                setErrorMessage(null);
                const nextValue = event.target.value;
                setCardQuery(nextValue);
                if (nextValue.trim().length < 2) {
                  setCards([]);
                }
              }}
            />
            {showCardResults && cards.length === 0 ? (
              <p className="empty-copy ygo-search-empty">No matches yet. Try a full card name or a shorter keyword.</p>
            ) : null}
            {showCardResults && cards.length > 0 ? (
              <div className="ygo-compact-result-list ygo-spotlight-result-list">
                {cards.map((card) => {
                  const suggestedSection = inferDeckSection(card);
                  const suggestedCopies =
                    suggestedSection === "extra" ? countCopies(extra, card.id) : countCopies(main, card.id);
                  const sideCopies = countCopies(side, card.id);
                  const bossCardSelected =
                    activeBossAnchors.includes(card.name) || inactiveBossAnchors.includes(card.name);

                  return (
                    <div key={card.id} className="ygo-compact-card-item">
                      <button
                        type="button"
                        className="ygo-card-preview-trigger"
                        onClick={() =>
                          togglePreviewCard({
                            name: card.name,
                            typeLine: card.typeLine,
                            image: card.images.full || card.images.small || "",
                            desc: card.desc,
                          })
                        }
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
                      </button>
                      <div className="ygo-compact-card-copy">
                        <strong>{card.name}</strong>
                        <small>{card.typeLine}</small>
                      </div>
                      <div className="ygo-compact-card-actions">
                        <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => handleAddCard(card, suggestedSection)}>
                          +{suggestedCopies > 0 ? suggestedCopies : ""}
                        </button>
                        <button type="button" className="ygo-filter-chip" style={{padding: '0.2rem 0.5rem', margin: 0}} onClick={() => handleAddCard(card, "side")}>
                          S{sideCopies > 0 ? sideCopies : ""}
                        </button>
                        <button
                          type="button"
                          className={`ygo-filter-chip ${bossCardSelected ? "tag-pill-active" : ""}`}
                          style={{padding: '0.2rem 0.5rem', margin: 0, background: bossCardSelected ? 'rgba(59, 130, 246, 0.4)' : undefined, color: bossCardSelected ? '#fff' : undefined}}
                          onClick={() => anchorCard(card)}
                          title="Lock as anchored card"
                        >
                          ⚓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

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
              <strong>No deck yet</strong>
              <p className="empty-copy">Pick a theme on the left, then use the card search above to build exactly what you want to print and test.</p>
            </div>
          ) : null}

          <div className="yugioh-deck-grid">
            <DeckSectionPanel
              title="Main Deck"
              section="main"
              entries={main}
              onAddCopy={handleAddCard}
              onRemoveCopy={handleRemoveCopy}
              onRemoveCard={handleRemoveCard}
              hoverPreviewCard={hoverPreviewCard}
              onTogglePreview={togglePreviewCard}
            />
            <DeckSectionPanel
              title="Extra Deck"
              section="extra"
              entries={extra}
              onAddCopy={handleAddCard}
              onRemoveCopy={handleRemoveCopy}
              onRemoveCard={handleRemoveCard}
              hoverPreviewCard={hoverPreviewCard}
              onTogglePreview={togglePreviewCard}
            />
            <DeckSectionPanel
              title="Side Deck"
              section="side"
              entries={side}
              onAddCopy={handleAddCard}
              onRemoveCopy={handleRemoveCopy}
              onRemoveCard={handleRemoveCard}
              hoverPreviewCard={hoverPreviewCard}
              onTogglePreview={togglePreviewCard}
            />
          </div>
        </div>

        {/* RIGHT — Analysis */}
        <div className="ygo-forge-right">

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

          {totalDeckCards > 0 && buildReads.length > 0 ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Deck notes</p>
              <div className="yugioh-note-list">
                {buildReads.map((note, index) => (
                  <article key={`${note}-${index}`} className="summary-card yugioh-signal-card yugioh-signal-card-neutral">
                    <p className="empty-copy">{note}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {/* Popular versions */}
          {deckVersions.length > 0 ? (
            <div className="ygo-forge-control-block">
              <p className="ygo-forge-label">Popular deck versions</p>
              <div className="yugioh-meta-chip-grid">
                <button
                  type="button"
                  className={`summary-card yugioh-meta-chip ${selectedDeckVersion === null ? "is-selected" : ""}`}
                  onClick={() => void applyDeckVersion(null)}
                >
                  <strong>All popular versions</strong>
                  <small>Blend the strongest common lines together</small>
                </button>
                {deckVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={`summary-card yugioh-meta-chip ${
                      selectedDeckVersion === version.id ? "is-selected" : ""
                    }`}
                    onClick={() => void applyDeckVersion(version.id)}
                  >
                    <strong>{version.label}</strong>
                    <small>{version.count} matching list{version.count === 1 ? "" : "s"}</small>
                  </button>
                ))}
              </div>
              {deckVersions.length > 0 ? (
                <div className="yugioh-sample-list" style={{ marginTop: '0.5rem' }}>
                  {(deckVersions.find((version) => version.id === selectedDeckVersion)?.sampleDecks ??
                    deckVersions[0]?.sampleDecks ??
                    matchedDeckSamples.slice(0, 3)).map((deck, index) => (
                    <a
                      key={`${deck.deckUrl}-${index}`}
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

        </div>
      </div>

      {toastMessage ? <div className="ygo-toast" aria-live="polite">{toastMessage}</div> : null}

      {/* Card preview */}
      {hoverPreviewCard?.image ? (
        <div className="ygo-floating-preview" aria-live="polite">
          <div className="ygo-floating-preview-card">
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
