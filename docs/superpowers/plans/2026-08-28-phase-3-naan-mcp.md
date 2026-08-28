# Phase 3: `naan-mcp` — stdio MCP server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A standalone `naan-mcp` binary that speaks the Model Context Protocol over stdio and exposes 6 note tools (list/read/search/create/update/delete), operating directly on the notes folder via `naan-core`. This lets Claude Code and other agents manage naan notes — even when the desktop app is closed.

**Architecture:** A new workspace crate `crates/naan-mcp` depending only on `naan-core` (never on the Tauri app). A pure, tested `notes` adapter maps `naan-core` ↔ small serde structs (naan-core stays serde-free). The MCP server (via the official Rust SDK `rmcp`) exposes each tool as a thin wrapper over the adapter, reading the notes folder path from `--notes-dir <path>` / `$NAAN_NOTES_DIR` (default `~/Documents/naan`). stdio transport, so Claude Code launches it as a subprocess.

**Tech Stack:** Rust 2021, `naan-core` (path dep), `rmcp` (official MCP Rust SDK — verify current version + API via context7), `tokio` (async runtime rmcp needs), `serde`/`serde_json`.

**Spec:** `docs/superpowers/specs/2026-08-28-naan-notes-design.md` (§6.2 MCP tools)

## Global Constraints

- `naan-mcp` depends on `naan-core` ONLY — never on the `naan` (Tauri) crate.
- No `unwrap()`/`expect()`/`panic!` in non-test/non-`main` code. Tool handlers return protocol errors, not panics. (`main`/startup may `?`-propagate into an error exit.)
- `naan-core` is NOT modified in this phase. If a genuine gap appears, STOP and report.
- `rmcp`'s exact API (macros, server trait, stdio transport, tool schema derivation) MUST be confirmed via the context7 docs tool before coding the server (Task 2) — the SDK moves fast; adapt sample shapes to the real current API. A doc-confirmed adaptation is expected, not a deviation.
- `cargo clippy --workspace -- -D warnings` clean; `cargo fmt` applied. Existing Phase 1/2 tests must stay green.
- Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

## Tool contract (all 6 — the MCP surface)

| Tool | Input | Output |
|------|-------|--------|
| `list_notes` | — | `[{id,title,tags,created,updated}]` |
| `read_note` | `{id}` | `{id,title,tags,created,updated,body}` |
| `search_notes` | `{text, tags?}` | `[{id,title,tags,created,updated}]` |
| `create_note` | `{title, body?, tags?}` | `{id,title,tags,created,updated}` |
| `update_note` | `{id, title?, body?, tags?}` | `{id,title,tags,created,updated}` |
| `delete_note` | `{id}` | `{ok:true}` |

---

## File Structure

```
Cargo.toml                        MODIFY  # add crates/naan-mcp to workspace members
crates/naan-mcp/Cargo.toml        CREATE
crates/naan-mcp/src/main.rs       CREATE  # arg/env dir resolution + start server
crates/naan-mcp/src/notes.rs      CREATE  # pure adapter over naan-core (tested)
crates/naan-mcp/src/server.rs     CREATE  # rmcp server + 6 tool handlers
crates/naan-mcp/tests/stdio.rs    CREATE  # end-to-end JSON-RPC-over-stdio smoke
README.md                         MODIFY  # Claude Code MCP config snippet
```

---

## Task 1: Workspace wiring + `notes` adapter (pure, tested)

**Files:**
- Modify: `Cargo.toml` (workspace members)
- Create: `crates/naan-mcp/Cargo.toml`
- Create: `crates/naan-mcp/src/notes.rs`
- Create: `crates/naan-mcp/src/main.rs` (temporary stub so the crate builds)

**Interfaces:**
- Produces `notes` module: serde structs `NoteSummary { id, title, tags, created, updated }` (all strings except tags: Vec<String>) and `NoteFull { id, title, tags, created, updated, body }`, plus a `Notes` adapter built from a notes dir:
  - `Notes::new(dir: PathBuf) -> Self`
  - `list(&self) -> Result<Vec<NoteSummary>, naan_core::Error>`
  - `read(&self, id: &str) -> Result<NoteFull, Error>`
  - `search(&self, text: &str, tags: Vec<String>) -> Result<Vec<NoteSummary>, Error>`
  - `create(&self, title: String, body: String, tags: Vec<String>) -> Result<NoteSummary, Error>`
  - `update(&self, id: &str, title: Option<String>, body: Option<String>, tags: Option<Vec<String>>) -> Result<NoteSummary, Error>`
  - `delete(&self, id: &str) -> Result<(), Error>`

