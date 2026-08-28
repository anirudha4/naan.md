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
    fn all(&self) -> Result<Vec<Note>>;
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
            if path.extension().and_then(|e| e.to_str()) == Some("md") && path.is_file() {
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
            Some(v) => NoteId::parse(v.clone()),
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
            // skip unreadable/malformed files so one bad note can't break lookups
            if let Ok(note) = self.read_note(&path) {
                if &note.meta.id == id {
                    return Ok(path);
                }
            }
        }
        Err(Error::NotFound(id.as_str().to_owned()))
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
            id: meta.id.as_str().to_owned(),
            title: meta.title.clone(),
            tags: meta.tags.clone(),
            created: meta.created,
            updated: meta.updated,
        };
        let content = frontmatter::serialize(&fm, body)?;
        fs::create_dir_all(&self.dir)?;
        // Atomic write: fill a `.tmp` sibling then rename over `path`, so a crash
        // mid-write can't truncate an existing note. `.tmp` isn't matched by
        // `md_files`, so it never shows up as a note.
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, content)?;
        fs::rename(&tmp, path)?;
        Ok(())
    }
}

impl NoteStore for FsNoteStore {
    fn list(&self) -> Result<Vec<NoteMeta>> {
        // ponytail: skip unreadable/malformed files so one bad note can't brick the list
        let mut metas = self
            .md_files()?
            .iter()
            .filter_map(|p| self.read_note(p).ok().map(|n| n.meta))
            .collect::<Vec<_>>();
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

    fn update(&self, id: &NoteId, patch: NotePatch) -> Result<Note> {
        let path = self.find_path(id)?;
        let mut note = self.read_note(&path)?;

        // adopt-on-edit: unmanaged files earn a real ULID now
        if !note.meta.id.is_managed() {
            note.meta.id = NoteId::generate();
        }

        let old_title = note.meta.title.clone();
        if let Some(t) = patch.title {
            note.meta.title = t;
        }
        if let Some(b) = patch.body {
            note.body = b;
        }
        if let Some(tags) = patch.tags {
            note.meta.tags = tags;
        }
        note.meta.updated = Utc::now();

        let target = if note.meta.title != old_title {
            self.unique_path(&note.meta.title, Some(&path))
        } else {
            path.clone()
        };
        // `write` ignores `meta.path`; the note's path is set below after we know
        // whether a rename happened.
        self.write(&target, &note.meta, &note.body)?;
        if target != path {
            // Write-then-delete rename: if the delete fails, two files briefly
            // share one id. We favor no-data-loss over strict uniqueness here.
            fs::remove_file(&path)?;
        }
        note.meta.path = target;
        Ok(note)
    }

    fn delete(&self, id: &NoteId) -> Result<()> {
        let path = self.find_path(id)?;
        fs::remove_file(path)?;
        Ok(())
    }

    fn all(&self) -> Result<Vec<Note>> {
        // read each file once; skip unreadable/malformed files
        let mut notes: Vec<Note> = self
            .md_files()?
            .iter()
            .filter_map(|p| self.read_note(p).ok())
            .collect();
        notes.sort_by_key(|n| std::cmp::Reverse(n.meta.updated));
        Ok(notes)
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
    fn list_skips_unreadable_or_malformed_files() {
        let (dir, store) = store();
        store
            .create(NewNote {
                title: "Good One".into(),
                ..Default::default()
            })
            .unwrap();
        store
            .create(NewNote {
                title: "Good Two".into(),
                ..Default::default()
            })
            .unwrap();
        // A junk file with frontmatter that fails YAML parsing.
        std::fs::write(
            dir.path().join("bad.md"),
            "---\nnot: a: valid: mapping\n---\n",
        )
        .unwrap();
        // A directory named like a note must be ignored (not treated as a file).
        std::fs::create_dir(dir.path().join("notafile.md")).unwrap();

        let list = store.list().unwrap();
        assert_eq!(list.len(), 2);
        let titles: Vec<_> = list.iter().map(|m| m.title.as_str()).collect();
        assert!(titles.contains(&"Good One"));
        assert!(titles.contains(&"Good Two"));
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

    #[test]
    fn read_paths_do_not_rewrite_plain_files() {
        let (dir, store) = store();
        std::fs::write(dir.path().join("dropped.md"), "# Dropped In\n\nbody").unwrap();
        let before = std::fs::read(dir.path().join("dropped.md")).unwrap();

        let id = store.list().unwrap()[0].id.clone();
        store.get(&id).unwrap();

        let after = std::fs::read(dir.path().join("dropped.md")).unwrap();
        assert_eq!(before, after, "reading must not rewrite a plain .md file");
    }

    #[test]
    fn update_patches_fields_and_bumps_updated() {
        let (_d, store) = store();
        let note = store
            .create(NewNote {
                title: "Orig".into(),
                body: "a".into(),
                ..Default::default()
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let updated = store
            .update(
                &note.meta.id,
                NotePatch {
                    body: Some("b".into()),
                    tags: Some(vec!["t".into()]),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.body, "b");
        assert_eq!(updated.meta.tags, vec!["t"]);
        assert!(updated.meta.updated > note.meta.updated);
    }

    #[test]
    fn update_title_renames_the_file() {
        let (_d, store) = store();
        let note = store
            .create(NewNote {
                title: "Old Name".into(),
                ..Default::default()
            })
            .unwrap();
        let old_path = note.meta.path.clone();
        let updated = store
            .update(
                &note.meta.id,
                NotePatch {
                    title: Some("New Name".into()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.meta.path.file_name().unwrap(), "new-name.md");
        assert!(!old_path.exists());
    }

    #[test]
    fn editing_a_plain_file_adopts_it() {
        let (dir, store) = store();
        std::fs::write(dir.path().join("dropped.md"), "# Dropped\n\nbody").unwrap();
        let id = store.list().unwrap()[0].id.clone();
        assert!(!id.is_managed());
        let updated = store
            .update(
                &id,
                NotePatch {
                    body: Some("new body".into()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert!(updated.meta.id.is_managed()); // got a real ULID
                                               // re-reading yields the managed id and persisted frontmatter
        let reread = store.get(&updated.meta.id).unwrap();
        assert_eq!(reread.body, "new body");
        assert!(reread.meta.id.is_managed());
    }

    #[test]
    fn delete_removes_the_file() {
        let (_d, store) = store();
        let note = store
            .create(NewNote {
                title: "Bye".into(),
                ..Default::default()
            })
            .unwrap();
        store.delete(&note.meta.id).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(matches!(store.get(&note.meta.id), Err(Error::NotFound(_))));
    }

    #[test]
    fn all_reads_every_note_with_body_sorted_newest_first() {
        let (_d, store) = store();
        store
            .create(NewNote {
                title: "One".into(),
                body: "a".into(),
                ..Default::default()
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        store
            .create(NewNote {
                title: "Two".into(),
                body: "b".into(),
                ..Default::default()
            })
            .unwrap();
        let all = store.all().unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].meta.title, "Two"); // newest first
        assert_eq!(all[0].body, "b"); // bodies included
    }

    #[test]
    fn all_skips_malformed_files() {
        let (dir, store) = store();
        store
            .create(NewNote {
                title: "Good".into(),
                ..Default::default()
            })
            .unwrap();
        std::fs::write(
            dir.path().join("bad.md"),
            "---\nnot: a: valid: mapping\n---\n",
        )
        .unwrap();
        assert_eq!(store.all().unwrap().len(), 1); // bad file skipped, not an error
    }

    #[test]
    fn malformed_file_does_not_break_lookups() {
        let (dir, store) = store();
        let note = store
            .create(NewNote {
                title: "Good".into(),
                body: "hi".into(),
                ..Default::default()
            })
            .unwrap();
        std::fs::write(
            dir.path().join("bad.md"),
            "---\nnot: a: valid: mapping\n---\n",
        )
        .unwrap();
        // Looking up a non-existent id forces scanning ALL files, including bad.md:
        // with the bug this errored (Yaml); with the fix it must be NotFound.
        assert!(matches!(
            store.get(&NoteId::parse("does-not-exist")),
            Err(Error::NotFound(_))
        ));
        // and the good note remains fully operable
        assert_eq!(store.get(&note.meta.id).unwrap().body, "hi");
        store
            .update(
                &note.meta.id,
                NotePatch {
                    body: Some("bye".into()),
                    ..Default::default()
                },
            )
            .unwrap();
        store.delete(&note.meta.id).unwrap();
    }
}
