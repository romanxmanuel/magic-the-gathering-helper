# Magic the Gathering Helper

Commander-first MTG deck builder with printable proxy sheets, meta-backed recommendations, combo-pressure checks, and a deck list that stays easy to tune.

## Overview

Magic the Gathering Helper is built for Commander players who want to:

- choose a commander or color identity
- generate a playable 100-card shell
- tune the list by hand
- check whether the deck is drifting sharper than intended
- print true-size proxy sheets for testing

The app is designed to stay lightweight enough for Vercel while still pulling from strong free data sources across the Commander ecosystem.

## Features

- Commander-only deck building flow
- Commander search plus color-identity discovery
- Power presets from casual battlecruiser up to very sharp shells
- EDHREC-backed synergy tags and meta context
- Commander Spellbook combo-pressure and bracket estimation
- Manual add/remove tuning after generation
- Card thumbnails in the deck list with larger hover preview
- Printable 2.5in x 3.5in proxy sheets

## Data Sources

- `Scryfall`
  Card search, legality, oracle text, and high-resolution card images
- `EDHREC`
  Commander popularity, theme tags, recommendation buckets, and average deck-shape context
- `Commander Spellbook`
  Combo-aware signals and full-deck pressure estimation
- `Wizards of the Coast`
  Official Commander banned-list source

## Stack

- Next.js 16
- React 19
- TypeScript
- Zustand
- Tailwind CSS 4
- Zod

## Development

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run typecheck
npm run lint
npm run build
```

## Product Notes

- Deck state is persisted in the browser for a lightweight first version.
- The current build is focused on Commander, not Standard.
- Proxy sheets are meant for playtesting and customization workflows.

## License

MIT
