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

/// Load every note with its body. ponytail: reads each file; fine for v1.
pub fn load_all(store: &dyn NoteStore) -> Result<Vec<Note>> {
    let mut notes = Vec::new();
    for m in store.list()? {
        match store.get(&m.id) {
            Ok(n) => notes.push(n),
            // tolerate a note removed between list() and get()
            Err(Error::NotFound(_)) => continue,
            Err(e) => return Err(e),
        }
    }
    Ok(notes)
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
