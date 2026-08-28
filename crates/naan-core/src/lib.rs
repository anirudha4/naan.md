//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

mod error;
mod model;

pub use error::{Error, Result};
pub use model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
