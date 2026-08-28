use naan_core::{NewNote, Note, NoteMeta, NotePatch, SearchQuery};
use serde::{Deserialize, Serialize};

// These DTOs are constructed only through their `From` impls, which are not
// yet called by any Tauri command (that wiring lands in a later task). Until
// then rustc's dead-code check can't see a live caller, hence the allows.
#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct NoteMetaDto {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
}

#[allow(dead_code)]
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
        NewNote {
            title: i.title,
            body: i.body,
            tags: i.tags,
        }
    }
}

impl From<NotePatchInput> for NotePatch {
    fn from(i: NotePatchInput) -> Self {
        NotePatch {
            title: i.title,
            body: i.body,
            tags: i.tags,
        }
    }
}

impl From<SearchInput> for SearchQuery {
    fn from(i: SearchInput) -> Self {
        SearchQuery {
            text: i.text,
            tags: i.tags,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use naan_core::{NewNote, NoteId, NoteMeta};
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
        let input = NewNoteInput {
            title: "T".into(),
            body: "B".into(),
            tags: vec!["t".into()],
        };
        let core: NewNote = input.into();
        assert_eq!(core.title, "T");
        assert_eq!(core.body, "B");
        assert_eq!(core.tags, vec!["t"]);
    }
}
