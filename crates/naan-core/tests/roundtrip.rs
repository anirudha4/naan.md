use naan_core::{search, FsNoteStore, NaiveSearcher, NewNote, NotePatch, NoteStore, SearchQuery};
use tempfile::TempDir;

#[test]
fn full_lifecycle_through_public_api() {
    let dir = TempDir::new().unwrap();
    let store = FsNoteStore::new(dir.path());

    let a = store
        .create(NewNote {
            title: "Shopping".into(),
            body: "milk".into(),
            tags: vec!["home".into()],
        })
        .unwrap();
    store
        .create(NewNote {
            title: "Roadmap".into(),
            body: "ship naan".into(),
            tags: vec!["work".into()],
        })
        .unwrap();

    // search by text
    let hits = search(
        &store,
        &NaiveSearcher,
        &SearchQuery {
            text: "naan".into(),
            tags: vec![],
        },
    )
    .unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].title, "Roadmap");

    // search by tag
    let home = search(
        &store,
        &NaiveSearcher,
        &SearchQuery {
            text: String::new(),
            tags: vec!["home".into()],
        },
    )
    .unwrap();
    assert_eq!(home.len(), 1);
    assert_eq!(home[0].title, "Shopping");

    // update + delete
    store
        .update(
            &a.meta.id,
            NotePatch {
                body: Some("milk, eggs".into()),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(store.get(&a.meta.id).unwrap().body, "milk, eggs");
    store.delete(&a.meta.id).unwrap();
    assert_eq!(store.list().unwrap().len(), 1);
}
