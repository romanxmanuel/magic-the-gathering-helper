# Scoring Model

This document defines the first planned heuristic scoring system for Yu-Gi-Oh deck generation.

## Purpose

The scoring model exists to help the generator choose between candidate deck shells in a way that is:

- structural
- explainable
- archetype-aware
- source-aware

It is not meant to perfectly solve deckbuilding. It is meant to produce strong, defensible first-pass lists.

## Scoring Philosophy

Priority order:

1. structural viability
2. archetype coherence
3. user intent alignment
4. meta tuning

That order prevents the generator from creating flashy anti-meta lists that are internally weak.

## Score Categories

Recommended initial breakdown:

### 1. Consistency
Measures:
- access to starters
- search redundancy
- access to core engine pieces
- opener reliability

### 2. Synergy
Measures:
- card-role coherence
- archetype alignment
- engine compatibility
- payoff density relative to enablers

### 3. Anti-meta alignment
Measures:
- relevant board breakers
- relevant interaction patterns
- matchup tech aligned to chosen targets

### 4. Recovery
Measures:
- ability to play after disruption
- grind tools
- recursive resource access

### 5. Opener quality
Measures:
- number of live opening combinations
- dead-card overlap in common hands
- hand texture quality

### 6. Section balance
Measures:
- whether Main / Extra / Side sections are internally sensible
- whether Extra Deck slots match the deck's real lines
- whether side cards belong in side or were mistakenly forced into main

### 7. Brick risk penalty
Measures:
- garnet concentration
- low-utility multiples
- setup-dependent cards with weak access
- overlapping dead draws

This should be a penalty, not a positive category.

## Example Weighting

Initial weighting proposal:

```text
Consistency          0.26
Synergy              0.22
Anti-meta alignment  0.14
Recovery             0.12
Opener quality       0.16
Section balance      0.10
Brick risk penalty  -0.20
```

These values are planning defaults. They should be tuned after real deck comparisons.

## Intent-Based Reweighting

The score should shift based on user intent.

### `consistency-first`
- raise consistency weight
- raise opener-quality weight
- raise brick-risk penalty
- lower ceiling-driven package tolerance

### `ceiling-first`
- raise synergy weight
- raise payoff tolerance
- lower brick-risk sensitivity slightly

### `blind-second`
- raise anti-meta alignment for board-breaking tools
- lower emphasis on go-first-only interruptions

### `grind`
- raise recovery weight
- raise long-game non-engine value

### `anti-meta`
- raise anti-meta alignment
- require source-backed target data

## Structural Rules

The first scoring model should enforce hard or semi-hard rules before fine scoring begins.

Examples:
- candidate must have a coherent Main / Extra / Side split
- candidate must meet a minimum engine access threshold
- candidate must not exceed a configured brick-risk ceiling
- candidate must not create obvious internal conflicts if the rules layer can detect them

These structural gates should happen before final scoring.

## Explanation Hooks

Each score category should produce explanation hooks.

Examples:
- `Consistency is high because the deck has 13 starter-access cards in the current model.`
- `Brick risk is elevated because three cards require prior engine setup and are weak in multiples.`
- `Anti-meta score is medium because the selected target archetypes favor faster pressure than this shell currently provides.`

That makes the score useful instead of decorative.

## Data Inputs

The scoring model should consume:
- role labels
- card sections
- source-backed inclusion frequency
- chosen build intent
- chosen meta targets
- user constraints

It should not consume:
- unsupported live-meta assumptions
- hidden LLM guesses about current tier positions

## Future Expansion

The scoring model can grow later to include:
- opening-hand simulation outputs
- combo-line success rates
- matchup-specific testing outputs
- user feedback loops

The first version should stay explainable and easy to debug.
