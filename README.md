# Khora: A Developer's Guide

This document is written for a developer who is new to the project. It covers the problem Khora is built to solve, the Matrix protocol it runs on, and the data model and design principles that govern every architectural decision. Read this before touching anything.

---

## 0. The Problem Khora Is Built to Solve

Most software for managing people — case management systems, social services platforms, healthcare records, coordination tools — shares a common failure pattern. A central authority defines the schema. Orgs are onboarded into it. Data flows up to the center and down to workers through hierarchical access controls. The system assumes the org running it is the source of truth and the appropriate custodian of everyone's data.

This breaks in predictable ways.

**It's brittle.** The central schema can't anticipate every context. When a new org joins or a new kind of service emerges, you either force it into the existing model or the whole system needs a migration. Schemas designed top-down for one set of assumptions become obstacles the moment reality diverges — which it always does.

**It's hierarchical in the wrong ways.** A caseworker at an org can see a client's full record. The client often cannot. Providers share data about people without those people's knowledge or consent. The person the system is ostensibly serving is the last one with any actual control over their information.

**It collapses when nodes fail.** If the central server goes down, nobody can work. If an org leaves the network, their clients' histories go with them or become inaccessible. The system's resilience is only as good as its most critical single point of failure.

**It stifles emergence.** Because everything has to fit the central model, orgs can't try new approaches, adapt to local needs, or evolve their practices. Coordination happens through officially sanctioned channels only. Anything outside the model is invisible to the system.

### What Khora Does Instead

Khora is designed around a different set of assumptions, modeled more on how resilient natural systems work than on how institutions want to believe they work.

**The individual is the unit of sovereignty, not the org.** A person's data belongs to them. They control who can access it, at what level of detail, and they can revoke that access at any time. Providers can hold their own internal observations — assessments, notes, flags — but those belong to the provider. The client's sovereign record belongs to the client. These are two distinct domains that coexist without collapsing into each other.

**Teams are nodes, not org chart positions.** A "team" in Khora might be a shelter, a caseworker, a peer navigator, a family member, or an automated system. They collaborate around an individual through a shared space (a bridge room) but each node has its own degree of opacity — what it reveals to other nodes, what it keeps internal, what it contributes to the shared commons. Opacity is a spectrum the node controls, not a permission level an admin grants from above.

**The network is designed to survive node failure.** Orgs come and go. Servers go down. Caseworkers leave. Khora's architecture ensures that when a node fails, data doesn't vanish with it. Because data is distributed across the nodes that participate in it — and because the individual's own vault holds a denormalized copy of their record — the loss of any single node degrades gracefully rather than collapsing the whole.

**Schema is emergent, not decreed.** Orgs can define their own fields and evolve their own schemas. The network maintains a shared commons of definitions that any org can adopt or adapt, but no org is forced to conform to a top-down ontology. Definitions propagate through consensus mechanisms, not administrative fiat. Conflicting definitions can coexist — the system holds them in tension rather than forcing a premature resolution.

**Coordination emerges from the edges.** Rather than requiring a central authority to sanction every connection and approve every data flow, Khora allows orgs to try things: share data with a new partner, adopt a new field definition, form a new kind of team. If it works, it can spread. If it doesn't, the failure is local. This mirrors how coordination actually happens in functional human systems — iteratively, at the edges, through relationships — rather than through mandates from the center.

The architectural consequence of all this is that Khora's data layer needs to be fundamentally decentralized, encrypted, append-only, and resilient to partial network availability. That's why it's built on Matrix.

---

## 1. What Matrix Is

Matrix is an open, federated protocol for real-time communication and data storage — think of it as email, but for structured messages and data, with end-to-end encryption built in. Like email, you can have an account on one server and communicate seamlessly with someone on a completely different server. Unlike email, Matrix was designed from the start to be a foundation for applications, not just chat.

The two properties that make Matrix the right fit for Khora:

**Federation** means there is no central Matrix server. A "homeserver" is a server that stores accounts and room data for its users. When users from different homeservers join the same room, every homeserver involved keeps its own copy of that room's event history. Data doesn't live in one place — it's distributed across the servers of whoever participates. If one server goes down, the data survives on the others. This is what makes node failure graceful rather than catastrophic.

