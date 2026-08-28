# Phase 2: Tauri App Backend + Minimal Notes UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `naan-core` into the Tauri app: typed commands (CRUD + search), config-persisted notes folder chosen on first launch, a file watcher that live-refreshes, and a deliberately minimal (disposable) React notes list so you can open naan and see/click your real notes.

**Architecture:** `naan-core` stays transport-agnostic. The `naan` Tauri crate (`src-tauri`) adds a testable `service` layer (dir → DTOs, backed by `naan-core`), a `config` module (persist the notes folder), thin `#[tauri::command]` wrappers, and a `notify`-based file watcher emitting a `notes-changed` event. The frontend talks to Rust only through one typed `notesApi.ts` boundary. All note data crosses the IPC boundary as DTOs (app-layer serde structs), never core types.

**Tech Stack:** Rust 2021, Tauri v2, `naan-core` (path dep), `tauri-plugin-dialog` (folder picker), `notify` + `notify-debouncer-full` (file watcher), `serde`/`serde_json`; React 19 + TypeScript + `@tauri-apps/api` (no UI library yet — Tailwind/Base UI arrive in Phase 3).

**Spec:** `docs/superpowers/specs/2026-08-28-naan-notes-design.md`

## Global Constraints

- `naan-core` stays free of Tauri/serialization coupling. The ONLY allowed `naan-core` changes are in Task 1 (a public `NoteId` constructor + a batch `all()` method). Everything else lives in `src-tauri` or the frontend.
- Note data crosses IPC as **DTOs** defined in `src-tauri` — never expose `naan-core` types directly to JS.
- `#[tauri::command]` functions return `Result<T, String>` (map `naan_core::Error` via `.to_string()`), and stay THIN — all real logic lives in the testable `service`/`config` modules.
- No `unwrap()`/`expect()`/`panic!` in non-test Rust code. `cargo clippy --workspace -- -D warnings` clean; `cargo fmt` applied. The `naan-core` clippy gate (`unwrap_used`/`expect_used`/`panic`) stays.
- **Minimal, disposable UI.** The React in this phase is a bare functional shell to prove the backend — NOT the real UI. No Tailwind, no Base UI, no motion, no component library. Plain elements + a small CSS file. It will be replaced in Phase 3+. Do not over-invest.
- External native-lib APIs (`tauri-plugin-dialog`, `notify`, `notify-debouncer-full`) change across versions: for Tasks 6 & 7 the implementer MUST confirm the current API via the context7 docs tool before coding, and adapt the sample code to the real API. A doc-confirmed adjustment is expected, not a deviation to flag.
- TDD applies to the pure Rust logic (Tasks 1–4). Tauri glue, the watcher, the dialog, and the frontend (Tasks 5–9) are verified by a `tauri dev` smoke checklist (Task 10), not unit tests — this matches the spec's testing section (frontend tests deferred).
- Commit style: conventional messages ending with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Do NOT create/switch branches (the executor's skill owns the branch).

---

## File Structure

```
crates/naan-core/src/model.rs      MODIFY  # NoteId::parse (public constructor)
crates/naan-core/src/store.rs      MODIFY  # NoteStore::all() + FsNoteStore impl
crates/naan-core/src/lib.rs        MODIFY  # load_all/search route through all()
src-tauri/Cargo.toml               MODIFY  # add naan-core, dialog, notify, debouncer
src-tauri/src/dto.rs               CREATE  # DTOs + From mappings + inputs
src-tauri/src/config.rs            CREATE  # load/save notes dir (JSON)
src-tauri/src/service.rs           CREATE  # NotesService: dir -> DTO ops (testable)
src-tauri/src/state.rs             CREATE  # AppState (notes dir, config path, watcher)
src-tauri/src/commands.rs          CREATE  # thin #[tauri::command] wrappers
src-tauri/src/watcher.rs           CREATE  # notify debouncer -> emit "notes-changed"
src-tauri/src/lib.rs               MODIFY  # wire plugins, state, setup, handlers
src-tauri/capabilities/default.json MODIFY # add dialog + event permissions
src/lib/notesApi.ts                CREATE  # typed invoke wrappers + onNotesChanged
src/lib/types.ts                   CREATE  # TS types mirroring the DTOs
src/App.tsx                        REPLACE # minimal notes UI
src/App.css                        REPLACE # minimal styling
README.md                          MODIFY  # dev-run + folder notes
```

---

## Task 1: `naan-core` — public `NoteId::parse` + batch `all()`

**Why:** The app layer must rebuild a `NoteId` from a string it round-tripped through JS, and Phase 1 deferred an O(n²)/TOCTOU issue in `load_all`. Both are small core changes.

**Files:**
- Modify: `crates/naan-core/src/model.rs`
- Modify: `crates/naan-core/src/store.rs`
- Modify: `crates/naan-core/src/lib.rs`

**Interfaces:**
- Consumes: existing core.
- Produces: `NoteId::parse(s: impl Into<String>) -> NoteId` (public); `NoteStore::all(&self) -> Result<Vec<Note>>`; `load_all`/`search` now delegate to `all()`.

- [ ] **Step 1: Write failing tests**

Add to `crates/naan-core/src/model.rs` tests module:

```rust
    #[test]
    fn parse_rebuilds_an_id_from_string() {
        let id = NoteId::parse("01ABCDEF");
        assert_eq!(id.as_str(), "01ABCDEF");
        assert!(id.is_managed());
    }
```

Add to `crates/naan-core/src/store.rs` tests module:

```rust
    #[test]
    fn all_reads_every_note_with_body_sorted_newest_first() {
        let (_d, store) = store();
        store.create(NewNote { title: "One".into(), body: "a".into(), ..Default::default() }).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        store.create(NewNote { title: "Two".into(), body: "b".into(), ..Default::default() }).unwrap();
        let all = store.all().unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].meta.title, "Two"); // newest first
        assert_eq!(all[0].body, "b");         // bodies included
    }

    #[test]
    fn all_skips_malformed_files() {
        let (dir, store) = store();
        store.create(NewNote { title: "Good".into(), ..Default::default() }).unwrap();
        std::fs::write(dir.path().join("bad.md"), "---\nnot: a: valid: mapping\n---\n").unwrap();
        assert_eq!(store.all().unwrap().len(), 1); // bad file skipped, not an error
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p naan-core`
Expected: FAIL — `NoteId::parse` and `NoteStore::all` don't exist.

- [ ] **Step 3: Implement**

In `crates/naan-core/src/model.rs`, replace the existing `pub(crate) fn from_stored(...)` with a public constructor (and update its one caller in `store.rs`, Step-3 below):

```rust
    /// Rebuild an id from a string previously issued by naan (round-tripped
    /// through the UI or an MCP client). Unknown ids resolve to NotFound on
    /// lookup, so this is safe to expose.
    pub fn parse(s: impl Into<String>) -> Self {
        NoteId(s.into())
    }
```

In `crates/naan-core/src/store.rs`: (a) change the `read_note` call that used `from_stored` to `NoteId::parse(v.clone())`; (b) add `all` to the trait and impl:

```rust
// in `pub trait NoteStore { ... }` add:
    fn all(&self) -> Result<Vec<Note>>;
```

```rust
// in `impl NoteStore for FsNoteStore { ... }` add:
    fn all(&self) -> Result<Vec<Note>> {
        // read each file once; skip unreadable/malformed files
        let mut notes: Vec<Note> = self
            .md_files()?
            .iter()
            .filter_map(|p| self.read_note(p).ok())
            .collect();
        notes.sort_by_key(|n| std::cmp::Reverse(n.meta.updated));
        Ok(notes)
    }
```

In `crates/naan-core/src/lib.rs`, route the convenience fns through `all()` (removes the O(n²) list+get and the TOCTOU window):

```rust
/// Load every note with its body (single directory scan).
pub fn load_all(store: &dyn NoteStore) -> Result<Vec<Note>> {
    store.all()
}

/// Run a search: load all notes, then delegate to the searcher.
pub fn search(
    store: &dyn NoteStore,
    searcher: &dyn Searcher,
    query: &SearchQuery,
) -> Result<Vec<NoteMeta>> {
    let notes = store.all()?;
    Ok(searcher.search(&notes, query))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan-core`
Expected: PASS (all prior + 3 new).

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan-core && cargo clippy --workspace -- -D warnings
git add crates/naan-core
git commit -m "feat(core): public NoteId::parse + batch NoteStore::all()

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `src-tauri` deps + DTOs

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/dto.rs`

**Interfaces:**
- Produces (serde structs for the JS boundary):
  - `NoteMetaDto { id: String, title: String, tags: Vec<String>, created: String, updated: String }` (Serialize) — `created`/`updated` are RFC3339 strings.
  - `NoteDto { id, title, tags, created, updated, body: String }` (Serialize).
  - `NewNoteInput { title: String, body: String, tags: Vec<String> }` (Deserialize, Default).
  - `NotePatchInput { title: Option<String>, body: Option<String>, tags: Option<Vec<String>> }` (Deserialize, Default).
  - `SearchInput { text: String, tags: Vec<String> }` (Deserialize, Default).
  - `From<&NoteMeta> for NoteMetaDto`, `From<Note> for NoteDto`, and conversions `NewNoteInput -> naan_core::NewNote`, `NotePatchInput -> NotePatch`, `SearchInput -> SearchQuery`.

- [ ] **Step 1: Add dependencies**

In `src-tauri/Cargo.toml` `[dependencies]`, add:

```toml
naan-core = { path = "../crates/naan-core" }
tauri-plugin-dialog = "2"
notify = "8"
notify-debouncer-full = "0.5"
```

(Keep existing `tauri`, `tauri-plugin-opener`, `serde`, `serde_json`.) If `cargo` reports a different available version for `notify`/`notify-debouncer-full`, pin the current compatible pair and note it in the report.

- [ ] **Step 2: Write failing tests**

Create `src-tauri/src/dto.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use naan_core::{NewNote, NoteId, NoteMeta};
    use chrono::Utc;
    use std::path::PathBuf;

    #[test]
    fn meta_maps_to_dto_with_string_id_and_rfc3339_dates() {
        let now = Utc::now();
        let meta = NoteMeta {
            id: NoteId::parse("01ABC"),
            title: "Hi".into(),
            tags: vec!["x".into()],
            created: now,
            updated: now,
            path: PathBuf::new(),
        };
        let dto = NoteMetaDto::from(&meta);
        assert_eq!(dto.id, "01ABC");
        assert_eq!(dto.title, "Hi");
        assert_eq!(dto.tags, vec!["x"]);
        assert_eq!(dto.created, now.to_rfc3339());
    }

    #[test]
    fn new_note_input_converts_to_core() {
        let input = NewNoteInput { title: "T".into(), body: "B".into(), tags: vec!["t".into()] };
        let core: NewNote = input.into();
        assert_eq!(core.title, "T");
        assert_eq!(core.body, "B");
        assert_eq!(core.tags, vec!["t"]);
    }
}
```

`chrono` is needed for the test; add `chrono = { version = "0.4", features = ["serde"] }` to `src-tauri/Cargo.toml` `[dev-dependencies]` (create the section).

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test -p naan --lib` (add `mod dto;` to `src-tauri/src/lib.rs` first so the file compiles; put it near the top).
Expected: FAIL — DTO types undefined.

