//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

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
