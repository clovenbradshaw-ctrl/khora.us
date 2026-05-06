# apps/eodb/

EO///DB — the EO database workbench.

## Planned scope

A generic schema operating on any EO data room. The nine-operator fold (NUL, DES, INS, SEG, CON, SYN, DEF, EVA, REC; SPEC §8) becomes the user-facing query and aggregation primitives.

Because every event in any data room carries `content.eo.{operator, site, resolution}` (SPEC §4.2), EO///DB doesn't need to know the payload schema to operate. Operator counts, site rollups, resolution timelines, REC traces all work generically.

## Phase

Phase 7 (alongside eoReader and Anchorage). Depends on bootstrap MVP + write path + snapshots being live.