- [ ] **Step 4: Implement `dto.rs`**

Prepend to `src-tauri/src/dto.rs`:

```rust
use naan_core::{NewNote, Note, NoteMeta, NotePatch, SearchQuery};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct NoteMetaDto {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize)]
pub struct NoteDto {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
    pub body: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct NewNoteInput {
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct NotePatchInput {
    pub title: Option<String>,
    pub body: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Default, Deserialize)]
pub struct SearchInput {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl From<&NoteMeta> for NoteMetaDto {
    fn from(m: &NoteMeta) -> Self {
        NoteMetaDto {
            id: m.id.as_str().to_owned(),
            title: m.title.clone(),
            tags: m.tags.clone(),
            created: m.created.to_rfc3339(),
            updated: m.updated.to_rfc3339(),
        }
    }
}

impl From<Note> for NoteDto {
    fn from(n: Note) -> Self {
        NoteDto {
            id: n.meta.id.as_str().to_owned(),
            title: n.meta.title,
            tags: n.meta.tags,
            created: n.meta.created.to_rfc3339(),
            updated: n.meta.updated.to_rfc3339(),
            body: n.body,
        }
    }
}

impl From<NewNoteInput> for NewNote {
    fn from(i: NewNoteInput) -> Self {
        NewNote { title: i.title, body: i.body, tags: i.tags }
    }
}

impl From<NotePatchInput> for NotePatch {
    fn from(i: NotePatchInput) -> Self {
        NotePatch { title: i.title, body: i.body, tags: i.tags }
    }
}

impl From<SearchInput> for SearchQuery {
    fn from(i: SearchInput) -> Self {
        SearchQuery { text: i.text, tags: i.tags }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p naan --lib`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cargo fmt -p naan && cargo clippy --workspace -- -D warnings
