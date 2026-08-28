# Phase 1: `naan-core` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `naan-core`, a pure-Rust library with all note logic (domain types, frontmatter parse/serialize, a file-system `NoteStore`, and a naive `Searcher`), fully unit-tested, inside a new Cargo workspace.

**Architecture:** Notes are Markdown files with YAML frontmatter in a flat folder. `naan-core` has zero UI/Tauri/MCP knowledge — it exposes traits (`NoteStore`, `Searcher`) with default file-system implementations so storage and search are swappable later. The Tauri app and the MCP server (later phases) both depend on this crate.

**Tech Stack:** Rust 2021, `serde` + `serde_yaml_ng` (maintained YAML), `chrono` (timestamps), `ulid` (stable ids), `slug` (filenames), `thiserror` (errors), `tempfile` (test dirs).

**Spec:** `docs/superpowers/specs/2026-08-28-naan-notes-design.md`

## Global Constraints

- Rust edition 2021; Cargo workspace with `resolver = "2"`.
- Tauri crate stays at `src-tauri/` (idiomatic); do NOT rename it. Workspace members: `src-tauri`, `crates/naan-core`.
- YAML: use `serde_yaml_ng` (maintained). Do NOT use the archived `serde_yaml`.
- No `unwrap()` / `expect()` / `panic!` in library code paths. All fallible ops return `Result<T, naan_core::Error>`.
- Storage and search are behind traits (`NoteStore`, `Searcher`) with one default impl each. No other speculative abstractions.
- Note identity: managed notes carry a ULID in frontmatter. Files lacking an id get an in-memory `path:<filename>` id and are NOT rewritten on read. They are "adopted" (assigned a real ULID + full frontmatter written) only when edited via `update`.
- Notes are a FLAT folder of `*.md` (no subfolders in v1).
- `cargo clippy --workspace` must be clean before each commit; `cargo fmt` applied.

---

## File Structure

```
Cargo.toml                          # NEW: workspace root
.gitignore                          # MODIFY: ignore /target at repo root
src-tauri/Cargo.lock                # DELETE: workspace uses root lockfile
crates/naan-core/
├─ Cargo.toml                       # NEW
└─ src/
   ├─ lib.rs                        # public API surface + convenience fns
   ├─ error.rs                      # Error, Result
   ├─ model.rs                      # NoteId, NoteMeta, Note, NewNote, NotePatch
   ├─ frontmatter.rs                # parse() / serialize() (internal)
   ├─ store.rs                      # NoteStore trait + FsNoteStore
   └─ search.rs                     # Searcher trait + NaiveSearcher + SearchQuery
crates/naan-core/tests/
└─ roundtrip.rs                     # integration test over the public API
```

Responsibilities: one module per concern. `frontmatter` and `model` are leaf modules; `store` composes them; `search` depends only on `model`; `lib.rs` re-exports the public surface and adds `load_all` / `search` convenience functions.

---

## Task 1: Cargo workspace + `naan-core` scaffold

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `crates/naan-core/Cargo.toml`
- Create: `crates/naan-core/src/lib.rs`
- Modify: `.gitignore`
- Delete: `src-tauri/Cargo.lock`

**Interfaces:**
- Consumes: nothing.
- Produces: a compiling workspace with an empty `naan-core` crate.

- [ ] **Step 1: Stop the running dev server** (it holds `src-tauri/target`; the target dir moves to the repo root after this task)

If a `npm run tauri dev` is running, stop it. (The orchestrator started one earlier; kill it before restructuring.)

- [ ] **Step 2: Create the workspace root `Cargo.toml`**

Create `Cargo.toml` at the repo root:

```toml
[workspace]
resolver = "2"
members = ["src-tauri", "crates/naan-core"]
```

- [ ] **Step 3: Create `crates/naan-core/Cargo.toml`**

