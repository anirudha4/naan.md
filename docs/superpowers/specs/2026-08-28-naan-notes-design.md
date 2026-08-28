# naan — Design Spec

Date: 2026-08-28
Status: Approved for planning

## 1. What we're building

`naan` is a minimal, beautiful, dead-easy notes manager for macOS desktop.
Notes are plain Markdown files in a folder. `naan` also ships a standalone
MCP (Model Context Protocol) server so Claude Code and other agents can
read, write, and search those notes — turning the app into an agent-drivable
notes backend.

MCP = a standard protocol that lets AI agents call typed "tools". `naan`
exposes note operations as MCP tools.

### v1 priorities

1. Correct, well-structured, extensible code. No workarounds.
2. A genuinely nice editing experience (slash-command bubble + selection
   bubble, Notion-style).
3. Working MCP server with full CRUD + search.

UI polish is explicitly **out of scope for v1**. The UI will be built
functional and clean, then polished in a later pass driven by the user,
component by component.

## 2. Non-negotiable constraints (from the user)

1. Heavy component-driven architecture.
2. Important seams are plug-n-play / swappable for future change (see §7).
3. No UI component library. Configure Tailwind + Base UI
   (`@base-ui-components/react`, unstyled accessible primitives). All visible
   components are built from scratch on top of these primitives.
4. Do not over-invest in visual polish now. Structure first; polish later.
5. Best practices only. No shortcuts or workarounds. When a real decision or
   blocker appears, stop and ask the user rather than hacking around it.
6. Animation via `motion` (a.k.a. framer-motion). Wire it in; light use for now.
7. No toolbar. The editor uses a **slash-command bubble** (type `/` → command
   menu at the caret) and a **selection bubble** (select text → floating
   format menu). This is the highest-effort area. Built on CodeMirror 6; if
   CodeMirror genuinely can't do it well, stop and switch (decision → ask).
8. Think like a senior product designer: smooth, easy, semantic components
   (dropdown, select, menu, dialog) following real app-design principles.

## 3. Architecture — Cargo workspace, shared core

Notes are just files, so the app and the MCP server both operate on the same
folder. There is no client/server link between them. One shared Rust crate
holds all note logic; both binaries depend on it.

```
naan/                      # repo root
├─ crates/
│  ├─ naan-core/           # pure Rust: all note logic, no UI, no Tauri
│  ├─ naan-mcp/            # standalone stdio MCP server binary
│  └─ naan-app/            # Tauri v2 app (Rust side)  [renamed from src-tauri]
├─ src/                    # React + TS frontend
└─ docs/
```

Cargo workspace at the repo root ties the three crates together.

| Crate | Responsibility | Depends on |
|-------|----------------|------------|
| `naan-core` | Domain types, frontmatter parse/serialize, `NoteStore` + `Searcher` traits and their default file-system impls, config, errors. Fully unit-tested. | — |
| `naan-app` | Tauri commands (thin wrappers over `naan-core`), app state, folder picker on first launch, file watcher → UI events, config persistence. | `naan-core` |
| `naan-mcp` | stdio MCP server exposing 6 tools, each calling `naan-core`. Works with the app closed. | `naan-core` |

Note: the current scaffold has the Tauri crate at `src-tauri/` named `naan`.
The plan will restructure this into the workspace layout above. Restructuring
is done properly (workspace `Cargo.toml`, updated `tauri.conf.json` paths),
not patched around.

## 4. Data model & file format

One `.md` file per note. YAML frontmatter for metadata, Markdown body.

```markdown
---
id: 01JABCDXYZ...            # ULID, stable identity, survives renames
title: My first note
tags: [ideas, naan]
created: 2026-08-28T10:00:00Z
updated: 2026-08-28T10:05:00Z
---

Note body in **markdown**.
```

- **Identity**: `id` (ULID) is the stable identity. Links and agents reference
  the `id`, so renames never break references.
- **Filename**: `slug-of-title.md`. Collisions get a numeric suffix (`-2`).
  Renamed when the title changes.
- **Folder**: chosen on first launch (default `~/Documents/naan`), stored in
  app config. The MCP binary receives the same folder path via CLI arg / env.