**End-to-end encryption (E2EE)** means messages are encrypted on the sender's device, not by the server. The homeserver never holds decryption keys. It stores ciphertext. Even the people running the infrastructure cannot read the contents of encrypted rooms. Khora uses this to store sensitive case management data — observations about clients, service records, personal information — in a way that infrastructure operators (including us) cannot access.

---

## 2. Core Matrix Concepts

### Homeservers and Accounts

A Matrix account looks like `@username:servername.com`. The part after the colon is the homeserver. Khora runs its own homeserver at `hyphae.social` (Synapse, the reference implementation). Users can join Khora with accounts on *any* Matrix server — they don't have to be on hyphae.social. The app works with whoever's server they're on.

### Rooms

A **room** is the fundamental unit of everything in Matrix. It's not just a chat room — it's a persistent, encrypted, append-only data container. Every piece of application data in Khora lives inside a Matrix room.

Rooms have:
- A permanent ID like `!opaque-string:servername.com`
- **Members** — accounts invited into the room
- **Access control** via power levels (integers: 0 = default user, 50 = moderator, 100 = admin)
- An append-only event log called the **timeline**
- **State** — a separate snapshot of the room's current configuration

### Events: The Atomic Unit

Everything in Matrix is an **event** — an immutable JSON object appended to a room's timeline. You never update or delete data; you append new events that supersede or reference old ones.

A Khora event looks like this:

```json
{
  "type": "io.khora.claim.event",
  "event_id": "$abc123:hyphae.social",
  "room_id": "!bridge_room:hyphae.social",
  "sender": "@caseworker:matrix.org",
  "origin_server_ts": 1700000000000,
  "content": {
    "id": "e1",
    "label": "Intake opened",
    "date": "2024-07-18",
    "blob_url": "mxc://hyphae.social/AbCdEfGh",
    "blob_hash": "sha256:abc..."
  }
}
```

The `type` field is a namespaced string — Khora uses the `io.khora.*` namespace for all its custom event types. Notice the event body is lightweight: a pointer and a hash. The actual claim data lives in the encrypted blob at `blob_url`. This is explained in Section 4.

### State Events vs. Timeline Events

This distinction is critical and you will use it constantly.

**Timeline events** are the append-only log. Every event is permanent. Claim events, messages, operation logs — these live in the timeline. You can read history but you can't change it.

**State events** are the room's current configuration. Each `(event_type, state_key)` pair has exactly one live value — the most recent event with that type and key supersedes all previous ones. Room membership, schema definitions, org metadata, and claim stack snapshots are all state events. Sending a state event is essentially an upsert.

```javascript
// Read current state
client.getStateEvent(roomId, "io.khora.schema.field", "field_dob")

// Write new state (overwrites previous value for this type+key)
client.sendStateEvent(roomId, "io.khora.schema.field", "field_dob", { ...newDefinition })
```

### The Event DAG and Eventual Consistency

Matrix rooms don't have a single linear timeline — they have a DAG (directed acyclic graph). When two servers process events concurrently, you get a fork. Matrix merges forks deterministically when servers sync. The result is eventual consistency: all participants eventually see the same state, even if they temporarily diverge.

For Khora: don't design anything that depends on strict global ordering of events. Timestamps are unreliable for ordering. Use Matrix's `prev_events` references if you need to reason about causality.

---

## 3. Encryption

Khora uses two encryption layers that operate at different levels.

### Layer 1: Megolm (Matrix Group Encryption)

Every Khora room is encrypted with Megolm. When you join an encrypted room:

1. Your device generates or receives a **megolm session** — a rotating symmetric key for the room
2. The session key is distributed to every member's registered devices
3. All events (timeline and state) are encrypted with the current session key before being sent to the server
4. The server stores only ciphertext and cannot read any room content

Megolm sessions rotate periodically and when membership changes, so new members can't decrypt old messages by default. This is why key backup and the escrow system exist.

### Layer 2: Per-Claim AES-256-GCM (on the blob)

Megolm encrypts the Matrix event envelope. But the actual claim data is encrypted *before* being uploaded, using **AES-256-GCM with provider-specific symmetric keys**.

This means:
- The Matrix event (the pointer) is Megolm-encrypted: only room members can read it
- The blob it points to is AES-256-GCM-encrypted: only the client and the specific authorized provider can decrypt it
- A legitimate room member who can read the event still cannot read claim data unless they hold the correct AES key

