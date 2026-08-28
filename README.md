# naan

A minimal, local-first notes app. Notes are plain Markdown files in a folder you
choose — so they stay yours, readable by any editor, and easy to sync (point the
folder at iCloud/Dropbox/git yourself). Built with Tauri v2 + React.

A standalone MCP server (so Claude Code and other agents can read/write your
notes) ships in `crates/naan-mcp` — see [Agents (MCP)](#agents-mcp) below.

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

## Editor

The note editor is CodeMirror with live Markdown styling and no toolbar:

- Type `/` to open a **slash-command menu** at the cursor — insert headings,
  lists, task lists, quotes, a code block, or a divider. Filter by typing.
- Select text to get a **formatting bubble** — bold, italic, strikethrough,
  inline code, or a link.

## Project layout

- `crates/naan-core` — pure-Rust note engine (storage + search), no UI. Fully unit-tested.
- `crates/naan-mcp` — stdio MCP server exposing notes to agents (depends on `naan-core`).
- `src-tauri` — the Tauri app: commands, config, file watcher (depends on `naan-core`).
- `src` — React frontend (talks to Rust only through `src/lib/notesApi.ts`).

## Agents (MCP)

`naan-mcp` is a stdio [MCP](https://modelcontextprotocol.io) server that lets
agents like Claude Code read and write your notes as the same `.md` files the
app uses.

Build it:

```bash
cargo build -p naan-mcp --release
```

Then register it with Claude Code (e.g. in `.mcp.json` or via `claude mcp add`):

```json
{
  "mcpServers": {
    "naan": {
      "command": "/absolute/path/to/naan/target/release/naan-mcp",
      "args": ["--notes-dir", "/Users/you/Documents/naan"]
    }
  }
}
```

Tools exposed:

- `list_notes` — list all notes (id, title, tags, timestamps).
- `read_note` — read one note in full, including its body, by id.
- `search_notes` — search notes by free text and optional tags.
- `create_note` — create a note from a title and optional body/tags.
- `update_note` — update a note's title, body and/or tags by id.
- `delete_note` — delete a note by id.

## Dev commands

```bash
cargo test --workspace                       # Rust tests
cargo clippy --workspace -- -D warnings      # lints
npm test                                     # frontend unit tests (vitest)
npm run build                                # type-check + build frontend
cargo run -p naan-core --example demo        # create sample notes in ~/Documents/naan-demo
```