- [ ] **Step 1: Add the crate to the workspace + create its manifest**

`Cargo.toml` (root) — add `"crates/naan-mcp"` to `workspace.members`.

`crates/naan-mcp/Cargo.toml`:

```toml
[package]
name = "naan-mcp"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "naan-mcp"
path = "src/main.rs"

[dependencies]
naan-core = { path = "../naan-core" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
# rmcp + tokio are added in Task 2 (verify versions via context7 there)

[dev-dependencies]
tempfile = "3"
```

Temporary `crates/naan-mcp/src/main.rs` so it compiles:

```rust
mod notes;

fn main() {
    // Real entrypoint arrives in Task 2.
    eprintln!("naan-mcp: server entrypoint added in Task 2");
}
```

- [ ] **Step 2: Write the failing adapter tests**

Create `crates/naan-mcp/src/notes.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make() -> (TempDir, Notes) {
        let d = TempDir::new().unwrap();
        let n = Notes::new(d.path().to_path_buf());
        (d, n)
    }

    #[test]
    fn create_read_update_search_delete_roundtrip() {
        let (_d, n) = make();
        let created = n.create("Shopping".into(), "milk".into(), vec!["home".into()]).unwrap();
        assert_eq!(created.title, "Shopping");
        assert!(!created.id.is_empty());

        assert_eq!(n.list().unwrap().len(), 1);

        let full = n.read(&created.id).unwrap();
        assert_eq!(full.body, "milk");
        assert_eq!(full.tags, vec!["home"]);

        n.update(&created.id, None, Some("milk, eggs".into()), None).unwrap();
        assert_eq!(n.read(&created.id).unwrap().body, "milk, eggs");

        let hits = n.search("eggs", vec![]).unwrap();
        assert_eq!(hits.len(), 1);
        let tag_hits = n.search("", vec!["home".into()]).unwrap();
        assert_eq!(tag_hits.len(), 1);

        n.delete(&created.id).unwrap();
        assert!(n.list().unwrap().is_empty());
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p naan-mcp` — FAIL (adapter/types undefined).

- [ ] **Step 4: Implement `notes.rs`**

Prepend to `crates/naan-mcp/src/notes.rs`:

```rust
use naan_core::{
    search, Error, FsNoteStore, NaiveSearcher, NewNote, NoteId, NoteMeta, NoteStore, NotePatch,
    SearchQuery,
};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize)]
pub struct NoteFull {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
    pub body: String,
}

impl From<&NoteMeta> for NoteSummary {
    fn from(m: &NoteMeta) -> Self {
        NoteSummary {
            id: m.id.as_str().to_owned(),
            title: m.title.clone(),
            tags: m.tags.clone(),
            created: m.created.to_rfc3339(),
            updated: m.updated.to_rfc3339(),
        }
    }
}

pub struct Notes {
    dir: PathBuf,
}

impl Notes {
    pub fn new(dir: PathBuf) -> Self {
        Notes { dir }
    }

    fn store(&self) -> FsNoteStore {
        FsNoteStore::new(self.dir.clone())
    }

    pub fn list(&self) -> Result<Vec<NoteSummary>, Error> {
        Ok(self.store().list()?.iter().map(NoteSummary::from).collect())
    }

    pub fn read(&self, id: &str) -> Result<NoteFull, Error> {
        let note = self.store().get(&NoteId::parse(id))?;
        Ok(NoteFull {
            id: note.meta.id.as_str().to_owned(),
            title: note.meta.title,
            tags: note.meta.tags,
            created: note.meta.created.to_rfc3339(),
            updated: note.meta.updated.to_rfc3339(),
            body: note.body,
        })
    }

    pub fn search(&self, text: &str, tags: Vec<String>) -> Result<Vec<NoteSummary>, Error> {
        let store = self.store();
        let q = SearchQuery { text: text.to_owned(), tags };
        Ok(search(&store, &NaiveSearcher, &q)?.iter().map(NoteSummary::from).collect())
    }

    pub fn create(&self, title: String, body: String, tags: Vec<String>) -> Result<NoteSummary, Error> {
        let note = self.store().create(NewNote { title, body, tags })?;
        Ok(NoteSummary::from(&note.meta))
    }

    pub fn update(
        &self,
        id: &str,
        title: Option<String>,
        body: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<NoteSummary, Error> {
        let note = self.store().update(&NoteId::parse(id), NotePatch { title, body, tags })?;
        Ok(NoteSummary::from(&note.meta))
    }

    pub fn delete(&self, id: &str) -> Result<(), Error> {
        self.store().delete(&NoteId::parse(id))
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p naan-mcp` — PASS. Also `cargo build --workspace` (the stub bin builds).