This two-layer model is what makes fine-grained opacity possible. The room defines *who can see that something happened*. The blob key defines *who can read what it contained*.

This is handled by `FieldCrypto.encryptClaim(claim, keyB64)` and `FieldCrypto.decryptClaim(encClaim, keyB64)` in `app/crypto.js`.

---

## 4. How Data Is Actually Stored: Blobs in the Matrix Media Server

This is the most important structural thing to understand, and it differs from how most Matrix apps work.

**Khora does not store claim data in Matrix event bodies. It stores encrypted blobs in the Matrix media server, and events are lightweight pointers to those blobs.**

### Why Blobs?

Matrix event bodies have size limits and are replicated across every federated homeserver participating in a room. For case management data — large, deeply structured, and highly sensitive — embedding full payloads in events is wasteful and creates encryption complexity. Blobs solve both problems: the sensitive payload is encrypted once with the right keys before it ever touches the network, and the event body stays small enough to be efficient at scale.

Because blobs are encrypted at rest with AES-256-GCM before upload, they could theoretically live on any content-addressed storage backend. Currently they live on hyphae.social's Synapse media store, but the architecture doesn't depend on that.

### The Write Path

```
1. Client builds a claim batch (ops + claim objects)
2. Client encrypts the batch locally: FieldCrypto.encryptClaim(batch, keyB64)
3. Client uploads the encrypted blob to the Matrix media server:
      POST /_matrix/media/v3/upload
      → returns mxc://hyphae.social/AbCdEfGh
4. Client computes SHA-256 of the ciphertext for integrity verification
5. Client sends a lightweight pointer event to the room timeline:
      {
        type: "io.khora.claim.event",
        content: {
          id: "e1",
          label: "Intake opened",
          date: "2024-07-18",
          blob_url: "mxc://hyphae.social/AbCdEfGh",
          blob_hash: "sha256:abc..."
        }
      }
```

### The Read Path

```
1. Sync produces an io.khora.claim.event timeline event
2. Extract blob_url and blob_hash from event content
3. Resolve mxc:// to HTTP: client.mxcUrlToHttp(blob_url)
4. Fetch the blob: GET https://hyphae.social/_matrix/media/v3/download/...
5. Verify SHA-256 against blob_hash — if mismatch, reject (tampered or corrupted)
6. Decrypt: FieldCrypto.decryptClaim(blob, keyB64)
7. Feed decrypted ops into ClaimEngine.replayTo() to reconstruct current state
```

### What This Means for Development

**Events are thin.** When you see an `io.khora.claim.event`, don't expect the data to be in it. Always fetch the blob.

**The media server is the database.** Room timelines are the index. Blobs are the data. Both are required to reconstruct state.

**Always verify the hash before decrypting.** This is not optional. A mismatched hash means the blob has been tampered with or is corrupt.

**Blobs are immutable.** Once uploaded, a blob is never modified. New claim states produce new blobs. The append-only semantics apply at the blob level, not just the event level.

**Matrix Content URIs look like `mxc://server/mediaId`.** Resolve them with `client.mxcUrlToHttp(mxcUrl)` from the SDK before fetching.

---

## 5. Khora's Room Topology

Khora organizes everything into four room types. This topology is the core of the architecture — understanding it makes everything else make sense.

```
NETWORK ROOM (1 per network)
  Purpose:  Shared schema commons, org membership, governance
  Members:  All org admin accounts + Khora bots
  Holds:    Schema field definitions, propagation rules, governance state, hash salt
  Encrypt:  Megolm only (no per-claim blobs — schema data is shared by design)

ORGANIZATION ROOM (1 per org)
  Purpose:  Org identity, staff, resources, local settings
  Members:  That org's staff accounts
  Holds:    Org identity, staff roster, resource catalog, inventory, local policy overrides
  Encrypt:  Megolm only

BRIDGE ROOM (1 per client ↔ provider relationship)
  Purpose:  The shared space where a provider and client collaborate
  Members:  Client account + provider staff accounts
  Holds:    Claim events (→ blobs), resource allocations, messages, operations
  Encrypt:  Megolm + per-claim AES-256-GCM blobs
  Note:     Contains TWO domains — subject-visible claims and provider-internal claims

CLIENT VAULT ROOM (1 per client)
  Purpose:  The client's sovereign, portable record — readable even offline
  Members:  Client account only (+ backup bot for federation resilience)
  Holds:    Denormalized shadow copies of all subject-domain claims from all bridges
  Encrypt:  Megolm + per-claim AES-256-GCM blobs
```

