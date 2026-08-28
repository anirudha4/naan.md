//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

#![cfg_attr(
    not(test),
    warn(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

mod error;
mod frontmatter;
mod model;
mod search;
mod store;

pub use error::{Error, Result};
pub use model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
pub use search::{NaiveSearcher, SearchQuery, Searcher};
pub use store::{FsNoteStore, NoteStore};

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