```toml
[package]
name = "naan-core"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_yaml_ng = "0.10"
chrono = { version = "0.4", features = ["serde"] }
ulid = "1"
slug = "0.1"
thiserror = "2"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 4: Create an empty `crates/naan-core/src/lib.rs`**

```rust
//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.
```

- [ ] **Step 5: Delete the stale per-crate lockfile**

```bash
git rm --cached src-tauri/Cargo.lock 2>/dev/null; rm -f src-tauri/Cargo.lock
```

- [ ] **Step 6: Ignore the repo-root target dir**

Append to the repo-root `.gitignore` (create the line if missing):

```
/target
```

- [ ] **Step 7: Verify the workspace builds and the app is unaffected**

Run: `cargo build --workspace`
Expected: builds successfully (compiles `naan-core` and the existing `naan` Tauri crate).

Run: `cargo test -p naan-core`
Expected: compiles; runs 0 tests, exit 0.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml crates .gitignore
git rm src-tauri/Cargo.lock 2>/dev/null
git commit -m "chore: add cargo workspace and naan-core crate scaffold

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Error type + domain model

**Files:**
- Create: `crates/naan-core/src/error.rs`
- Create: `crates/naan-core/src/model.rs`
- Modify: `crates/naan-core/src/lib.rs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Error` (enum) + `Result<T> = std::result::Result<T, Error>`.
  - `NoteId(pub String)` with `NoteId::generate() -> NoteId`, `NoteId::from_path_name(&str) -> NoteId`, `NoteId::is_managed(&self) -> bool`, `NoteId::as_str(&self) -> &str`.
  - `NoteMeta { id: NoteId, title: String, tags: Vec<String>, created: DateTime<Utc>, updated: DateTime<Utc>, path: PathBuf }`.
  - `Note { meta: NoteMeta, body: String }`.
  - `NewNote { title: String, body: String, tags: Vec<String> }` (Default).
  - `NotePatch { title: Option<String>, body: Option<String>, tags: Option<Vec<String>> }` (Default).

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `crates/naan-core/src/model.rs` (create the file with this test block first; the code above it comes in Step 3):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_id_is_a_valid_ulid_and_managed() {
        let id = NoteId::generate();
        assert!(ulid::Ulid::from_string(id.as_str()).is_ok());
        assert!(id.is_managed());
    }

    #[test]
    fn path_id_is_not_managed() {
        let id = NoteId::from_path_name("my-note.md");
        assert_eq!(id.as_str(), "path:my-note.md");
        assert!(!id.is_managed());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `error.rs`/`model.rs` not wired into `lib.rs`, `NoteId` undefined (compile error).

- [ ] **Step 3: Implement `error.rs` and `model.rs`**

`crates/naan-core/src/error.rs`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("yaml error: {0}")]
    Yaml(#[from] serde_yaml_ng::Error),
    #[error("note not found: {0}")]
    NotFound(String),
    #[error("invalid note: {0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, Error>;
```

Prepend to `crates/naan-core/src/model.rs` (above the `#[cfg(test)]` block from Step 1):

```rust
use chrono::{DateTime, Utc};
use std::path::PathBuf;

/// Stable identity for a note. Managed notes hold a ULID; files without
/// frontmatter get an in-memory `path:<filename>` id until adopted.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct NoteId(pub String);

impl NoteId {
    pub fn generate() -> Self {
        NoteId(ulid::Ulid::new().to_string())
    }

    pub fn from_path_name(file_name: &str) -> Self {
        NoteId(format!("path:{file_name}"))
    }

    pub fn is_managed(&self) -> bool {
        !self.0.starts_with("path:")
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct NoteMeta {
    pub id: NoteId,
    pub title: String,
    pub tags: Vec<String>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub path: PathBuf,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Note {
    pub meta: NoteMeta,
    pub body: String,
}

#[derive(Debug, Clone, Default)]
pub struct NewNote {
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct NotePatch {
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
}
```

Replace `crates/naan-core/src/lib.rs` with:

```rust
//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

mod error;
mod model;

pub use error::{Error, Result};
pub use model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy -p naan-core -- -D warnings
git add crates/naan-core/src
git commit -m "feat(core): add error type and domain model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Frontmatter parse / serialize

**Files:**
- Create: `crates/naan-core/src/frontmatter.rs`
- Modify: `crates/naan-core/src/lib.rs` (add `mod frontmatter;`)

**Interfaces:**
- Consumes: `crate::Error`.
- Produces (crate-internal):
  - `Frontmatter { id: String, title: String, tags: Vec<String>, created: DateTime<Utc>, updated: DateTime<Utc> }` (Serialize).
  - `RawFrontmatter { id: Option<String>, title: Option<String>, tags: Vec<String>, created: Option<DateTime<Utc>>, updated: Option<DateTime<Utc>> }` (Deserialize, Default).
  - `fn parse(content: &str) -> Result<(Option<RawFrontmatter>, String)>` — returns (frontmatter if a leading `---` block exists, body).
  - `fn serialize(fm: &Frontmatter, body: &str) -> Result<String>`.

- [ ] **Step 1: Write the failing tests**

Create `crates/naan-core/src/frontmatter.rs` with the test block first (code above it in Step 3):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let content = "---\nid: 01ABC\ntitle: Hello\ntags: [a, b]\ncreated: 2026-08-28T10:00:00Z\nupdated: 2026-08-28T10:00:00Z\n---\n\nBody text\n";
        let (raw, body) = parse(content).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01ABC"));
        assert_eq!(raw.title.as_deref(), Some("Hello"));
        assert_eq!(raw.tags, vec!["a", "b"]);
        assert_eq!(body, "Body text\n");
    }

    #[test]
    fn no_frontmatter_returns_none_and_full_body() {
        let content = "# Just a heading\n\nsome text";
        let (raw, body) = parse(content).unwrap();
        assert!(raw.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn serialize_then_parse_roundtrips() {
        use chrono::{TimeZone, Utc};
        let ts = Utc.with_ymd_and_hms(2026, 8, 28, 10, 0, 0).unwrap();
        let fm = Frontmatter {
            id: "01XYZ".into(),
            title: "Round Trip".into(),
            tags: vec!["x".into()],
            created: ts,
            updated: ts,
        };
        let text = serialize(&fm, "the body").unwrap();
        assert!(text.starts_with("---\n"));
        let (raw, body) = parse(&text).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01XYZ"));
        assert_eq!(raw.title.as_deref(), Some("Round Trip"));
        assert_eq!(body, "the body");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `frontmatter` module not declared, `parse`/`serialize`/`Frontmatter` undefined.

- [ ] **Step 3: Implement `frontmatter.rs`**

Prepend to `crates/naan-core/src/frontmatter.rs`:

```rust
use crate::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Frontmatter as written to disk (managed notes have every field).
#[derive(Debug, Serialize)]
pub struct Frontmatter {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
}