### The Two Domains Inside a Bridge Room

The bridge room is where most of the interesting complexity lives. It contains two distinct domains:

The **subject domain** holds claims the individual can see and share. These are the claims that get mirrored to the client's vault. The client controls which providers can access them via field-level access grants.

The **provider domain** holds provider-internal claims: supervisor flags, inferred risk assessments, internal case notes. The client doesn't see these — but they exist inside the bridge room, encrypted with the org's own keys. The client controls whether the bridge exists at all. If the client hard-revokes the bridge, the room is tombstoned and the provider's domain goes with it. The client never gains retroactive access to provider-internal claims they weren't shown, but they can cut off the provider entirely.

### The Vault Is Inviolable

Vault records are **denormalized by design**. Provider names, org names, resource names — all copied as plain strings, not as ID references. This ensures the vault remains human-readable even if the org dissolves, the bridge is severed, or hyphae.social itself goes offline. The vault's value is precisely that it doesn't depend on anything else to be legible.

---

## 6. The Claim Stack Model

This is the core data model. You must understand it before working on `app/claims.js`, `app/claim-store.js`, or any UI components.

### What Is a Claim Stack?

In a traditional system, a field like "housing status" has one value: `"Emergency Shelter"`. In Khora, it has a **stack of claims**, ordered newest-first, each carrying full provenance:

```
Field: "housing"
┌──────────────────────────────────────────────────────────────┐
│ h3 │ Permanent Housing  │ settled    │ mode: measured        │  ← current
│    │ @kim:server        │ 2024-11-02 │ supersedes h2         │
├──────────────────────────────────────────────────────────────┤
│ h2 │ Transitional       │ superseded │ mode: observed        │
│    │ @jreyes:server     │ 2024-09-14 │ supersedes h1         │
├──────────────────────────────────────────────────────────────┤
│ h1 │ Emergency Shelter  │ superseded │ mode: declared        │
│    │ @jreyes:server     │ 2024-07-18 │ (initial claim)       │
└──────────────────────────────────────────────────────────────┘
```

Every claim carries:
- **value** — what was claimed
- **agent** — who made the claim (Matrix user ID + their role)
- **mode** — how they know: `measured | observed | declared | inferred | aggregated`
- **phase** — lifecycle state: `settled | held | contested | superseded`
- **supersedes** — ID of the prior claim this one replaces (chains the history)
- **operator** — the EO operator that created it (see Section 7)
- **note** — human-readable provenance context

### Claim Phases

| Phase | Meaning |
|-------|---------|
| `settled` | The current accepted value for this field |
| `held` | Recorded but not yet resolved — awaiting confirmation or review |
| `contested` | Multiple conflicting claims exist; the field is actively disputed |
| `superseded` | Replaced by a newer claim; retained for audit history |

Phases are **computed by replay, not stored**. You derive them by running `ClaimEngine.replayTo(events, targetDate)`. This keeps the event stream immutable — a phase transition doesn't edit old data, it emits a new operation.

### State Is Reconstructed From Events

There is no authoritative "current state" record that you update in place. The current state of all claim stacks for an individual is produced by replaying `io.khora.claim.event` timeline events from a room up to a given point in time.

`ClaimEngine.replayTo()` is the sole source of truth for current state.

For performance, `io.khora.claim.stack` state events serve as **snapshots** — a cached replay result. But the snapshot is derived, not authoritative. If a snapshot is missing or stale, fall back to replaying from the timeline.

The timeline scrubber in the UI is a direct expression of this model: drag it to any point in time and `replayTo()` reconstructs what the record looked like at that moment. This isn't a special "history mode" — it's just normal replay with a different target date.

---

## 7. The EO Operators

Matrix provides transport and storage. Above that, Khora has a formalized vocabulary for every meaningful change to data: **nine operators** from the Emergent Ontology (EO) framework.

Every claim event blob contains an `ops` array. Each operation is expressed as `operator(target, operand)` — what was done, to what, and with what content. You don't need to understand the full philosophical foundations of EO to use the operators correctly. Think of them as a constrained semantic commit vocabulary — like git's `add/remove/merge` but for structured data mutations. There are exactly nine, and every possible meaningful change maps to one of them.

