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
