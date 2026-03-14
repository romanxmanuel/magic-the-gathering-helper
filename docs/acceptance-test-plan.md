# Acceptance Test Plan

This document defines how to verify the planned milestones before and during implementation.

It is not a test suite. It is a practical definition-of-done reference.

## Test Philosophy

Acceptance tests should verify:
- product boundaries
- route correctness
- honest source behavior
- structural correctness
- print behavior

They should focus on user-visible outcomes and architecture-critical guarantees.

## Phase 1: Dual-Game Shell

### Goal
Verify that the repo has become a dual-product shell without breaking MTG.

### Acceptance checks
- `/` no longer renders the MTG builder directly
- `/` presents a launcher or last-used-game redirect
- `/mtg` renders the current MTG builder
- `/mtg/print` renders the current MTG print flow
- `/yugioh` renders a deliberate placeholder or early builder shell
- top game switcher is visible and usable
- active game state is visually obvious
- MTG local state still persists correctly

### Failure conditions
- MTG functionality regresses
- navigation feels ambiguous
- store or route names still imply MTG is the whole app

## Phase 2: Yu-Gi-Oh Data Layer

### Goal
Verify that Yu-Gi-Oh search and source normalization are real.

### Acceptance checks
- card search returns normalized Yu-Gi-Oh card records
- archetype search returns meaningful results
- every result has explicit source metadata
- image references are normalized into the app's image shape
- the UI never implies legal validation if none exists

### Failure conditions
- the app exposes raw source data without normalization
- source provenance is missing
- card search behaves inconsistently across similar queries

## Phase 3: Meta Corpus

### Goal
Verify that meta-aware features are backed by a real corpus.

### Acceptance checks
- meta endpoint returns freshness state
- meta endpoint returns source audit
- common package suggestions can be traced to real sources
- stale data is visibly marked stale

### Failure conditions
- the app claims current meta knowledge with no stored snapshot
- source timestamps are absent
- stale data looks current

## Phase 4: Yu-Gi-Oh Generator MVP

### Goal
Verify that generated decks are structurally reasonable and explainable.

### Acceptance checks
- user can input a theme and generate a deck
- deck is split into `Main / Extra / Side`
- generated deck includes explanation blocks
- generated deck includes role labels
- generated deck includes score categories
- smart options are present only when relevant

### Structural acceptance checks
- Main Deck size is reasonable for the chosen plan
- Extra Deck contains relevant payoffs or utility cards
- Side Deck recommendations are clearly separated
- generator does not include obviously contradictory packages without explanation

### Failure conditions
- deck reads like a random popularity pile
- explanations are vague or generic
- no distinction between core and flex logic

## Phase 5: Print System

### Goal
Verify that both games can support personal playtest printing.

### Acceptance checks
- `/mtg/print` still works
- `/yugioh/print` renders a print-ready layout
- calibration guidance exists
- print CSS produces clean sheet layout
- browser PDF export produces usable output

### Failure conditions
- print layout drifts unpredictably
- card sizing is not isolated by game
- proxy sheets are not cut-friendly

## Source-Honesty Tests

These checks should always pass across the app:
- no meta claim appears without source backing
- no source-backed recommendation appears without freshness context
- no community source is presented as official
- no planned feature is described as already shipped

## Regression Checklist For Every Major Milestone

- MTG routes still work
- MTG print still works
- README reflects current shipped reality
- docs remain consistent with implementation
- route split remains clean
- preview overlay behavior remains stable

## Manual Demo Scenarios

These are useful demo cases once implementation begins.

### MTG demo
- open `/mtg`
- generate a Commander deck
- tweak the list
- print the proxy sheet

### Yu-Gi-Oh demo
- open `/yugioh`
- choose `Sky Striker`, `Yubel`, or `Tenpai`
- generate a deck with an explicit build intent
- inspect explanations
- apply a rebuild option
- open print view

## Release Readiness Rule

Do not call a phase done because the code compiles.

A phase is done when:
- its acceptance checks pass
- its docs are still accurate
- its product boundaries remain clear
