# MVP Boundaries

This document defines what the repository should and should not try to ship in the first major dual-product milestone.

## Why This Exists

The planning package is intentionally ambitious. Without explicit MVP boundaries, implementation can easily sprawl into:
- too much UI work too early
- too much generator complexity too early
- too much scraping and image infrastructure too early

This document keeps the first release practical and high quality.

## MVP Definition

The first meaningful dual-product milestone should deliver:

- a clean shared shell for both games
- a stable MTG route split
- a real Yu-Gi-Oh builder foundation
- a first-pass Yu-Gi-Oh generator with explainable structure
- a working Yu-Gi-Oh proxy print workflow

It does not need to deliver every advanced intelligence feature.

## Included In The MVP

### Shared platform
- route-based split between `/mtg` and `/yugioh`
- shared top header
- shared game switcher
- launcher page at `/`
- shared preview overlay behavior

### MTG
- existing MTG behavior preserved under `/mtg`
- existing MTG print workflow preserved under `/mtg/print`

### Yu-Gi-Oh
- `Open Lab` mode
- theme or archetype input
- build intent controls
- strength target controls
- meaningful constraints
- Main / Extra / Side shell generation
- card role labels
- explanation blocks
- heuristic scoring
- source-audit metadata
- manual tuning after generation
- proxy print route

### Printing
- browser print
- PDF-friendly print CSS
- calibration support
- game-specific print profiles

## Explicitly Out Of Scope For The MVP

These are valuable, but should not block the first release:

- Master Duel mode
- Edison / GOAT / retro formats
- full legal tournament validation
- `.ydk` import/export
- account system
- cloud sync
- price tracking
- collection management
- full combo solver
- polished matchup simulator
- full PDF generation service

## Partial Features Allowed In MVP

These may ship in reduced form:

### Meta awareness
Allowed:
- source-backed archetype trends
- source-backed common package suggestions

Not required yet:
- fully automated matchup strategy engine

### Opening-hand simulation
Allowed:
- post-MVP or late-MVP if time allows

### Image caching
Allowed:
- staged implementation
- thumbnails may start remote

Required before treating print as stable:
- a plan for reliable full-card print assets

## MVP Quality Bar

Even the MVP should meet these standards:

- no fake meta claims
- no generic one-size-fits-all Yu-Gi-Oh options
- no architecture that blends MTG and Yu-Gi-Oh domain logic together
- no print flow that lies about sizing confidence
- no docs that imply a feature is shipped when it is only planned

## Recommended MVP Sequence

1. shared shell
2. MTG route isolation
3. Yu-Gi-Oh data layer
4. Yu-Gi-Oh builder shell
5. generator MVP
6. print MVP

That is the smallest sequence that still creates a strong employer-facing story.

## Employer-Facing Story

The MVP should read as:

- a clean dual-product TCG platform
- one mature MTG product
- one serious, well-architected Yu-Gi-Oh MVP

It should not read as:
- a half-migrated MTG app
- a speculative Yu-Gi-Oh prototype with no coherent system design
