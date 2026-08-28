use crate::frontmatter::{self, Frontmatter};
use crate::model::{NewNote, Note, NoteId, NoteMeta, NotePatch};
use crate::{Error, Result};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::{Path, PathBuf};

pub trait NoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>>;
    fn get(&self, id: &NoteId) -> Result<Note>;
    fn create(&self, draft: NewNote) -> Result<Note>;
    fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note>;
    fn delete(&self, id: &NoteId) -> Result<()>;
}

pub struct FsNoteStore {
    dir: PathBuf,
}

impl FsNoteStore {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        FsNoteStore { dir: dir.into() }
    }

    fn md_files(&self) -> Result<Vec<PathBuf>> {
        let mut out = Vec::new();
        if !self.dir.exists() {
            return Ok(out);
        }
        for entry in fs::read_dir(&self.dir)? {
            let path = entry?.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                out.push(path);
            }
        }
        Ok(out)
    }

    pub(crate) fn read_note(&self, path: &Path) -> Result<Note> {
        let content = fs::read_to_string(path)?;
        let (raw, body) = frontmatter::parse(&content)?;
        let raw = raw.unwrap_or_default();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default()
            .to_string();
        let fs_time = file_mtime(path).unwrap_or_else(Utc::now);
        let id = match &raw.id {
            Some(v) => NoteId(v.clone()),
            None => NoteId::from_path_name(&file_name),
        };
        let title = raw
            .title
            .clone()
            .or_else(|| first_heading(&body))
            .unwrap_or_else(|| stem(path));
        let meta = NoteMeta {
            id,
            title,
            tags: raw.tags.clone(),
            created: raw.created.unwrap_or(fs_time),
            updated: raw.updated.unwrap_or(fs_time),
            path: path.to_path_buf(),
        };
        Ok(Note { meta, body })
    }

    pub(crate) fn find_path(&self, id: &NoteId) -> Result<PathBuf> {
        for path in self.md_files()? {
            if &self.read_note(&path)?.meta.id == id {
                return Ok(path);
            }
        }
        Err(Error::NotFound(id.0.clone()))
    }

    /// A free `slug.md` under `dir`, skipping `exclude` (the note's own path
    /// during rename). Appends `-2`, `-3`, ... on collision.
    pub(crate) fn unique_path(&self, title: &str, exclude: Option<&Path>) -> PathBuf {
        let base = slug::slugify(title);
        let base = if base.is_empty() {
            "untitled".to_string()
        } else {
            base
        };
        let mut candidate = self.dir.join(format!("{base}.md"));
        let mut n = 2;
        while candidate.exists() && Some(candidate.as_path()) != exclude {
            candidate = self.dir.join(format!("{base}-{n}.md"));
            n += 1;
        }
        candidate
    }

    pub(crate) fn write(&self, path: &Path, meta: &NoteMeta, body: &str) -> Result<()> {
        let fm = Frontmatter {
            id: meta.id.0.clone(),
            title: meta.title.clone(),
            tags: meta.tags.clone(),
            created: meta.created,
            updated: meta.updated,
        };
        let content = frontmatter::serialize(&fm, body)?;
        fs::create_dir_all(&self.dir)?;
        fs::write(path, content)?;
        Ok(())
    }
}

impl NoteStore for FsNoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>> {
        let mut metas = self
            .md_files()?
            .iter()
            .map(|p| self.read_note(p).map(|n| n.meta))
            .collect::<Result<Vec<_>>>()?;
        metas.sort_by_key(|m| std::cmp::Reverse(m.updated));
        Ok(metas)
    }

    fn get(&self, id: &NoteId) -> Result<Note> {
        let path = self.find_path(id)?;
        self.read_note(&path)
    }

    fn create(&self, draft: NewNote) -> Result<Note> {
        let now = Utc::now();
        let path = self.unique_path(&draft.title, None);
        let meta = NoteMeta {
            id: NoteId::generate(),
            title: draft.title,
            tags: draft.tags,
            created: now,
            updated: now,
            path: path.clone(),
        };
        self.write(&path, &meta, &draft.body)?;
        Ok(Note {
            meta,
            body: draft.body,
        })
    }

    fn update(&self, _id: &NoteId, _patch: NotePatch) -> Result<Note> {
        // Implemented in Task 5.
        Err(Error::Invalid("update not yet implemented".into()))
    }

    fn delete(&self, _id: &NoteId) -> Result<()> {
        // Implemented in Task 5.
        Err(Error::Invalid("delete not yet implemented".into()))
    }
}

fn file_mtime(path: &Path) -> Option<DateTime<Utc>> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    Some(DateTime::<Utc>::from(modified))
}

fn first_heading(body: &str) -> Option<String> {
    body.lines()
        .find_map(|l| l.strip_prefix("# ").map(|h| h.trim().to_string()))
}

fn stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (TempDir, FsNoteStore) {
        let dir = TempDir::new().unwrap();
        let store = FsNoteStore::new(dir.path());
        (dir, store)
    }

    #[test]
    fn create_then_get_roundtrips() {
        let (_d, store) = store();
        let note = store
            .create(NewNote {
                title: "First".into(),
                body: "hello world".into(),
                tags: vec!["ideas".into()],
            })
            .unwrap();
        assert!(note.meta.id.is_managed());
        let fetched = store.get(&note.meta.id).unwrap();
        assert_eq!(fetched.meta.title, "First");
        assert_eq!(fetched.body, "hello world");
        assert_eq!(fetched.meta.tags, vec!["ideas"]);
    }

    #[test]
    fn create_uses_slug_filename_with_collision_suffix() {
        let (_d, store) = store();
        let a = store
            .create(NewNote {
                title: "My Note".into(),
                ..Default::default()
            })
            .unwrap();
        let b = store
            .create(NewNote {
                title: "My Note".into(),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(a.meta.path.file_name().unwrap(), "my-note.md");
        assert_eq!(b.meta.path.file_name().unwrap(), "my-note-2.md");
    }

    #[test]
    fn list_returns_all_sorted_by_updated_desc() {
        let (_d, store) = store();
        store
            .create(NewNote {
                title: "One".into(),
                ..Default::default()
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let two = store
            .create(NewNote {
                title: "Two".into(),
                ..Default::default()
            })
            .unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, two.meta.id); // newest first
    }

    #[test]
    fn plain_md_file_gets_path_id_and_title_from_heading() {
        let (dir, store) = store();
        std::fs::write(dir.path().join("dropped.md"), "# Dropped In\n\nbody").unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 1);
        assert!(!list[0].id.is_managed());
        assert_eq!(list[0].id.as_str(), "path:dropped.md");
        assert_eq!(list[0].title, "Dropped In");
    }
}