- [ ] **Step 6: Commit**

```bash
cargo fmt -p naan-mcp && cargo clippy --workspace -- -D warnings
git add Cargo.toml Cargo.lock crates/naan-mcp
git commit -m "feat(mcp): naan-mcp crate + pure notes adapter over naan-core

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: MCP server + 6 tools (rmcp, stdio)

**Files:**
- Modify: `crates/naan-mcp/Cargo.toml` (add `rmcp`, `tokio`)
- Create: `crates/naan-mcp/src/server.rs`
- Replace: `crates/naan-mcp/src/main.rs` (real entrypoint)

**REQUIRED — verify the rmcp API first via context7.** Call `mcp__plugin_context7_context7__resolve-library-id` for "rmcp" (the Rust `modelcontextprotocol` SDK), then `query-docs` for: "server tool router #[tool] macro stdio transport ServerHandler serve". Confirm: the current crate version; how tools are declared (attribute macro vs manual `list_tools`/`call_tool`); how a tool's JSON input schema is derived (e.g. a `#[derive(JsonSchema, Deserialize)]` params struct — note the required `schemars` dep if so); and how to run over stdio (`serve` + `stdio()` transport). Pin exact versions and adapt the code below to the real API; record what the real API was in your report.

**Interfaces:**
- Consumes `notes::Notes`.
- Produces a runnable stdio MCP server exposing the 6 tools in the contract table, each calling `Notes` and mapping `naan_core::Error` to an MCP tool error.

- [ ] **Step 1: Add deps** (pin the versions context7 reports; example shape)

```toml
rmcp = { version = "<current>", features = ["server", "transport-io", "macros"] }  # confirm feature names via context7
tokio = { version = "1", features = ["rt-multi-thread", "macros", "io-std"] }
schemars = "<current>"   # only if rmcp derives tool schemas via schemars — confirm
```

- [ ] **Step 2: Implement `server.rs`** — a server struct holding `Notes`, with the 6 tools. Adapt to the confirmed rmcp API. Expected shape (verify each macro/type against context7):

```rust
// Sketch — adapt names/macros to the confirmed rmcp API.
use crate::notes::Notes;
use rmcp::{/* ServerHandler, tool, tool_router, model::*, ... confirm */};
use serde::Deserialize;

pub struct NaanServer {
    notes: Notes,
}

impl NaanServer {
    pub fn new(notes: Notes) -> Self {
        NaanServer { notes }
    }
}

#[derive(Deserialize /*, schemars::JsonSchema if required */)]
pub struct IdArg { pub id: String }
#[derive(Deserialize)]
pub struct SearchArg { pub text: String, #[serde(default)] pub tags: Vec<String> }
#[derive(Deserialize)]
pub struct CreateArg { pub title: String, #[serde(default)] pub body: String, #[serde(default)] pub tags: Vec<String> }
#[derive(Deserialize)]
pub struct UpdateArg { pub id: String, pub title: Option<String>, pub body: Option<String>, pub tags: Option<Vec<String>> }

// Each tool: call self.notes.<op>(...), serialize the result to JSON text content,
// and map Err(naan_core::Error) to an rmcp tool error with e.to_string().
// Tools: list_notes(), read_note(IdArg), search_notes(SearchArg),
//        create_note(CreateArg), update_note(UpdateArg), delete_note(IdArg) -> {"ok": true}
```

Each handler: run the adapter call, on `Ok(v)` return `serde_json::to_string(&v)` as the tool's text result; on `Err(e)` return a tool error carrying `e.to_string()`. Never panic.

- [ ] **Step 3: Implement `main.rs`** — resolve the notes dir, build `Notes`, start the server over stdio:

```rust
mod notes;
mod server;

use std::path::PathBuf;

fn notes_dir() -> PathBuf {
    // 1) --notes-dir <path>   2) $NAAN_NOTES_DIR   3) ~/Documents/naan
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--notes-dir" {
            if let Some(p) = args.next() {
                return PathBuf::from(p);
            }
        }
    }
    if let Ok(p) = std::env::var("NAAN_NOTES_DIR") {
        return PathBuf::from(p);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join("Documents").join("naan")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = notes_dir();
    std::fs::create_dir_all(&dir)?;
    let server = server::NaanServer::new(notes::Notes::new(dir));
    // Start over stdio — confirm the exact call via context7, e.g.:
    //   let service = server.serve(rmcp::transport::stdio()).await?;
    //   service.waiting().await?;
    server::run_stdio(server).await?;   // implement run_stdio in server.rs per the real API
    Ok(())
}
```