### The Nine Operators

| Operator | What It Does | When to Use It |
|----------|-------------|----------------|
| **INS** | Instantiates something that now exists | A new claim enters the stack; a new entity is created; a new record is born |
| **NUL** | Removes or voids something | Revocations, expirations, hard deletes from the logical model |
| **ALT** | Transitions state within something that already exists | Status changes, phase transitions, value updates on an existing claim |
| **CON** | Creates a relationship between two things | An allocation linking a client to a resource; a bridge linking client to provider |
| **SEG** | Bounds or classifies something within a defined range or category | Assigning someone to a priority tier; placing a value in a cohort |
| **DES** | Names or defines something | Creating a field definition; labeling a new concept; writing a resource type |
| **SYN** | Merges or deduplicates | Resolving two records as the same entity; combining divergent data |
| **SUP** | Holds two conflicting interpretations simultaneously without forcing resolution | A contested claim; a field where two orgs use incompatible definitions |
| **REC** | Evolves a schema or structural definition itself | Versioning a field definition; changing propagation rules; schema migration |

### Usage in Code

Operators appear inside claim event blobs as an `ops` array. A single blob can contain multiple ops representing one logical action:

```javascript
// Opening an intake: the case emerges, housing is first observed
{
  ops: [
    // The case comes out of void — it didn't exist before
    { op: "NUL", field: null, note: "Case brought out of void." },

    // Define what this housing claim contains
    { op: "DES", field: "housing", claimId: "h1",
      value: "Emergency Shelter", agent: "@jreyes:server",
      role: "Intake Worker", mode: "declared",
      note: "Client self-reported at intake." },

    // Instantiate that claim into the stack as settled
    { op: "INS", field: "housing", claimId: "h1" }
  ]
}

// A worker updates their assessment (supersession)
{
  ops: [
    // Mark the old claim as superseded
    { op: "ALT", field: "housing", claimId: "h1", phase: "superseded" },

    // Define the new claim
    { op: "DES", field: "housing", claimId: "h2",
      value: "Transitional Housing", agent: "@kim:server",
      role: "Case Manager", mode: "observed", supersedes: "h1",
      note: "Moved to transitional housing 2024-09-14." },

    // Instantiate it
    { op: "INS", field: "housing", claimId: "h2" }
  ]
}

// Two workers disagree on priority level — hold both without forcing resolution
{
  ops: [
    { op: "SUP", field: "priority_level",
      claims: ["p1", "p2"],
      note: "SPDAT score conflicts with intake assessment. Pending supervisor review." }
  ]
}

// A field definition changes at the network level (schema evolution)
{
  ops: [
    { op: "REC", field: "priority_level",
      prior_def: "def_priority_v1", new_def: "def_priority_v2",
      note: "Added 'critical' tier per Q4 governance vote." }
  ]
}
```

### Why This Matters for Development

**Every meaningful mutation emits ops.** If you're writing code that changes a claim's state and you're not producing ops, that's a design error. The ops array is the audit trail, the basis for replay, and the complete record of why current state is what it is.

**Use `ClaimEngine.buildOps(action, field, claim, context)` rather than constructing ops by hand.** Hand-rolled ops that skip steps — forgetting the paired `DES+INS` when inserting, or forgetting to `ALT` the prior claim before superseding — will cause replay to produce incorrect state.

**The operators constrain schema evolution.** When fields or definitions change, those changes are expressed as `REC` or `DES` ops in governance timelines. Every change is an explicit, attributable operation — not a silent database migration.

---

## 8. The Bots

Khora runs two bots on hyphae.social. They are Matrix accounts like any user, but automated.

### `@khora-backup:hyphae.social` (Backup Bot)

This bot auto-joins every Khora room when invited. Its only job is to be a silent room member so that hyphae.social holds a federated copy of the room's event history and blob references. If a user's homeserver goes down, the room data still lives on hyphae.social. The bot never sends messages and never processes events. It just exists in rooms.

When the Khora client creates any new room, it invites this bot.

### `@khora-escrow:hyphae.social` (Escrow Bot)

This bot manages encryption key recovery. During onboarding:

