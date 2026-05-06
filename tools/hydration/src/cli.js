#!/usr/bin/env node
// `khora-hyd` — CLI wrapper for the hydration library (SPEC §21.7).
//
// Subcommands:
//   khora-hyd export   --in <bundle.json> --out <file.khr> [--passphrase-stdin] [--sign]
//   khora-hyd import   --in <file.khr>    --out <bundle.json> [--passphrase-stdin] [--verify-with <pubkey.b64>]
//   khora-hyd inspect  <file.khr>
//   khora-hyd verify   <file.khr> [--with <pubkey.b64>]
//
// `--in <bundle.json>` is a JSON document describing the rooms and sections
// to bundle:
//
//   {
//     "rooms": [
//       {
//         "room_id": "!abc:server",
//         "as_of_event": "$evt...",
//         "event_count": 1234,
//         "sections": [
//           { "type": 1, "bytes_base64": "..." },   // changelog
//           { "type": 2, "bytes_base64": "..." }    // state-snapshot
//         ]
//       }
//     ],
//     "created_by": { "matrix_user_id": "@alice:server", "device_id": "ABC" },
//     "schema_versions": { "eo.case.v1": "1.0.0" },
//     "label": "before-laptop-trip"
//   }
//
// Real callers will hand-build this from their cache state. The CLI is here
// so disaster-recovery scripts and the eventual GitHub Actions publish step
// can produce / consume hydration files without spinning up the bootstrap.

import fs from 'node:fs/promises';
import path from 'node:path';

import { exportHydration, importHydration, inspect, verify } from './index.js';
import { fromBase64, toBase64 } from './encoding.js';

async function main(argv) {
  const sub = argv[0];
  const rest = argv.slice(1);
  if (!sub || sub === '--help' || sub === '-h') return printHelp();
  switch (sub) {
    case 'export':
      return cmdExport(parseFlags(rest));
    case 'import':
      return cmdImport(parseFlags(rest));
    case 'inspect':
      return cmdInspect(rest);
    case 'verify':
      return cmdVerify(parseFlags(rest));
    default:
      console.error(`khora-hyd: unknown subcommand '${sub}'`);
      printHelp();
      process.exit(2);
  }
}

function printHelp() {
  process.stdout.write(`khora-hyd — external hydration files (SPEC §21.6)

Usage:
  khora-hyd export   --in <bundle.json> --out <file.khr> [--passphrase-stdin]
  khora-hyd import   --in <file.khr>    --out <bundle.json> [--passphrase-stdin] [--verify-with <pubkey.b64>]
  khora-hyd inspect  <file.khr>
  khora-hyd verify   --in <file.khr>    [--with <pubkey.b64>]

Subcommands:
  export    Build a .khr from a JSON description of room bundles.
  import    Decrypt a .khr and emit the decoded bundle as JSON (sections base64-encoded).
  inspect   Print the plaintext header (no key required).
  verify    Verify magic / version / signature without decrypting the payload.

Encryption:
  Currently only --passphrase-stdin (Argon2id → AES-256-GCM) is implemented.
  Hardware-key and split-key modes are reserved by SPEC §21.6 and rejected
  with a clear error so callers know to upgrade.
`);
}

function parseFlags(argv) {
  const out = { _positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._positional.push(a);
    }
  }
  return out;
}

async function readPassphraseFromStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function cmdExport(flags) {
  const inPath = flags.in;
  const outPath = flags.out;
  if (!inPath || !outPath) throw new Error('export: --in and --out are required');
  const spec = JSON.parse(await fs.readFile(inPath, 'utf8'));

  const passphrase = flags['passphrase-stdin'] ? await readPassphraseFromStdin() : null;
  if (!passphrase) throw new Error('export: --passphrase-stdin is required (no other key modes implemented yet)');

  const rooms = (spec.rooms || []).map((r) => ({
    room_id: r.room_id,
    as_of_event: r.as_of_event,
    event_count: r.event_count,
    sections: (r.sections || []).map((s) => ({
      type: s.type,
      bytes: fromBase64(s.bytes_base64),
    })),
  }));

  const result = await exportHydration({
    rooms,
    created_by: spec.created_by,
    schema_versions: spec.schema_versions || {},
    includes_megolm: !!spec.includes_megolm,
    includes_media_cache: !!spec.includes_media_cache,
    key: { mode: 'passphrase', passphrase },
    label: spec.label || null,
  });

  await fs.writeFile(outPath, result.bytes);
  process.stdout.write(JSON.stringify({
    sha256: result.sha256,
    key_fingerprint: result.key_fingerprint,
    size_bytes: result.bytes.byteLength,
    out: path.resolve(outPath),
  }, null, 2) + '\n');
}

async function cmdImport(flags) {
  const inPath = flags.in;
  const outPath = flags.out;
  if (!inPath || !outPath) throw new Error('import: --in and --out are required');

  const passphrase = flags['passphrase-stdin'] ? await readPassphraseFromStdin() : null;
  if (!passphrase) throw new Error('import: --passphrase-stdin is required');

  const bytes = new Uint8Array(await fs.readFile(inPath));
  const trusted = flags['verify-with']
    ? new Uint8Array(Buffer.from(flags['verify-with'], 'base64'))
    : null;

  const { file_header, manifest, sections } = await importHydration({
    bytes,
    key: { mode: 'passphrase', passphrase },
    trustedSignerPubKey: trusted,
  });

  const sectionsOut = sections.map((s) => ({
    type: s.type,
    bytes_base64: toBase64(s.bytes),
  }));
  await fs.writeFile(
    outPath,
    JSON.stringify({ file_header, manifest, sections: sectionsOut }, null, 2),
  );
  process.stdout.write(JSON.stringify({
    rooms_imported: manifest.scope.room_ids,
    sections_decoded: sections.length,
    out: path.resolve(outPath),
  }, null, 2) + '\n');
}

async function cmdInspect(positional) {
  const file = positional[0];
  if (!file) throw new Error('inspect: file argument required');
  const bytes = new Uint8Array(await fs.readFile(file));
  const info = inspect(bytes);
  process.stdout.write(JSON.stringify(info, null, 2) + '\n');
}

async function cmdVerify(flags) {
  const inPath = flags.in || flags._positional[0];
  if (!inPath) throw new Error('verify: --in <file.khr> required');
  const bytes = new Uint8Array(await fs.readFile(inPath));
  const trusted = flags.with
    ? new Uint8Array(Buffer.from(flags.with, 'base64'))
    : null;
  const result = await verify(bytes, { trustedSignerPubKey: trusted });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}

main(process.argv.slice(2)).catch((err) => {
  console.error('khora-hyd:', err.message);
  process.exit(1);
});