/// Tolerant parse target: any field may be absent in a hand-written file.
#[derive(Debug, Default, Deserialize)]
pub struct RawFrontmatter {
    pub id: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

/// Split file content into (optional frontmatter, body). Frontmatter must be
/// a leading fenced block: `---\n ... \n---\n`.
pub fn parse(content: &str) -> Result<(Option<RawFrontmatter>, String)> {
    if let Some(rest) = content.strip_prefix("---\n") {
        let (yaml, body) = if let Some(idx) = rest.find("\n---\n") {
            (&rest[..idx], rest[idx + 5..].to_string())
        } else if let Some(stripped) = rest.strip_suffix("\n---") {
            (stripped, String::new())
        } else {
            // Opening fence with no closing fence: treat as plain body.
            return Ok((None, content.to_string()));
        };
        let raw: RawFrontmatter = serde_yaml_ng::from_str(yaml)?;
        return Ok((Some(raw), body));
    }
    Ok((None, content.to_string()))
}

/// Serialize frontmatter + body into file content.
pub fn serialize(fm: &Frontmatter, body: &str) -> Result<String> {
    let yaml = serde_yaml_ng::to_string(fm)?;
    Ok(format!("---\n{yaml}---\n\n{body}"))
}
```

Add to `crates/naan-core/src/lib.rs` (after `mod model;`):

```rust
mod frontmatter;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy -p naan-core -- -D warnings
git add crates/naan-core/src
git commit -m "feat(core): frontmatter parse and serialize

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `FsNoteStore` — create / get / list

**Files:**
- Create: `crates/naan-core/src/store.rs`
- Modify: `crates/naan-core/src/lib.rs` (add `mod store;` + re-exports)

**Interfaces:**
- Consumes: `model` types, `frontmatter::{parse, serialize, Frontmatter}`, `Error`, `Result`.
- Produces:
  - `trait NoteStore { fn list(&self) -> Result<Vec<NoteMeta>>; fn get(&self, id: &NoteId) -> Result<Note>; fn create(&self, draft: NewNote) -> Result<Note>; fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note>; fn delete(&self, id: &NoteId) -> Result<()>; }`
  - `struct FsNoteStore` with `FsNoteStore::new(dir: impl Into<PathBuf>) -> Self`.
  - This task implements `list`, `get`, `create`; `update`/`delete` are stubbed to `unimplemented`-free `Err(Error::Invalid(...))` placeholders until Task 5 (so the trait compiles). Task 5 replaces them.

- [ ] **Step 1: Write the failing tests**

Create `crates/naan-core/src/store.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (TempDir, FsNoteStore) {
        let dir = TempDir::new().unwrap();
        let store = FsNoteStore::new(dir.path());
        (dir, store)
    }

    #[test]
    fn create_then_get_roundtrips() {
        let (_d, store) = store();
        let note = store
            .create(NewNote {
                title: "First".into(),
                body: "hello world".into(),
                tags: vec!["ideas".into()],
            })
            .unwrap();
        assert!(note.meta.id.is_managed());
        let fetched = store.get(&note.meta.id).unwrap();
        assert_eq!(fetched.meta.title, "First");
        assert_eq!(fetched.body, "hello world");
        assert_eq!(fetched.meta.tags, vec!["ideas"]);
    }

    #[test]
    fn create_uses_slug_filename_with_collision_suffix() {
        let (_d, store) = store();
        let a = store.create(NewNote { title: "My Note".into(), ..Default::default() }).unwrap();
        let b = store.create(NewNote { title: "My Note".into(), ..Default::default() }).unwrap();
        assert_eq!(a.meta.path.file_name().unwrap(), "my-note.md");
        assert_eq!(b.meta.path.file_name().unwrap(), "my-note-2.md");
    }

    #[test]
    fn list_returns_all_sorted_by_updated_desc() {
        let (_d, store) = store();
        store.create(NewNote { title: "One".into(), ..Default::default() }).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let two = store.create(NewNote { title: "Two".into(), ..Default::default() }).unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, two.meta.id); // newest first
    }

    #[test]
    fn plain_md_file_gets_path_id_and_title_from_heading() {
        let (dir, store) = store();
        std::fs::write(dir.path().join("dropped.md"), "# Dropped In\n\nbody").unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 1);
        assert!(!list[0].id.is_managed());
        assert_eq!(list[0].id.as_str(), "path:dropped.md");
        assert_eq!(list[0].title, "Dropped In");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `store` module not declared, `FsNoteStore` undefined.

- [ ] **Step 3: Implement `store.rs` (create/get/list + shared helpers; update/delete temporary)**

Prepend to `crates/naan-core/src/store.rs`:

```rust
use crate::frontmatter::{self, Frontmatter};
use crate::model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::{Path, PathBuf};

pub trait NoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>>;
    fn get(&self, id: &NoteId) -> Result<Note>;
    fn create(&self, draft: NewNote) -> Result<Note>;
    fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note>;
    fn delete(&self, id: &NoteId) -> Result<()>;
}

pub struct FsNoteStore {
    dir: PathBuf,
}