git add src-tauri/Cargo.toml src-tauri/src/dto.rs src-tauri/src/lib.rs Cargo.lock
git commit -m "feat(app): DTOs for the IPC boundary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `config.rs` — persist the notes folder

**Files:**
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod config;`)

**Interfaces:**
- Produces:
  - `fn load_dir(config_path: &Path) -> Option<PathBuf>` — reads `{ "notes_dir": "..." }` JSON; `None` if missing/unreadable.
  - `fn save_dir(config_path: &Path, dir: &Path) -> std::io::Result<()>` — writes that JSON, creating parent dirs.

- [ ] **Step 1: Write failing tests**

Create `src-tauri/src/config.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn save_then_load_roundtrips() {
        let tmp = TempDir::new().unwrap();
        let cfg = tmp.path().join("naan").join("config.json");
        let notes = tmp.path().join("my-notes");
        save_dir(&cfg, &notes).unwrap();
        assert_eq!(load_dir(&cfg), Some(notes));
    }

    #[test]
    fn load_missing_returns_none() {
        let tmp = TempDir::new().unwrap();
        assert_eq!(load_dir(&tmp.path().join("nope.json")), None);
    }
}
```

Add `tempfile = "3"` to `src-tauri/Cargo.toml` `[dev-dependencies]`.

- [ ] **Step 2: Run tests to verify they fail**

Add `mod config;` to `src-tauri/src/lib.rs`. Run: `cargo test -p naan --lib`
Expected: FAIL — `load_dir`/`save_dir` undefined.

- [ ] **Step 3: Implement `config.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize)]
struct ConfigFile {
    notes_dir: String,
}