- **Frontmatter library**: use a *maintained* YAML crate. `serde_yaml` is
  archived/unmaintained — do not use it. Preferred: `serde_yml` (maintained
  fork) for parse + serialize, or `gray_matter` for parsing. Final pin decided
  in the plan.

## 5. `naan-core` (Rust)

Domain-focused, no I/O framework leakage. Public surface:

```rust
pub struct NoteId(String);            // ULID
pub struct NoteMeta { id, title, tags: Vec<String>, created, updated, path }
pub struct Note { meta: NoteMeta, body: String }

pub trait NoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>>;
    fn get(&self, id: &NoteId) -> Result<Note>;
    fn create(&self, draft: NewNote) -> Result<Note>;
    fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note>;
    fn delete(&self, id: &NoteId) -> Result<()>;
}

pub trait Searcher {
    // full-text needs bodies, so it searches over Note (not NoteMeta)
    fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta>;
}
```

- Default `NoteStore` impl: `FsNoteStore` (Markdown folder).
- Default `Searcher` impl: `NaiveSearcher` — in-memory full-text + tag filter.
  Fast enough for thousands of notes. Swap for an indexed searcher later if it
  ever drags. (Known ceiling: linear scan; upgrade path: inverted index.)
- Errors: `thiserror`-based `CoreError`. No `unwrap`/`expect` in library paths.
- Tested: round-trip create/read/update/delete/search against a temp folder.

## 6. Interfaces

### 6.1 Tauri commands (`naan-app`)

Thin, typed wrappers. One per core operation:
`list_notes`, `get_note`, `create_note`, `update_note`, `delete_note`,
`search_notes`, plus `get_notes_dir` / `set_notes_dir` (first-launch flow).

App state holds a `Box<dyn NoteStore>` + folder path. A file watcher
(`notify` crate) emits a `notes-changed` event to the frontend when files
change on disk (e.g. an agent edited them), so the UI stays in sync.

Config (chosen folder) persisted as JSON in the app config dir via
`std::fs` + `serde_json` — no extra plugin. Folder picker via
`tauri-plugin-dialog`.

### 6.2 MCP tools (`naan-mcp`)

stdio transport, via the official Rust MCP SDK (`rmcp`). Tools:

| Tool | Input | Output |
|------|-------|--------|
| `list_notes` | — | array of {id, title, tags, created, updated} |
| `read_note` | id | {title, tags, body, ...} |
| `search_notes` | query, tags? | array of note metas |
| `create_note` | title, body, tags? | created note meta |
| `update_note` | id, title?, body?, tags? | updated note meta |
| `delete_note` | id | ok |

Each tool is a thin wrapper over `naan-core`. Documented one-line Claude Code
MCP config (command = `naan-mcp` binary, arg/env = notes folder path) ships in
the README.

### 6.3 Frontend IPC boundary

A single typed module `src/lib/notesApi.ts` wraps every `invoke(...)` call and
the `notes-changed` event. Components never call `invoke` directly — they use
`notesApi`. This is a swap seam: the transport can be mocked (Storybook, tests)
or replaced without touching UI code.

## 7. Plug-n-play seams (explicit)

These are the "important things made flexible" the user asked for. Each is a
clear interface with one default implementation:

| Seam | Interface | Default | Why swappable |
|------|-----------|---------|---------------|
| Storage backend | `NoteStore` trait | `FsNoteStore` | swap to SQLite/remote later |
| Search strategy | `Searcher` trait | `NaiveSearcher` | swap to indexed search |
| Frontend data access | `notesApi` module | Tauri invoke | mock/replace transport |
| Editor commands | command registry (data) | built-in set | add commands by adding entries |
| UI primitives | wrapper components over Base UI | Base UI | primitive lib isolated |
| Animation | `motion` presets module | shared presets | consistent, swappable |

No speculative abstractions beyond these named seams. One implementation each;
the trait/interface exists because the user asked for future flexibility here
specifically, not on spec.

## 8. Frontend architecture (component-driven)

Stack: React + TypeScript (strict), Tailwind (v4, Vite plugin), Base UI
primitives, CodeMirror 6 editor, `motion` for animation.