impl FsNoteStore {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        FsNoteStore { dir: dir.into() }
    }

    fn md_files(&self) -> Result<Vec<PathBuf>> {
        let mut out = Vec::new();
        if !self.dir.exists() {
            return Ok(out);
        }
        for entry in fs::read_dir(&self.dir)? {
            let path = entry?.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                out.push(path);
            }
        }
        Ok(out)
    }

    pub(crate) fn read_note(&self, path: &Path) -> Result<Note> {
        let content = fs::read_to_string(path)?;
        let (raw, body) = frontmatter::parse(&content)?;
        let raw = raw.unwrap_or_default();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let fs_time = file_mtime(path).unwrap_or_else(Utc::now);
        let id = match &raw.id {
            Some(v) => NoteId(v.clone()),
            None => NoteId::from_path_name(&file_name),
        };
        let title = raw
            .title
            .clone()
            .or_else(|| first_heading(&body))
            .unwrap_or_else(|| stem(path));
        let meta = NoteMeta {
            id,
            title,
            tags: raw.tags.clone(),
            created: raw.created.unwrap_or(fs_time),
            updated: raw.updated.unwrap_or(fs_time),
            path: path.to_path_buf(),
        };
        Ok(Note { meta, body })
    }

    pub(crate) fn find_path(&self, id: &NoteId) -> Result<PathBuf> {
        for path in self.md_files()? {
            if &self.read_note(&path)?.meta.id == id {
                return Ok(path);
            }
        }
        Err(Error::NotFound(id.0.clone()))
    }

    /// A free `slug.md` under `dir`, skipping `exclude` (the note's own path
    /// during rename). Appends `-2`, `-3`, ... on collision.
    pub(crate) fn unique_path(&self, title: &str, exclude: Option<&Path>) -> PathBuf {
        let base = slug::slugify(title);
        let base = if base.is_empty() { "untitled".to_string() } else { base };
        let mut candidate = self.dir.join(format!("{base}.md"));
        let mut n = 2;
        while candidate.exists() && Some(candidate.as_path()) != exclude {
            candidate = self.dir.join(format!("{base}-{n}.md"));
            n += 1;
        }
        candidate
    }

    pub(crate) fn write(&self, path: &Path, meta: &NoteMeta, body: &str) -> Result<()> {
        let fm = Frontmatter {
            id: meta.id.0.clone(),
            title: meta.title.clone(),
            tags: meta.tags.clone(),
            created: meta.created,
            updated: meta.updated,
        };
        let content = frontmatter::serialize(&fm, body)?;
        fs::create_dir_all(&self.dir)?;
        fs::write(path, content)?;
        Ok(())
    }
}

impl NoteStore for FsNoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>> {
        let mut metas = self
            .md_files()?
            .iter()
            .map(|p| self.read_note(p).map(|n| n.meta))
            .collect::<Result<Vec<_>>>()?;
        metas.sort_by(|a, b| b.updated.cmp(&a.updated));
        Ok(metas)
    }

    fn get(&self, id: &NoteId) -> Result<Note> {
        let path = self.find_path(id)?;
        self.read_note(&path)
    }

    fn create(&self, draft: NewNote) -> Result<Note> {
        let now = Utc::now();
        let path = self.unique_path(&draft.title, None);
        let meta = NoteMeta {
            id: NoteId::generate(),
            title: draft.title,
            tags: draft.tags,
            created: now,
            updated: now,
            path: path.clone(),
        };
        self.write(&path, &meta, &draft.body)?;
        Ok(Note { meta, body: draft.body })
    }

    fn update(&self, _id: &NoteId, _patch: NotePatch) -> Result<Note> {
        // Implemented in Task 5.
        Err(Error::Invalid("update not yet implemented".into()))
    }

    fn delete(&self, _id: &NoteId) -> Result<()> {
        // Implemented in Task 5.
        Err(Error::Invalid("delete not yet implemented".into()))
    }
}