pub fn load_dir(config_path: &Path) -> Option<PathBuf> {
    let text = std::fs::read_to_string(config_path).ok()?;
    let cfg: ConfigFile = serde_json::from_str(&text).ok()?;
    Some(PathBuf::from(cfg.notes_dir))
}

pub fn save_dir(config_path: &Path, dir: &Path) -> std::io::Result<()> {
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let cfg = ConfigFile { notes_dir: dir.to_string_lossy().into_owned() };
    let json = serde_json::to_string_pretty(&cfg)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    std::fs::write(config_path, json)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan --lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan && cargo clippy --workspace -- -D warnings
git add src-tauri/src/config.rs src-tauri/src/lib.rs src-tauri/Cargo.toml Cargo.lock
git commit -m "feat(app): persist notes folder to config json

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `service.rs` — testable note operations returning DTOs

**Files:**
- Create: `src-tauri/src/service.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod service;`)

**Interfaces:**
- Produces `NotesService` — constructed from a notes dir; methods map `naan-core` ↔ DTOs:
  - `fn new(dir: PathBuf) -> Self`
  - `fn list(&self) -> Result<Vec<NoteMetaDto>, naan_core::Error>`
  - `fn get(&self, id: &str) -> Result<NoteDto, Error>`
  - `fn create(&self, input: NewNoteInput) -> Result<NoteMetaDto, Error>`
  - `fn update(&self, id: &str, patch: NotePatchInput) -> Result<NoteMetaDto, Error>`
  - `fn delete(&self, id: &str) -> Result<(), Error>`
  - `fn search(&self, query: SearchInput) -> Result<Vec<NoteMetaDto>, Error>`

- [ ] **Step 1: Write failing tests**

Create `src-tauri/src/service.rs` with the test block first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn svc() -> (TempDir, NotesService) {
        let d = TempDir::new().unwrap();
        let s = NotesService::new(d.path().to_path_buf());
        (d, s)
    }

    #[test]
    fn create_list_get_update_delete_search_roundtrip() {
        let (_d, s) = svc();
        let meta = s.create(NewNoteInput { title: "Shopping".into(), body: "milk".into(), tags: vec!["home".into()] }).unwrap();
        assert_eq!(s.list().unwrap().len(), 1);

        let got = s.get(&meta.id).unwrap();
        assert_eq!(got.title, "Shopping");
        assert_eq!(got.body, "milk");

        s.update(&meta.id, NotePatchInput { body: Some("milk, eggs".into()), ..Default::default() }).unwrap();
        assert_eq!(s.get(&meta.id).unwrap().body, "milk, eggs");

        let hits = s.search(SearchInput { text: "eggs".into(), tags: vec![] }).unwrap();
        assert_eq!(hits.len(), 1);

        s.delete(&meta.id).unwrap();
        assert!(s.list().unwrap().is_empty());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Add `mod service;` to `src-tauri/src/lib.rs`. Run: `cargo test -p naan --lib`
Expected: FAIL — `NotesService` undefined.

- [ ] **Step 3: Implement `service.rs`**

```rust
use crate::dto::{NewNoteInput, NoteDto, NoteMetaDto, NotePatchInput, SearchInput};
use naan_core::{search, Error, FsNoteStore, NaiveSearcher, NoteId, NoteStore};
use std::path::PathBuf;

pub struct NotesService {
    dir: PathBuf,
}

impl NotesService {
    pub fn new(dir: PathBuf) -> Self {
        NotesService { dir }
    }

    fn store(&self) -> FsNoteStore {
        FsNoteStore::new(self.dir.clone())
    }

    pub fn list(&self) -> Result<Vec<NoteMetaDto>, Error> {
        Ok(self.store().list()?.iter().map(NoteMetaDto::from).collect())
    }

    pub fn get(&self, id: &str) -> Result<NoteDto, Error> {
        Ok(self.store().get(&NoteId::parse(id))?.into())
    }

    pub fn create(&self, input: NewNoteInput) -> Result<NoteMetaDto, Error> {
        let note = self.store().create(input.into())?;
        Ok(NoteMetaDto::from(&note.meta))
    }

    pub fn update(&self, id: &str, patch: NotePatchInput) -> Result<NoteMetaDto, Error> {
        let note = self.store().update(&NoteId::parse(id), patch.into())?;
        Ok(NoteMetaDto::from(&note.meta))
    }

    pub fn delete(&self, id: &str) -> Result<(), Error> {
        self.store().delete(&NoteId::parse(id))
    }

    pub fn search(&self, query: SearchInput) -> Result<Vec<NoteMetaDto>, Error> {
        let store = self.store();
        let metas = search(&store, &NaiveSearcher, &query.into())?;
        Ok(metas.iter().map(NoteMetaDto::from).collect())
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test -p naan --lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan && cargo clippy --workspace -- -D warnings
git add src-tauri/src/service.rs src-tauri/src/lib.rs
git commit -m "feat(app): NotesService mapping core ops to DTOs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `AppState` + commands + app wiring

**Files:**
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `service::NotesService`, `config`.
- Produces:
  - `state::AppState { notes_dir: Mutex<Option<PathBuf>>, config_path: PathBuf }` with helpers `current_dir(&self) -> Option<PathBuf>` and `set_dir(&self, PathBuf)`.
  - Commands: `list_notes`, `get_note`, `create_note`, `update_note`, `delete_note`, `search_notes`, `get_notes_dir`, `default_notes_dir` — all `Result<_, String>`.
  - `run()` builds the app: manages state (config path from `app.path().app_config_dir()`), loads a saved dir into state, registers the dialog plugin (added in Task 6) and all handlers.

- [ ] **Step 1: Implement `state.rs`**

```rust
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub notes_dir: Mutex<Option<PathBuf>>,
    pub config_path: PathBuf,
}