- [ ] **Step 4: Build**

Run: `cargo build -p naan-mcp` — clean. `cargo clippy --workspace -- -D warnings` — clean. (No unit tests for the server glue itself; the stdio smoke in Task 3 exercises it end-to-end.)

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-mcp
git add crates/naan-mcp Cargo.toml Cargo.lock
git commit -m "feat(mcp): stdio MCP server exposing 6 note tools

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: End-to-end stdio smoke test + README

**Files:**
- Create: `crates/naan-mcp/tests/stdio.rs`
- Modify: `README.md`

**Interfaces:** consumes the built `naan-mcp` binary via `CARGO_BIN_EXE_naan-mcp`.

- [ ] **Step 1: Write the failing integration test**

Create `crates/naan-mcp/tests/stdio.rs`. It spawns the binary with a temp notes dir, performs the MCP handshake and a `create_note` + `list_notes` over stdio (newline-delimited JSON-RPC), and asserts the created note comes back. Confirm the exact JSON-RPC framing/method names rmcp expects from the context7 docs (initialize → notifications/initialized → tools/call). Shape:

```rust
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tempfile::TempDir;

fn send(stdin: &mut impl Write, msg: &str) {
    stdin.write_all(msg.as_bytes()).unwrap();
    stdin.write_all(b"\n").unwrap();
    stdin.flush().unwrap();
}

#[test]
fn create_then_list_over_stdio() {
    let dir = TempDir::new().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_naan-mcp"))
        .arg("--notes-dir").arg(dir.path())
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit())
        .spawn().unwrap();

    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap());

    // 1) initialize  2) notifications/initialized  3) tools/call create_note  4) tools/call list_notes
    // (Exact JSON per the rmcp/MCP version confirmed via context7.)
    send(&mut stdin, r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"<confirm>","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}"#);
    let mut line = String::new();
    stdout.read_line(&mut line).unwrap();
    assert!(line.contains("\"result\""), "initialize response: {line}");

    send(&mut stdin, r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#);
    send(&mut stdin, r#"{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_note","arguments":{"title":"Hello","body":"world"}}}"#);
    line.clear(); stdout.read_line(&mut line).unwrap();
    assert!(line.contains("Hello"), "create_note response: {line}");

    send(&mut stdin, r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_notes","arguments":{}}}"#);
    line.clear(); stdout.read_line(&mut line).unwrap();
    assert!(line.contains("Hello"), "list_notes response: {line}");

    drop(stdin);
    let _ = child.wait();
    // the note file really exists on disk
    assert!(std::fs::read_dir(dir.path()).unwrap().count() >= 1);
}
```

Adapt the exact JSON-RPC (protocolVersion string, whether responses are one-per-line, tools/call result shape) to what context7 says the current rmcp/MCP produces. If rmcp frames responses differently (e.g. content blocks), assert on the substring that proves the note round-tripped.

- [ ] **Step 2: Run it to verify it fails, then passes**

Run: `cargo test -p naan-mcp --test stdio` — should FAIL first if anything's off, then PASS once the server + framing are correct. If the handshake shape is wrong, fix the test's JSON per context7 (this is discovering the real protocol, not a code defect) — but the server itself must genuinely answer.

- [ ] **Step 3: README — Claude Code MCP config**

Add an "Agents (MCP)" section to `README.md`: build the binary (`cargo build -p naan-mcp --release`), then register it with Claude Code, e.g.:

```json
{
  "mcpServers": {
    "naan": {
      "command": "/absolute/path/to/target/release/naan-mcp",
      "args": ["--notes-dir", "/Users/you/Documents/naan"]
    }
  }
}
```

List the 6 tools and one line each. Keep it short.

- [ ] **Step 4: Final gates + commit**

Run: `cargo test --workspace` (all green, incl. the stdio smoke); `cargo clippy --workspace -- -D warnings` (clean).

```bash
cargo fmt --all
git add crates/naan-mcp/tests README.md
git commit -m "test(mcp): end-to-end stdio smoke + MCP setup docs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done when

- `cargo test --workspace` green including the `naan-mcp` adapter tests + the stdio smoke.
- `cargo clippy --workspace -- -D warnings` clean.
- `naan-mcp --notes-dir <dir>` runs an MCP server that a client can `initialize`, `tools/list` (6 tools), and `tools/call` to create/read/search/update/delete notes as real `.md` files in `<dir>`.
- README documents the Claude Code config.
