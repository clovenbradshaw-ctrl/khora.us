# apps/eodb/

EO///DB — the EO database workbench.

## Source of truth for §17

The upstream is `clovenbradshaw-ctrl/EO-DB`. Its `src/components/` and `src/blocks/` inventories — universal views, EO-aware controls, schema editors, the Notion-style block composer, collaboration surfaces — are the reference implementations that SPEC §17 generalizes into the bootstrap chrome and the `@khora/ui` library.

Practical consequence: EO-DB is not just an app to port; it is the library's first consumer. The Phase 7 port is also the migration where EO-DB stops maintaining its own component set and starts importing from `@khora/ui`. By that point, wire (Phase 2) and eo-wiki (Phase 3) have already exercised the library, so EO-DB's import is the validation step, not the bootstrap step.

## Planned scope

A generic schema operating on any EO data room. The nine-operator fold (NUL, DES, INS, SEG, CON, SYN, DEF, EVA, REC; SPEC §8) becomes the user-facing query and aggregation primitives.

Because every event in any data room carries `content.eo.{operator, site, resolution}` (SPEC §4.2), EO///DB doesn't need to know the payload schema to operate. Operator counts, site rollups, resolution timelines, REC traces all work generically — and these surfaces are the ones SPEC §17.2.2 standardizes (`<OperatorFilter />`, `<SiteFacet />`, `<ResolutionFacet />`, `<RecTrace />`, `<SnapshotDiff />`, `<OperatorRibbon />`, `<Horizon />`).

## What does NOT come over

Vendor integrations (Airtable sync, Google Calendar, OAuth, n8n webhooks), GPU acceleration, and the natural-language interface stay app-side or are dropped. SPEC §17.5 enumerates explicitly what is not standardized and why.

## Phase

Phase 7 (alongside eoReader and Anchorage). Depends on bootstrap MVP + write path + snapshots + `@khora/ui` extraction (§17.7 step 17b) being live.