impl AppState {
    pub fn current_dir(&self) -> Option<PathBuf> {
        self.notes_dir.lock().ok().and_then(|g| g.clone())
    }

    pub fn set_dir(&self, dir: PathBuf) {
        if let Ok(mut g) = self.notes_dir.lock() {
            *g = Some(dir);
        }
    }
}
```

- [ ] **Step 2: Implement `commands.rs`**

```rust
use crate::dto::{NewNoteInput, NoteDto, NoteMetaDto, NotePatchInput, SearchInput};
use crate::service::NotesService;
use crate::state::AppState;
use tauri::State;

fn service(state: &AppState) -> Result<NotesService, String> {
    state
        .current_dir()
        .map(NotesService::new)
        .ok_or_else(|| "no notes folder selected".to_string())
}

#[tauri::command]
pub fn get_notes_dir(state: State<'_, AppState>) -> Option<String> {
    state.current_dir().map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn default_notes_dir() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(home)
        .join("Documents")
        .join("naan")
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteMetaDto>, String> {
    service(&state)?.list().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note(state: State<'_, AppState>, id: String) -> Result<NoteDto, String> {
    service(&state)?.get(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(state: State<'_, AppState>, input: NewNoteInput) -> Result<NoteMetaDto, String> {
    service(&state)?.create(input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: String,
    patch: NotePatchInput,
) -> Result<NoteMetaDto, String> {
    service(&state)?.update(&id, patch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    service(&state)?.delete(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_notes(
    state: State<'_, AppState>,
    query: SearchInput,
) -> Result<Vec<NoteMetaDto>, String> {
    service(&state)?.search(query).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Rewrite `src-tauri/src/lib.rs` to wire everything**

Replace the greet demo with the module wiring, state setup, and handler registration. (The `set_notes_dir`/`pick_notes_dir` commands and the dialog plugin are added in Task 6; the watcher in Task 7 — leave clearly marked spots or add them in those tasks.)

```rust
mod commands;
mod config;
mod dto;
mod service;
mod state;

use state::AppState;
use std::path::PathBuf;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // config lives in the OS app-config dir
            let config_dir: PathBuf = app.path().app_config_dir()?;
            let config_path = config_dir.join("config.json");
            let saved = config::load_dir(&config_path);

            app.manage(AppState {
                notes_dir: std::sync::Mutex::new(saved),
                config_path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notes_dir,
            commands::default_notes_dir,
            commands::list_notes,
            commands::get_note,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::search_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify it builds and existing tests pass**

Run: `cargo build -p naan` (compiles the whole Tauri app)
Expected: builds clean.
Run: `cargo test -p naan --lib`
Expected: PASS (dto/config/service tests).
Run: `cargo clippy --workspace -- -D warnings`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan
git add src-tauri/src
git commit -m "feat(app): AppState + note commands wired into the Tauri app

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Folder picker + first-launch flow

**Files:**
- Modify: `src-tauri/Cargo.toml` (dialog dep already added in Task 2)
- Modify: `src-tauri/src/commands.rs` (`pick_notes_dir`, `set_notes_dir`)
- Modify: `src-tauri/src/lib.rs` (register dialog plugin + new handlers)
- Modify: `src-tauri/capabilities/default.json` (dialog permission)

**REQUIRED:** Before coding, confirm the current `tauri-plugin-dialog` v2 folder-picker API via the context7 docs tool (resolve `tauri-plugin-dialog`, query "blocking pick folder command rust"). The sample below is the expected shape; adapt to the real API and note any adjustment in the report.

**Interfaces:**
- Produces:
  - `pick_notes_dir(app) -> Option<String>` — opens the native folder dialog, returns the chosen path (does NOT save).
  - `set_notes_dir(app, state, dir: String) -> Result<(), String>` — creates the dir if needed, saves it to config, updates state, and (Task 7) re-points the watcher.

- [ ] **Step 1: Implement the commands** (`src-tauri/src/commands.rs`)

```rust
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn pick_notes_dir(app: AppHandle) -> Option<String> {
    // Confirm exact API via context7 (tauri-plugin-dialog v2).
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

#[tauri::command]
pub fn set_notes_dir(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    dir: String,
) -> Result<(), String> {
    let path = std::path::PathBuf::from(&dir);
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    crate::config::save_dir(&state.config_path, &path).map_err(|e| e.to_string())?;
    state.set_dir(path);
    // Task 7 will also re-point the file watcher here.
    let _ = app; // used by Task 7
    Ok(())
}
```

Add the needed imports (`use crate::state::AppState;` already present).

- [ ] **Step 2: Register the dialog plugin** — in `src-tauri/src/lib.rs`, add `.plugin(tauri_plugin_dialog::init())` to the builder, and add `commands::pick_notes_dir, commands::set_notes_dir` to `generate_handler!`.

- [ ] **Step 3: Grant the capability** — in `src-tauri/capabilities/default.json`, add `"dialog:default"` to `permissions`.

- [ ] **Step 4: Verify build**

Run: `cargo build -p naan` — clean.
Run: `cargo clippy --workspace -- -D warnings` — clean.
(The dialog itself is verified in the Task 10 smoke run.)

- [ ] **Step 5: Commit**

```bash
cargo fmt -p naan
git add src-tauri/src src-tauri/capabilities/default.json
git commit -m "feat(app): native folder picker + set/save notes dir

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: File watcher → `notes-changed` event

**Files:**
- Create: `src-tauri/src/watcher.rs`
- Modify: `src-tauri/src/state.rs` (hold the debouncer handle)
- Modify: `src-tauri/src/lib.rs` (start the watcher in setup for the saved dir)
- Modify: `src-tauri/src/commands.rs` (`set_notes_dir` re-points the watcher)
- Modify: `src-tauri/capabilities/default.json` (event permission if needed)

**REQUIRED:** Confirm the current `notify` + `notify-debouncer-full` API via context7 (resolve both, query "debounced watcher recommended new watch path"). The sample is the expected shape; adapt to the real API.

**Interfaces:**
- Produces:
  - `watcher::watch(app: AppHandle, dir: &Path) -> Result<Debouncer, String>` — starts a debounced watcher on `dir` that emits `"notes-changed"` (no payload) to all windows on any change.
  - `AppState` gains `watcher: Mutex<Option<Debouncer>>` (type alias for the debouncer) so it stays alive and can be replaced.

- [ ] **Step 1: Implement `watcher.rs`** (adapt to the confirmed API)

```rust
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

// Type alias hides the concrete generic debouncer type for storage in state.
pub type NotesWatcher = Debouncer<notify::RecommendedWatcher, notify_debouncer_full::RecommendedCache>;

pub fn watch(app: AppHandle, dir: &Path) -> Result<NotesWatcher, String> {
    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        None,
        move |res: DebounceEventResult| {
            if res.is_ok() {
                // ignore emit errors (no window yet, etc.)
                let _ = app.emit("notes-changed", ());
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    Ok(debouncer)
}
```

- [ ] **Step 2: Store the watcher in `state.rs`**

Add to `AppState`: `pub watcher: std::sync::Mutex<Option<crate::watcher::NotesWatcher>>,` and initialize it `None` wherever `AppState` is constructed.

- [ ] **Step 3: Start on setup + re-point on set_notes_dir**

In `lib.rs` setup, after managing state, if a saved dir exists start the watcher and store it:

```rust
if let Some(dir) = app.state::<AppState>().current_dir() {
    if let Ok(w) = watcher::watch(app.handle().clone(), &dir) {
        if let Ok(mut g) = app.state::<AppState>().watcher.lock() {
            *g = Some(w);
        }
    }
}
```

In `set_notes_dir` (commands.rs), after `state.set_dir(path.clone())`, replace the watcher:

```rust
if let Ok(w) = crate::watcher::watch(app.clone(), &path) {
    if let Ok(mut g) = state.watcher.lock() {
        *g = Some(w); // dropping the old debouncer stops the old watch
    }
}
```

Add `mod watcher;` to `lib.rs`.

- [ ] **Step 4: Capability** — if the frontend `listen("notes-changed")` is rejected at runtime, add `"core:event:default"` to `capabilities/default.json`. (Add it now to be safe.)

- [ ] **Step 5: Verify build**

Run: `cargo build -p naan` — clean. `cargo clippy --workspace -- -D warnings` — clean.
(Live behavior verified in Task 10.)

- [ ] **Step 6: Commit**

```bash
cargo fmt -p naan
git add src-tauri/src src-tauri/capabilities/default.json
git commit -m "feat(app): debounced file watcher emitting notes-changed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Frontend IPC boundary — `notesApi.ts` + types

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/notesApi.ts`

**Interfaces:**
- Produces typed wrappers over every command + a `onNotesChanged` subscription.

- [ ] **Step 1: `src/lib/types.ts`**

```ts
export interface NoteMeta {
  id: string;
  title: string;
  tags: string[];
  created: string;
  updated: string;
}

export interface Note extends NoteMeta {
  body: string;
}

export interface NewNoteInput {
  title: string;
  body: string;
  tags: string[];
}

export interface NotePatchInput {
  title?: string;
  body?: string;
  tags?: string[];
}

export interface SearchInput {
  text: string;
  tags: string[];
}
```

- [ ] **Step 2: `src/lib/notesApi.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Note, NoteMeta, NewNoteInput, NotePatchInput, SearchInput } from "./types";

export const notesApi = {
  getNotesDir: () => invoke<string | null>("get_notes_dir"),
  defaultNotesDir: () => invoke<string>("default_notes_dir"),
  pickNotesDir: () => invoke<string | null>("pick_notes_dir"),
  setNotesDir: (dir: string) => invoke<void>("set_notes_dir", { dir }),

  list: () => invoke<NoteMeta[]>("list_notes"),
  get: (id: string) => invoke<Note>("get_note", { id }),
  create: (input: NewNoteInput) => invoke<NoteMeta>("create_note", { input }),
  update: (id: string, patch: NotePatchInput) => invoke<NoteMeta>("update_note", { id, patch }),
  remove: (id: string) => invoke<void>("delete_note", { id }),
  search: (query: SearchInput) => invoke<NoteMeta[]>("search_notes", { query }),

  onNotesChanged: (cb: () => void): Promise<UnlistenFn> =>
    listen("notes-changed", () => cb()),
};
```

- [ ] **Step 3: Type-check**

Run: `npm run build` (runs `tsc`) — must compile with no type errors. (It also builds the frontend; that's fine.)

- [ ] **Step 4: Commit**

```bash
git add src/lib
git commit -m "feat(ui): typed notesApi IPC boundary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Minimal notes UI (`App.tsx`)

**Files:**
- Replace: `src/App.tsx`
- Replace: `src/App.css`
- (Delete unused `src/assets/react.svg` import usage — remove the import.)

**Deliverable:** a bare, functional two-pane app: pick-folder screen on first launch; a left list of notes (with a search box + new/delete); a right pane that shows the selected note's title + body in editable fields with a Save button; live refresh on `notes-changed`. Intentionally unstyled beyond a minimal CSS — this is disposable.

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { notesApi } from "./lib/notesApi";
import type { NoteMeta } from "./lib/types";
import "./App.css";

export default function App() {
  const [dir, setDir] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");

  const refresh = useCallback(async (query: string) => {
    const list = query.trim()
      ? await notesApi.search({ text: query, tags: [] })
      : await notesApi.list();
    setNotes(list);
  }, []);

  // initial load
  useEffect(() => {
    notesApi.getNotesDir().then(setDir);
  }, []);

  // load notes + subscribe to external changes once a folder is set
  useEffect(() => {
    if (!dir) return;
    refresh(q);
    const un = notesApi.onNotesChanged(() => refresh(q));
    return () => {
      un.then((f) => f());
    };
  }, [dir, q, refresh]);

  async function openNote(id: string) {
    const note = await notesApi.get(id);
    setSelected(id);
    setTitle(note.title);
    setBody(note.body);
  }

  async function save() {
    if (!selected) return;
    await notesApi.update(selected, { title, body });
    await refresh(q);
  }

  async function newNote() {
    const meta = await notesApi.create({ title: "Untitled", body: "", tags: [] });
    await refresh(q);
    await openNote(meta.id);
  }

  async function del(id: string) {
    await notesApi.remove(id);
    if (selected === id) {
      setSelected(null);
      setTitle("");
      setBody("");
    }
    await refresh(q);
  }

  async function chooseFolder() {
    const picked = (await notesApi.pickNotesDir()) ?? (await notesApi.defaultNotesDir());
    await notesApi.setNotesDir(picked);
    setDir(picked);
  }

  if (!dir) {
    return (
      <main className="setup">
        <h1>naan</h1>
        <p>Choose a folder to keep your notes in.</p>
        <button onClick={chooseFolder}>Choose folder</button>
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="toolbar">
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={newNote}>+ New</button>
        </div>
        <ul className="list">
          {notes.map((n) => (
            <li key={n.id} className={n.id === selected ? "active" : ""}>
              <button className="item" onClick={() => openNote(n.id)}>
                <span className="item-title">{n.title || "Untitled"}</span>
                {n.tags.length > 0 && <span className="item-tags">{n.tags.join(", ")}</span>}
              </button>
              <button className="del" title="Delete" onClick={() => del(n.id)}>
                ×
              </button>
            </li>
          ))}
          {notes.length === 0 && <li className="empty">No notes yet.</li>}
        </ul>
      </aside>

      <section className="editor">
        {selected ? (
          <>
            <input className="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="body" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="actions">
              <button onClick={save}>Save</button>
            </div>
          </>
        ) : (
          <p className="hint">Select a note, or create one.</p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/App.css`** with a minimal, plain layout (no framework):

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #1a1a1a; }
.setup { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; padding: 48px; }
.app { display: grid; grid-template-columns: 280px 1fr; height: 100vh; }
.sidebar { border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; min-height: 0; }
.toolbar { display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #eee; }
.toolbar input { flex: 1; padding: 6px 8px; }
.list { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
.list li { display: flex; align-items: center; border-bottom: 1px solid #f2f2f2; }
.list li.active { background: #f0f6ff; }
.item { flex: 1; text-align: left; background: none; border: 0; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.item-title { font-weight: 600; }
.item-tags { font-size: 12px; color: #888; }
.del { background: none; border: 0; color: #bbb; font-size: 18px; padding: 0 12px; cursor: pointer; }
.del:hover { color: #d00; }
.empty { padding: 12px; color: #999; }
.editor { display: flex; flex-direction: column; padding: 16px; gap: 12px; min-height: 0; }
.editor .title { font-size: 20px; font-weight: 700; border: 0; border-bottom: 1px solid #eee; padding: 6px 0; }
.editor .body { flex: 1; resize: none; border: 1px solid #eee; border-radius: 6px; padding: 12px; font: inherit; line-height: 1.5; }
.hint { color: #999; }
button { cursor: pointer; }
```

- [ ] **Step 3: Type-check + build**

Run: `npm run build` — compiles clean (no unused-import errors; ensure the old `greet`/logo imports are gone).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat(ui): minimal notes list + editor shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Integration smoke + docs

**Files:**
- Modify: `README.md`

**Deliverable:** confirm the whole thing runs end-to-end and document how to run it.

- [ ] **Step 1: Full build + all Rust tests**

Run: `cargo test --workspace` — all green.
Run: `cargo clippy --workspace -- -D warnings` — clean.
Run: `npm run build` — clean.

- [ ] **Step 2: Manual dev smoke** (do this and record the result in the report)

Run: `npm run tauri dev`, then verify:
1. First launch shows the "Choose folder" screen → picking a folder (or the default) loads the app.
2. `+ New` creates a note; it appears in the list; a matching `.md` file appears in the chosen folder on disk.
3. Editing title/body + Save persists (re-open the note shows the change; the `.md` file on disk reflects it).
4. Search filters the list.
5. Delete removes the note and its file.
6. Externally edit/add a `.md` file in the folder (e.g. `echo` a file) → within ~1s the list refreshes (watcher + `notes-changed`).

If any step fails, STOP and report it — do not paper over it.

- [ ] **Step 3: Update `README.md`**

Add a short "Run naan" section: prerequisites (Rust, Node), `npm install`, `npm run tauri dev`, where notes live (chosen folder, default `~/Documents/naan`), and that each note is a Markdown file with YAML frontmatter.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: how to run naan (Phase 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done when

- `cargo test --workspace` green; `cargo clippy --workspace -- -D warnings` clean; `npm run build` clean.
- `npm run tauri dev` opens a window where you can pick a folder, then create/edit/search/delete real Markdown notes, and the list live-refreshes when files change on disk.
- `naan-core` unchanged except Task 1; all note data crosses IPC as DTOs; commands are thin `Result<_, String>` wrappers.