fn file_mtime(path: &Path) -> Option<DateTime<Utc>> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    Some(DateTime::<Utc>::from(modified))
}

fn first_heading(body: &str) -> Option<String> {
    body.lines()
        .find_map(|l| l.strip_prefix("# ").map(|h| h.trim().to_string()))
}

fn stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}
```

Add to `crates/naan-core/src/lib.rs` (after `mod frontmatter;`):

```rust
mod store;

pub use store::{FsNoteStore, NoteStore};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy -p naan-core -- -D warnings
git add crates/naan-core/src
git commit -m "feat(core): FsNoteStore create/get/list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `FsNoteStore` — update / delete + adopt-on-edit

**Files:**
- Modify: `crates/naan-core/src/store.rs` (replace the two placeholder methods; add tests)

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: working `update` and `delete`. `update` bumps `updated`, renames the file when the title changes, and adopts unmanaged files (assigns a ULID + writes full frontmatter).

- [ ] **Step 1: Write the failing tests**

Add these tests inside the existing `mod tests` block in `crates/naan-core/src/store.rs`:

```rust
    #[test]
    fn update_patches_fields_and_bumps_updated() {
        let (_d, store) = store();
        let note = store.create(NewNote { title: "Orig".into(), body: "a".into(), ..Default::default() }).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let updated = store
            .update(&note.meta.id, NotePatch { body: Some("b".into()), tags: Some(vec!["t".into()]), ..Default::default() })
            .unwrap();
        assert_eq!(updated.body, "b");
        assert_eq!(updated.meta.tags, vec!["t"]);
        assert!(updated.meta.updated > note.meta.updated);
    }

    #[test]
    fn update_title_renames_the_file() {
        let (_d, store) = store();
        let note = store.create(NewNote { title: "Old Name".into(), ..Default::default() }).unwrap();
        let old_path = note.meta.path.clone();
        let updated = store
            .update(&note.meta.id, NotePatch { title: Some("New Name".into()), ..Default::default() })
            .unwrap();
        assert_eq!(updated.meta.path.file_name().unwrap(), "new-name.md");
        assert!(!old_path.exists());
    }

    #[test]
    fn editing_a_plain_file_adopts_it() {
        let (dir, store) = store();
        std::fs::write(dir.path().join("dropped.md"), "# Dropped\n\nbody").unwrap();
        let id = store.list().unwrap()[0].id.clone();
        assert!(!id.is_managed());
        let updated = store
            .update(&id, NotePatch { body: Some("new body".into()), ..Default::default() })
            .unwrap();
        assert!(updated.meta.id.is_managed()); // got a real ULID
        // re-reading yields the managed id and persisted frontmatter
        let reread = store.get(&updated.meta.id).unwrap();
        assert_eq!(reread.body, "new body");
        assert!(reread.meta.id.is_managed());
    }

    #[test]
    fn delete_removes_the_file() {
        let (_d, store) = store();
        let note = store.create(NewNote { title: "Bye".into(), ..Default::default() }).unwrap();
        store.delete(&note.meta.id).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(matches!(store.get(&note.meta.id), Err(Error::NotFound(_))));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `update`/`delete` return `Error::Invalid` (assertions fail).

- [ ] **Step 3: Replace the placeholder `update`/`delete`**

In `crates/naan-core/src/store.rs`, replace the two placeholder methods inside `impl NoteStore for FsNoteStore` with:

```rust
    fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note> {
        let path = self.find_path(id)?;
        let mut note = self.read_note(&path)?;

        // adopt-on-edit: unmanaged files earn a real ULID now
        if !note.meta.id.is_managed() {
            note.meta.id = NoteId::generate();
        }

        let old_title = note.meta.title.clone();
        if let Some(t) = patch.title {
            note.meta.title = t;
        }
        if let Some(b) = patch.body {
            note.body = b;
        }
        if let Some(tags) = patch.tags {
            note.meta.tags = tags;
        }
        note.meta.updated = Utc::now();

        let target = if note.meta.title != old_title {
            self.unique_path(&note.meta.title, Some(&path))
        } else {
            path.clone()
        };
        self.write(&target, &note.meta, &note.body)?;
        if target != path {
            fs::remove_file(&path)?;
        }
        note.meta.path = target;
        Ok(note)
    }

    fn delete(&self, id: &NoteId) -> Result<()> {
        let path = self.find_path(id)?;
        fs::remove_file(path)?;
        Ok(())
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (13 tests total).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy -p naan-core -- -D warnings
git add crates/naan-core/src
git commit -m "feat(core): FsNoteStore update/delete with adopt-on-edit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `Searcher` + `NaiveSearcher`

**Files:**
- Create: `crates/naan-core/src/search.rs`
- Modify: `crates/naan-core/src/lib.rs` (add `mod search;` + re-exports)

**Interfaces:**
- Consumes: `model::{Note, NoteMeta}`.
- Produces:
  - `struct SearchQuery { text: String, tags: Vec<String> }` (Default, Clone).
  - `trait Searcher { fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta>; }`
  - `struct NaiveSearcher` (Default) implementing `Searcher`: case-insensitive substring match across title/body/tags for `text`; every tag in `query.tags` must be present (AND).

- [ ] **Step 1: Write the failing tests**

Create `crates/naan-core/src/search.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Note, NoteId, NoteMeta};
    use chrono::Utc;
    use std::path::PathBuf;

    fn note(title: &str, body: &str, tags: &[&str]) -> Note {
        let now = Utc::now();
        Note {
            meta: NoteMeta {
                id: NoteId::generate(),
                title: title.into(),
                tags: tags.iter().map(|s| s.to_string()).collect(),
                created: now,
                updated: now,
                path: PathBuf::new(),
            },
            body: body.into(),
        }
    }

    #[test]
    fn text_matches_title_body_or_tags_case_insensitively() {
        let notes = vec![
            note("Grocery list", "milk and eggs", &["home"]),
            note("Ideas", "build NAAN", &["work"]),
        ];
        let s = NaiveSearcher;
        let hits = s.search(&notes, &SearchQuery { text: "naan".into(), tags: vec![] });
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Ideas");
    }

    #[test]
    fn empty_text_returns_all() {
        let notes = vec![note("A", "", &[]), note("B", "", &[])];
        let hits = NaiveSearcher.search(&notes, &SearchQuery::default());
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn tag_filter_requires_all_tags() {
        let notes = vec![
            note("A", "", &["x", "y"]),
            note("B", "", &["x"]),
        ];
        let hits = NaiveSearcher.search(
            &notes,
            &SearchQuery { text: String::new(), tags: vec!["x".into(), "y".into()] },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "A");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `search` module not declared, `NaiveSearcher`/`SearchQuery` undefined.

- [ ] **Step 3: Implement `search.rs`**

Prepend to `crates/naan-core/src/search.rs`:

```rust
use crate::model::{Note, NoteMeta};

#[derive(Debug, Clone, Default)]
pub struct SearchQuery {
    pub text: String,
    pub tags: Vec<String>,
}

pub trait Searcher {
    fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta>;
}

/// Linear scan over all notes.
// ponytail: O(n) full scan per query; swap for an inverted index if it drags.
#[derive(Debug, Default)]
pub struct NaiveSearcher;

impl Searcher for NaiveSearcher {
    fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta> {
        let needle = query.text.to_lowercase();
        notes
            .iter()
            .filter(|n| {
                let text_ok = needle.is_empty()
                    || n.meta.title.to_lowercase().contains(&needle)
                    || n.body.to_lowercase().contains(&needle)
                    || n.meta.tags.iter().any(|t| t.to_lowercase().contains(&needle));
                let tags_ok = query
                    .tags
                    .iter()
                    .all(|q| n.meta.tags.iter().any(|t| t.eq_ignore_ascii_case(q)));
                text_ok && tags_ok
            })
            .map(|n| n.meta.clone())
            .collect()
    }
}
```

Add to `crates/naan-core/src/lib.rs` (after `mod store;` re-exports):

```rust
mod search;

pub use search::{NaiveSearcher, SearchQuery, Searcher};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy -p naan-core -- -D warnings
git add crates/naan-core/src
git commit -m "feat(core): naive full-text + tag searcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Public convenience API + integration test

**Files:**
- Modify: `crates/naan-core/src/lib.rs` (add `load_all` + `search` free functions)
- Create: `crates/naan-core/tests/roundtrip.rs`

**Interfaces:**
- Consumes: the full public surface.
- Produces:
  - `pub fn load_all(store: &dyn NoteStore) -> Result<Vec<Note>>` — list then get each (bodies included).
  - `pub fn search(store: &dyn NoteStore, searcher: &dyn Searcher, query: &SearchQuery) -> Result<Vec<NoteMeta>>`.

- [ ] **Step 1: Write the failing integration test**

Create `crates/naan-core/tests/roundtrip.rs`:

```rust
use naan_core::{search, FsNoteStore, NaiveSearcher, NewNote, NoteStore, NotePatch, SearchQuery};
use tempfile::TempDir;

#[test]
fn full_lifecycle_through_public_api() {
    let dir = TempDir::new().unwrap();
    let store = FsNoteStore::new(dir.path());

    let a = store
        .create(NewNote { title: "Shopping".into(), body: "milk".into(), tags: vec!["home".into()] })
        .unwrap();
    store
        .create(NewNote { title: "Roadmap".into(), body: "ship naan".into(), tags: vec!["work".into()] })
        .unwrap();

    // search by text
    let hits = search(&store, &NaiveSearcher, &SearchQuery { text: "naan".into(), tags: vec![] }).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].title, "Roadmap");

    // search by tag
    let home = search(&store, &NaiveSearcher, &SearchQuery { text: String::new(), tags: vec!["home".into()] }).unwrap();
    assert_eq!(home.len(), 1);
    assert_eq!(home[0].title, "Shopping");

    // update + delete
    store.update(&a.meta.id, NotePatch { body: Some("milk, eggs".into()), ..Default::default() }).unwrap();
    assert_eq!(store.get(&a.meta.id).unwrap().body, "milk, eggs");
    store.delete(&a.meta.id).unwrap();
    assert_eq!(store.list().unwrap().len(), 1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p naan-core --test roundtrip`
Expected: FAIL — `search` / `load_all` not exported from the crate root.

- [ ] **Step 3: Add the convenience functions**

Append to `crates/naan-core/src/lib.rs`:

```rust
/// Load every note with its body. ponytail: reads each file; fine for v1.
pub fn load_all(store: &dyn NoteStore) -> Result<Vec<Note>> {
    store.list()?.iter().map(|m| store.get(&m.id)).collect()
}

/// Run a search: load all notes, then delegate to the searcher.
pub fn search(
    store: &dyn NoteStore,
    searcher: &dyn Searcher,
    query: &SearchQuery,
) -> Result<Vec<NoteMeta>> {
    let notes = load_all(store)?;
    Ok(searcher.search(&notes, query))
}
```

- [ ] **Step 4: Run the full test suite**

Run: `cargo test -p naan-core`
Expected: PASS (16 unit + integration tests).

- [ ] **Step 5: Final lint + commit**

```bash
cargo fmt -p naan-core && cargo clippy --workspace -- -D warnings
git add crates/naan-core
git commit -m "feat(core): public load_all/search convenience + integration test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done when

- `cargo test -p naan-core` is green (unit + integration).
- `cargo clippy --workspace -- -D warnings` is clean.
- The existing Tauri app still builds (`cargo build -p naan`).
- The public API exposes: `NoteId, NoteMeta, Note, NewNote, NotePatch, NoteStore, FsNoteStore, Searcher, NaiveSearcher, SearchQuery, Error, Result, load_all, search`.
