use chrono::{DateTime, Utc};
use std::path::PathBuf;

/// Stable identity for a note. Managed notes hold a ULID; files without
/// frontmatter get an in-memory `path:<filename>` id until adopted.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct NoteId(String);

impl NoteId {
    pub fn generate() -> Self {
        NoteId(ulid::Ulid::new().to_string())
    }

    pub fn from_path_name(file_name: &str) -> Self {
        NoteId(format!("path:{file_name}"))
    }

    /// Rebuild an id from a string previously issued by naan (round-tripped
    /// through the UI or an MCP client). Unknown ids resolve to NotFound on
    /// lookup, so this is safe to expose.
    pub fn parse(s: impl Into<String>) -> Self {
        NoteId(s.into())
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

    #[test]
    fn parse_rebuilds_an_id_from_string() {
        let id = NoteId::parse("01ABCDEF");
        assert_eq!(id.as_str(), "01ABCDEF");
        assert!(id.is_managed());
    }
}
