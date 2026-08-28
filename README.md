# naan

A minimal, local-first notes app. Notes are plain Markdown files in a folder you
choose — so they stay yours, readable by any editor, and easy to sync (point the
folder at iCloud/Dropbox/git yourself). Built with Tauri v2 + React.

A standalone MCP server (so Claude Code and other agents can read/write your
notes) is a later phase.

## Run it

Prerequisites: [Rust](https://rustup.rs) and [Node.js](https://nodejs.org).

```bash
npm install
npm run tauri dev
```

On first launch, naan asks for a folder to keep notes in (default:
`~/Documents/naan`). Each note is one `.md` file with YAML frontmatter:

```markdown
---
id: 01J...            # stable ULID, survives renames
title: My note
tags: [ideas]
created: 2026-08-28T10:00:00Z
updated: 2026-08-28T10:05:00Z
---

Body in **markdown**.
```

naan watches the folder: edit or add a `.md` file from anywhere and the app
refreshes automatically.

## Project layout

- `crates/naan-core` — pure-Rust note engine (storage + search), no UI. Fully unit-tested.
- `src-tauri` — the Tauri app: commands, config, file watcher (depends on `naan-core`).
- `src` — React frontend (talks to Rust only through `src/lib/notesApi.ts`).

## Dev commands

```bash
cargo test --workspace                       # Rust tests
cargo clippy --workspace -- -D warnings      # lints
npm run build                                # type-check + build frontend
cargo run -p naan-core --example demo        # create sample notes in ~/Documents/naan-demo
```
