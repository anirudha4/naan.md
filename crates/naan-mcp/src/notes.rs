use naan_core::{
    search, Error, FsNoteStore, NaiveSearcher, NewNote, NoteId, NoteMeta, NotePatch, NoteStore,
    SearchQuery,
};
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize)]
pub struct NoteFull {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: String,
    pub updated: String,
    pub body: String,
}

impl From<&NoteMeta> for NoteSummary {
    fn from(m: &NoteMeta) -> Self {
        NoteSummary {
            id: m.id.as_str().to_owned(),
            title: m.title.clone(),
            tags: m.tags.clone(),
            created: m.created.to_rfc3339(),
            updated: m.updated.to_rfc3339(),
        }
    }
}

pub struct Notes {
    dir: PathBuf,
}

impl Notes {
    pub fn new(dir: PathBuf) -> Self {
        Notes { dir }
    }

    fn store(&self) -> FsNoteStore {
        FsNoteStore::new(self.dir.clone())
    }

    pub fn list(&self) -> Result<Vec<NoteSummary>, Error> {
        Ok(self.store().list()?.iter().map(NoteSummary::from).collect())
    }

    pub fn read(&self, id: &str) -> Result<NoteFull, Error> {
        let note = self.store().get(&NoteId::parse(id))?;
        Ok(NoteFull {
            id: note.meta.id.as_str().to_owned(),
            title: note.meta.title,
            tags: note.meta.tags,
            created: note.meta.created.to_rfc3339(),
            updated: note.meta.updated.to_rfc3339(),
            body: note.body,
        })
    }

    pub fn search(&self, text: &str, tags: Vec<String>) -> Result<Vec<NoteSummary>, Error> {
        let store = self.store();
        let q = SearchQuery {
            text: text.to_owned(),
            tags,
        };
        Ok(search(&store, &NaiveSearcher, &q)?
            .iter()
            .map(NoteSummary::from)
            .collect())
    }

    pub fn create(
        &self,
        title: String,
        body: String,
        tags: Vec<String>,
    ) -> Result<NoteSummary, Error> {
        let note = self.store().create(NewNote { title, body, tags })?;
        Ok(NoteSummary::from(&note.meta))
    }

    pub fn update(
        &self,
        id: &str,
        title: Option<String>,
        body: Option<String>,
        tags: Option<Vec<String>>,
    ) -> Result<NoteSummary, Error> {
        let note = self
            .store()
            .update(&NoteId::parse(id), NotePatch { title, body, tags })?;
        Ok(NoteSummary::from(&note.meta))
    }

    pub fn delete(&self, id: &str) -> Result<(), Error> {
        self.store().delete(&NoteId::parse(id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make() -> (TempDir, Notes) {
        let d = TempDir::new().unwrap();
        let n = Notes::new(d.path().to_path_buf());
        (d, n)
    }

    #[test]
    fn create_read_update_search_delete_roundtrip() {
        let (_d, n) = make();
        let created = n
            .create("Shopping".into(), "milk".into(), vec!["home".into()])
            .unwrap();
        assert_eq!(created.title, "Shopping");
        assert!(!created.id.is_empty());

        assert_eq!(n.list().unwrap().len(), 1);

        let full = n.read(&created.id).unwrap();
        assert_eq!(full.body, "milk");
        assert_eq!(full.tags, vec!["home"]);

        n.update(&created.id, None, Some("milk, eggs".into()), None)
            .unwrap();
        assert_eq!(n.read(&created.id).unwrap().body, "milk, eggs");

        let hits = n.search("eggs", vec![]).unwrap();
        assert_eq!(hits.len(), 1);
        let tag_hits = n.search("", vec!["home".into()]).unwrap();
        assert_eq!(tag_hits.len(), 1);

        n.delete(&created.id).unwrap();
        assert!(n.list().unwrap().is_empty());
    }
}
