//! naan-core: pure note logic (storage + search), no UI/Tauri/MCP.

mod error;
// Consumed by Task 4's `store` module (crate-internal); not part of this
// crate's public API yet, so its items are dead code in isolation.
#[allow(dead_code)]
mod frontmatter;
mod model;

pub use error::{Error, Result};
pub use model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
