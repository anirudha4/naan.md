//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

mod error;
mod frontmatter;
mod model;
mod store;

pub use error::{Error, Result};
pub use model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
pub use store::{FsNoteStore, NoteStore};