1. Client generates a 12-word recovery phrase (128 bits of entropy)
2. Client derives an AES-256-GCM key from the phrase
3. Client exports all megolm session keys via the Matrix SDK
4. Client encrypts that export bundle with the derived key
5. Client creates a private escrow room with the user + this bot
6. Client stores a bcrypt hash of the phrase and the encrypted bundle as room state events

If the user loses their account, they create a new Matrix account, provide their old username and recovery phrase, and the bot verifies the hash, invites the new account into the escrow room, and the client imports the megolm keys — restoring access to all prior room history.

The escrow room is intentionally **not** Megolm-encrypted. A new account recovering access has no megolm keys yet and couldn't read an encrypted room. The security comes entirely from the AES-256-GCM encryption of the bundle: an attacker with full database access sees only an opaque blob that requires the 12-word phrase to decrypt.

---

## 9. The SDK: matrix-js-sdk

Khora's client is built on `matrix-js-sdk`. Key patterns you'll use:

```javascript
// Initialize and start
const client = sdk.createClient({
  baseUrl: 'https://hyphae.social',
  userId: '@user:hyphae.social',
  accessToken: 'YOUR_ACCESS_TOKEN',
  deviceId: 'DEVICE_ID',
});

await client.initRustCrypto();  // Always Rust crypto — legacy JS crypto is deprecated
await client.startClient({ initialSyncLimit: 20 });

await new Promise(resolve => {
  client.once('sync', (state) => { if (state === 'PREPARED') resolve(); });
});

// Upload a claim blob and get back an mxc:// URI
const encrypted = await FieldCrypto.encryptClaim(claimBatch, keyB64);
const { content_uri } = await client.uploadContent(
  new Blob([JSON.stringify(encrypted)], { type: 'application/octet-stream' }),
  { name: 'claim-blob' }
);

// Send the lightweight pointer event
await client.sendEvent(roomId, 'io.khora.claim.event', {
  id: generateId(),
  label: 'Intake opened',
  date: '2024-07-18',
  blob_url: content_uri,
  blob_hash: await sha256hex(encrypted)
});

// Listen for events and fetch blobs
client.on('Room.timeline', async (event, room) => {
  if (event.getType() !== 'io.khora.claim.event') return;
  const { blob_url, blob_hash } = event.getContent(); // SDK auto-decrypts Megolm
  const httpUrl = client.mxcUrlToHttp(blob_url);
  const res = await fetch(httpUrl);
  const blob = await res.json();
  if (await sha256hex(blob) !== blob_hash) throw new Error('Blob integrity check failed');
  const claims = await FieldCrypto.decryptClaim(blob, keyB64);
  // Feed into ClaimEngine.replayTo()
});

// State events — no blobs needed, small config data only
await client.sendStateEvent(roomId, 'io.khora.claim.stack', fieldKey, {
  snapshot: compressedStackData,
  as_of: Date.now()
});
const currentStack = await client.getStateEvent(roomId, 'io.khora.claim.stack', fieldKey);
```

**SDK notes:**
- `initRustCrypto()` not `initCrypto()` — the Rust implementation is current; the legacy JS crypto is deprecated and will be removed
- `event.getContent()` auto-decrypts the Megolm envelope — the blob is still AES-GCM-encrypted and is your app's responsibility
- The SDK must be synced (`startClient` running) to decrypt events — megolm keys are exchanged live during sync

---

## 10. Key Development Principles

These are not preferences. Violating them creates architectural debt that is very hard to unwind.

**Never write to the vault on behalf of the client.** The vault room is the client's sovereign record. Only the client's device writes to it. If a provider allocates a resource, the bridge room records it, and then the client's app syncs a shadow copy to the vault as a separate write. Two separate writes, two separate blobs.

**Always denormalize vault blobs.** When writing to the vault, copy human-readable names as strings. Do not store ID references that require a network lookup to resolve. The vault must be legible even if every other room is inaccessible.

**State is replay, not storage.** Current claim stacks are produced by running `ClaimEngine.replayTo()` over timeline events. State event snapshots are a performance cache, not the source of truth. If you're tempted to directly set a claim's phase in storage, stop — emit the appropriate op instead.

**Every mutation emits ops.** No silent state changes. If code is changing what something means and there's no `ops` array being produced, that is a design error.

**Opacity defaults to sovereign.** All data is private by default. Disclosure is an explicit act recorded as a grant. New fields, claims, and records start visible only to the holder.

