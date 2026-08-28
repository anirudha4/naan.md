//! Manual smoke test for naan-core (there is no app UI yet).
//!
//! Run:  cargo run -p naan-core --example demo [optional-folder]
//! Default folder: ~/Documents/naan-demo
//!
//! Creates a couple of notes, edits one, then searches and lists them, so you
//! can open the folder and see / edit the real Markdown files on disk.
//! ponytail: throwaway hands-on demo, not shipped in the app.
use naan_core::{search, FsNoteStore, NaiveSearcher, NewNote, NotePatch, NoteStore, SearchQuery};
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
            PathBuf::from(home).join("Documents").join("naan-demo")
        });
    println!("notes folder: {}\n", dir.display());

    let store = FsNoteStore::new(&dir);

    let shopping = store.create(NewNote {
        title: "Shopping list".into(),
        body: "- milk\n- eggs\n".into(),
        tags: vec!["home".into()],
    })?;
    store.create(NewNote {
        title: "naan roadmap".into(),
        body: "Ship the notes app.\n".into(),
        tags: vec!["work".into()],
    })?;

    // edit the first note (adds a line)
    store.update(
        &shopping.meta.id,
        NotePatch {
            body: Some("- milk\n- eggs\n- flour\n".into()),
            ..Default::default()
        },
    )?;

    println!("all notes (newest first):");
    for m in store.list()? {
        let short: String = m.id.as_str().chars().take(10).collect();
        println!("  [{short}] {}  tags={:?}", m.title, m.tags);
    }

    println!("\nsearch text 'naan':");
    for m in search(
        &store,
        &NaiveSearcher,
        &SearchQuery {
            text: "naan".into(),
            tags: vec![],
        },
    )? {
        println!("  {}", m.title);
    }

    println!("\nsearch tag 'home':");
    let q = SearchQuery {
        text: String::new(),
        tags: vec!["home".into()],
    };
    for m in search(&store, &NaiveSearcher, &q)? {
        println!("  {}", m.title);
    }

    println!("\nOpen the folder to see / edit the .md files:");
    println!("  open {}", dir.display());
    Ok(())
}
