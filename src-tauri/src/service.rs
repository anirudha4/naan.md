use crate::dto::{NewNoteInput, NoteDto, NoteMetaDto, NotePatchInput, SearchInput};
use naan_core::{search, Error, FsNoteStore, NaiveSearcher, NoteId, NoteStore};
use std::path::PathBuf;

pub struct NotesService {
    dir: PathBuf,
}

impl NotesService {
    pub fn new(dir: PathBuf) -> Self {
        NotesService { dir }
    }

    fn store(&self) -> FsNoteStore {
        FsNoteStore::new(self.dir.clone())
    }

    pub fn list(&self) -> Result<Vec<NoteMetaDto>, Error> {
        Ok(self.store().list()?.iter().map(NoteMetaDto::from).collect())
    }

    pub fn get(&self, id: &str) -> Result<NoteDto, Error> {
        Ok(self.store().get(&NoteId::parse(id))?.into())
    }

    pub fn create(&self, input: NewNoteInput) -> Result<NoteMetaDto, Error> {
        let note = self.store().create(input.into())?;
        Ok(NoteMetaDto::from(&note.meta))
    }

    pub fn update(&self, id: &str, patch: NotePatchInput) -> Result<NoteMetaDto, Error> {
        let note = self.store().update(&NoteId::parse(id), patch.into())?;
        Ok(NoteMetaDto::from(&note.meta))
    }

    pub fn delete(&self, id: &str) -> Result<(), Error> {
        self.store().delete(&NoteId::parse(id))
    }

    pub fn search(&self, query: SearchInput) -> Result<Vec<NoteMetaDto>, Error> {
        let store = self.store();
        let metas = search(&store, &NaiveSearcher, &query.into())?;
        Ok(metas.iter().map(NoteMetaDto::from).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn svc() -> (TempDir, NotesService) {
        let d = TempDir::new().unwrap();
        let s = NotesService::new(d.path().to_path_buf());
        (d, s)
    }

    #[test]
    fn create_list_get_update_delete_search_roundtrip() {
        let (_d, s) = svc();
        let meta = s
            .create(NewNoteInput {
                title: "Shopping".into(),
                body: "milk".into(),
                tags: vec!["home".into()],
            })
            .unwrap();
        assert_eq!(s.list().unwrap().len(), 1);

        let got = s.get(&meta.id).unwrap();
        assert_eq!(got.title, "Shopping");
        assert_eq!(got.body, "milk");

        s.update(
            &meta.id,
            NotePatchInput {
                body: Some("milk, eggs".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(s.get(&meta.id).unwrap().body, "milk, eggs");

        let hits = s
            .search(SearchInput {
                text: "eggs".into(),
                tags: vec![],
            })
            .unwrap();
        assert_eq!(hits.len(), 1);

        s.delete(&meta.id).unwrap();
        assert!(s.list().unwrap().is_empty());
    }
}
