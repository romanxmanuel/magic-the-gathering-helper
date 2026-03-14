# Implementation Backlog

This document turns the architecture and planning docs into a concrete execution checklist.

## Phase 0: Documentation Baseline

Goal:
- make the planned direction explicit before major code movement

Checklist:
- [x] architecture document
- [x] data-sources document
- [x] deck-generation philosophy document
- [x] printing document
- [x] meta-pipeline document
- [x] Yu-Gi-Oh product overview
- [x] types and API contract plan
- [x] heuristic scoring plan

## Phase 1: Dual-Game Shell

Goal:
- turn the repo into a dual-product site without changing MTG behavior

Tasks:
- [ ] change app metadata from MTG-only branding to shared-site branding
- [ ] add shared header with top game switcher
- [ ] move current MTG home flow under `/mtg`
- [ ] keep `/` as launcher or route redirect
- [ ] move MTG print flow under `/mtg/print`
- [ ] introduce `src/components/shell/*`
- [ ] introduce `src/store/app-store.ts`
- [ ] rename MTG store to `mtg-store.ts`

Acceptance criteria:
- [ ] MTG app still works exactly as before
- [ ] navigation cleanly separates MTG and Yu-Gi-Oh
- [ ] repo no longer looks like Yu-Gi-Oh would be a hacked-on side feature

## Phase 2: Shared Domain Scaffolding

Goal:
- make room for separate game domains

Tasks:
- [ ] create `src/lib/games/shared/*`
- [ ] move current MTG domain under `src/lib/games/mtg/*`
- [ ] create empty `src/lib/games/yugioh/*`
- [ ] create empty `src/components/yugioh/*`
- [ ] create empty `/api/yugioh/*` route scaffolds
- [ ] add shared `SourceAudit` and `PrintProfile` types

Acceptance criteria:
- [ ] MTG still builds
- [ ] folder structure clearly reflects two products

## Phase 3: Yu-Gi-Oh Data Layer

Goal:
- make Yu-Gi-Oh card and archetype search real

Tasks:
- [ ] implement YGOPRODeck client
- [ ] implement archetype search route
- [ ] implement card search route
- [ ] normalize Yu-Gi-Oh card images into shared image shape
- [ ] add source-audit data to every response
- [ ] document image-hosting/cache strategy

Acceptance criteria:
- [ ] user can search cards
- [ ] user can search archetypes
- [ ] every result has a source boundary

## Phase 4: Meta Corpus Ingestion

Goal:
- give the Yu-Gi-Oh builder a real, explicit meta corpus

Tasks:
- [ ] define snapshot schema
- [ ] ingest recent public deck pages
- [ ] group snapshots by archetype
- [ ] compute common inclusion frequencies
- [ ] compute source freshness state
- [ ] expose `/api/yugioh/meta`

Acceptance criteria:
- [ ] app can show source-backed meta data
- [ ] app never claims live meta knowledge without a snapshot

## Phase 5: Yu-Gi-Oh Builder MVP

Goal:
- generate a structurally reasonable Yu-Gi-Oh deck shell

Tasks:
- [ ] implement theme resolver
- [ ] implement role classifier
- [ ] implement deck constructor
- [ ] implement structural scoring
- [ ] create `yugioh-builder-app.tsx`
- [ ] create separate Yu-Gi-Oh store
- [ ] support Main / Extra / Side sections
- [ ] surface build notes

Acceptance criteria:
- [ ] user can choose a theme and generate a deck
- [ ] deck is split into correct sections
- [ ] deck has explanations and role labels

## Phase 6: Dynamic Tuning

Goal:
- make the generator feel smart and iteration-friendly

Tasks:
- [ ] generate dynamic option sets from theme + intent + meta
- [ ] add rebuild actions such as consistency-first and anti-meta
- [ ] add card-level rationale
- [ ] add core / flex / tech grouping
- [ ] add preferred-card and excluded-card support

Acceptance criteria:
- [ ] options are not generic
- [ ] rebuilds clearly explain what changed

## Phase 7: Printing System

Goal:
- make Yu-Gi-Oh proxy printing feel first-class

Tasks:
- [ ] add `/yugioh/print`
- [ ] create Yu-Gi-Oh print profile
- [ ] add calibration page
- [ ] add PDF-friendly print CSS
- [ ] normalize print-quality image handling

Acceptance criteria:
- [ ] user can print cut-ready Yu-Gi-Oh sheets
- [ ] calibration works
- [ ] image handling is honest and stable

## Phase 8: Advanced Intelligence

Goal:
- add the features that make the Yu-Gi-Oh side exceptional

Tasks:
- [ ] opening-hand simulator
- [ ] combo line viewer
- [ ] matchup tuning
- [ ] meta-hunt mode
- [ ] replacement reasoning

Acceptance criteria:
- [ ] the app goes beyond "decklist generator" into "deck lab"

## Nice-To-Have Later

- [ ] Master Duel mode
- [ ] retro format support
- [ ] `.ydk` import/export
- [ ] account syncing
- [ ] shared persistence backend