```
src/
├─ app/                    # shell, layout, providers
├─ components/             # from-scratch primitives on Base UI + Tailwind
│  ├─ Button, IconButton
│  ├─ Menu, Dropdown, Select      # semantic, accessible (Base UI)
│  ├─ Popover, Tooltip, Dialog
│  └─ Input, Field
├─ features/
│  ├─ notes/               # NoteList, NoteListItem, SearchBar, TagFilter
│  └─ editor/              # Editor (CM6), SlashCommandMenu, SelectionBubble,
│                          #   commands/ (registry), extensions/
├─ lib/                    # notesApi, types, motion presets, cn() util
└─ styles/                 # tailwind entry, tokens
```

Every visible element is a small, single-purpose component. Semantic
primitives (Menu/Dropdown/Select/Dialog) come from Base UI wrapped in our own
styled components — accessibility (focus, keyboard, ARIA) handled by Base UI,
look owned by us.

## 9. The editor (highest-effort area)

CodeMirror 6 is the source of truth for text; the document is always valid
Markdown (no lossy serialization). Bubbles dispatch CM transactions to edit
text.

### 9.1 Slash-command bubble

- Trigger: `/` typed at line start or after whitespace.
- A CodeMirror ViewPlugin tracks the trigger and the query text after `/`.
- The menu is a React component anchored at the caret using CM's
  `coordsAtPos`, positioned via a virtual anchor (Base UI Popover virtual
  anchor, or `@floating-ui/react` if needed).
- Filters as the user types; arrow keys navigate; Enter/click runs the command;
  Esc closes.
- Commands (heading 1–3, bullet/numbered/task list, quote, code block, divider,
  etc.) come from the **command registry** — adding one = adding a data entry.

### 9.2 Selection bubble

- Trigger: a non-empty selection.
- Floating menu above the selection (via `coordsAtPos` of the range), same
  anchoring approach.
- Actions: bold, italic, strikethrough, inline code, link, heading, quote —
  also sourced from the command registry (a `selection` command group).

### 9.3 Live-markdown rendering

CodeMirror renders Markdown styled inline (Obsidian "live preview" feel):
headings sized, bold/italic styled, lists/quotes/code decorated — while the
text stays Markdown. Achieved with `@codemirror/lang-markdown` + decoration
extensions.

### 9.4 Feasibility note

Slash + selection menus on CM6 are proven (Obsidian and others do this). If a
real blocker appears (positioning, focus, or interaction quality that can't be
solved cleanly), we stop and decide with the user whether to switch editors —
we do not ship a hacky version.

## 10. First-launch & sync

- First launch: prompt for a notes folder (default `~/Documents/naan`), persist
  it. Subsequent launches load it.
- Sync: none built in. Because it's a plain folder, the user can point it at
  iCloud/Dropbox/git. Out of scope for v1.

## 11. Testing & quality

- `naan-core`: real unit tests (all CRUD + search round-trips against temp dirs).
  This is where the logic lives.
- `naan-mcp`: one smoke test that a tool call returns expected output.
- Frontend: kept thin; component/interaction tests deferred to the UI-polish
  pass (out of scope now). The IPC boundary is mockable when we get there.
- Rust: `clippy` clean, no `unwrap` in libraries, `Result`-based errors.
- TS: strict mode, no `any` in app code.

## 12. Out of scope for v1

Attachments/images, backlinks/wiki-links, multi-vault, mobile, built-in sync,
encryption, and UI visual polish. All addable later; none block the core.

## 13. Build order (feeds the implementation plan)

1. Workspace restructure + `naan-core` (types, `NoteStore`, `Searcher`, FS impl,
   frontmatter, tests).
2. `naan-app` Tauri commands + state + config + folder picker + file watcher.
3. Frontend foundation: Tailwind + Base UI + `motion` configured; `notesApi`;
   primitive components; app shell.
4. Notes feature: list, search, tag filter, CRUD wired to `notesApi`.
5. Editor: CM6 wrapper + live-markdown; command registry; slash bubble;
   selection bubble.
6. `naan-mcp`: stdio server + 6 tools + smoke test + README config docs.