**Constraints are contestable.** When validation blocks an operation, the error must include provenance — who adopted this constraint, when, through what governance process. Never surface a hard block with no attribution. If a constraint can't be traced to a governance decision, it shouldn't be a hard constraint.

**Design for node failure.** Every piece of functionality should have an answer to: "what happens if hyphae.social is unreachable?" The vault should be readable offline. Bridge data should survive if the provider's server goes down. Locally cached blobs should be enough to reconstruct state without a live network connection.

---

## 11. Infrastructure Overview

```
hyphae.social (GCP VM)
├── Synapse homeserver  (Matrix server — event storage, federation, media store)
│   └── Media store     ← encrypted claim blobs live here currently
├── PostgreSQL          (Synapse's database + media metadata)
├── Backup bot          (port 9556 — joins all Khora rooms for federation resilience)
└── Escrow bot          (port 9555 — manages megolm key recovery)

Client app (browser PWA or mobile)
├── matrix-js-sdk       (Matrix protocol, sync, room/event management)
├── Rust crypto         (Megolm E2EE — via matrix-js-sdk)
├── FieldCrypto         (AES-256-GCM claim blob encryption — app/crypto.js)
├── ClaimEngine         (replay, phase resolution, op building — app/claims.js)
└── IndexedDB           (local key storage, sync state, cached blobs)
```

Users can have accounts on any Matrix server. hyphae.social is the network's anchor homeserver — it hosts the network room, the bots, and the media store — but it does not need to host user accounts. A user on `matrix.org` or a self-hosted server participates fully.

---

## 12. Quick Reference

### Room Types

| Room | Key State Events | Key Timeline Events |
|------|-----------------|---------------------|
| Network | `io.khora.schema.field`, `io.khora.network.members`, `io.khora.governance.*` | governance proposals, schema change log |
| Organization | `io.khora.org.identity`, `io.khora.org.roster`, `io.khora.resource.type`, `io.khora.resource.inventory` | staff changes, resource allocation events |
| Bridge | `io.khora.bridge.meta`, `io.khora.claim.stack`, `io.khora.resource.allocation` | `io.khora.claim.event` (→ blob), messages, ops |
| Vault | `io.khora.claim.stack`, `io.khora.resource.vault_record` | `io.khora.claim.event` (→ blob) |

### EO Operators at a Glance

| Op | Use when... |
|----|------------|
| **INS** | Something new comes into existence |
| **NUL** | Something is voided, revoked, or ceases to exist |
| **ALT** | Something transitions state |
| **CON** | A relationship is formed between two things |
| **SEG** | Something is classified into a bounded category |
| **DES** | Something is named or defined |
| **SYN** | Two things are merged or deduplicated |
| **SUP** | Two conflicting interpretations are held simultaneously |
| **REC** | A definition or schema structure itself changes |

### Claim Phases

| Phase | Meaning |
|-------|---------|
| `settled` | Current accepted value |
| `held` | Recorded but not yet resolved |
| `contested` | Actively disputed — conflicting claims exist |
| `superseded` | Replaced by a newer claim; kept for audit |

### Claim Epistemic Modes

| Mode | Meaning |
|------|---------|
| `measured` | Derived from an instrument or objective measurement |
| `observed` | Directly witnessed by the agent |
| `declared` | Self-reported by the subject |
| `inferred` | Derived from other data by reasoning |
| `aggregated` | Computed from multiple sources |

---

## 13. Where to Start

1. Clone the repo and get the app running locally against a test homeserver (or a dev account on hyphae.social)
2. Use **Element Web** (element.io) in parallel as you develop — it lets you join the same rooms and inspect raw events, see the thin pointer events in timelines, and verify state
3. Read `ARCHITECTURE.md` in the repo for current implementation status
4. Read `app/claims.js` before touching any data layer — the replay model is the foundation everything else builds on
5. Ask before creating new event types or operators — the `io.khora.*` namespace and the nine-operator vocabulary are carefully constrained and additions need to fit

**References:**
- Matrix spec: https://spec.matrix.org (Client-Server API and Room Events are the most relevant)
- matrix-js-sdk: https://matrix-org.github.io/matrix-js-sdk
- Khora repo: https://github.com/clovenbradshaw-ctrl/Khora
