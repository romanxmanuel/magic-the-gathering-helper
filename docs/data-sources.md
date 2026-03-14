# Commander Data Sources

This project uses a layered free-source model so the app stays lightweight on Vercel while still understanding Commander, proxying, legality, and meta context.

## Primary Recommendation

### 1. Scryfall
- Role: canonical card database
- Why it wins:
  - complete card objects
  - Commander legality baked into each card object
  - `game_changer` now exposed directly on card objects
  - high-resolution images in multiple sizes, including `png`
  - daily bulk exports for local sync jobs if we later want offline caching
- Use here:
  - card search
  - legality and ban filtering
  - printable proxy images
  - oracle text and mechanics-aware UI copy
  - commander-safe card enrichment after EDHREC recommendation pulls

### 2. EDHREC
- Role: Commander meta and recommendation engine input
- Why it matters:
  - commander popularity and deck counts
  - salt scores
  - commander-specific recommendation panels like `High Synergy Cards`, `Top Cards`, `Game Changers`, `Lands`, and `Mana Artifacts`
  - popular tags and deck themes for commander pages
- Use here:
  - choosing strong commander candidates by color identity
  - building a first balanced deck from real Commander trends
  - exposing theme ideas users can tune around

### 3. Commander Spellbook
- Role: combo intelligence and extra Commander-specific card signals
- Why it helps:
  - combo search for Commander
  - `find-my-combos` endpoint
  - `estimate-bracket` endpoint
  - card records that expose Commander-relevant booleans like `tutor`, `massLandDenial`, `extraTurn`, and `gameChanger`
- Use here:
  - combo-aware deck notes
  - future bracket auditing
  - future combo-suggestion panel after a user tweaks a list

### 4. Wizards of the Coast
- Role: official format rules and Commander bracket wording
- Use here:
  - Commander rules copy
  - bracket explanations
  - official format descriptions for the app’s rules/help views

## Architecture Notes

- Runtime strategy:
  - fetch live data server-side with revalidation
  - cache aggressively on Vercel
  - avoid shipping a massive local card dataset to the browser
- Later sync strategy:
  - optional cron sync to snapshot top commander pages and common EDHREC commander JSON
  - optional bulk Scryfall ingestion into libSQL/Turso if we want faster fully local recommendation queries
- Print strategy:
  - use unmodified Scryfall full-card images
  - render at `63mm x 88mm` for true-size proxy sheets

## Source Notes

- Scryfall API docs: <https://scryfall.com/docs/api>
- Scryfall bulk data: <https://api.scryfall.com/bulk-data>
- EDHREC top commanders: <https://edhrec.com/commanders>
- Example EDHREC commander JSON: <https://json.edhrec.com/pages/commanders/atraxa-praetors-voice.json>
- Commander Spellbook API root: <https://backend.commanderspellbook.com/>
- Commander Spellbook about page: <https://commanderspellbook.com/about/>
- Wizards Commander format page: <https://magic.wizards.com/en/formats/commander>
- Wizards banned and restricted list: <https://magic.wizards.com/en/banned-restricted-list>
