use crate::model::{Note, NoteMeta};

#[derive(Debug, Clone, Default)]
pub struct SearchQuery {
    pub text: String,
    pub tags: Vec<String>,
}

pub trait Searcher {
    fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta>;
}

/// Linear scan over all notes.
// ponytail: O(n) full scan per query; swap for an inverted index if it drags.
#[derive(Debug, Default)]
pub struct NaiveSearcher;

impl Searcher for NaiveSearcher {
    fn search(&self, notes: &[Note], query: &SearchQuery) -> Vec<NoteMeta> {
        let needle = query.text.to_lowercase();
        notes
            .iter()
            .filter(|n| {
                let text_ok = needle.is_empty()
                    || n.meta.title.to_lowercase().contains(&needle)
                    || n.body.to_lowercase().contains(&needle)
                    || n.meta
                        .tags
                        .iter()
                        .any(|t| t.to_lowercase().contains(&needle));
                let tags_ok = query
                    .tags
                    .iter()
                    .all(|q| n.meta.tags.iter().any(|t| t.eq_ignore_ascii_case(q)));
                text_ok && tags_ok
            })
            .map(|n| n.meta.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Note, NoteId, NoteMeta};
    use chrono::Utc;
    use std::path::PathBuf;

    fn note(title: &str, body: &str, tags: &[&str]) -> Note {
        let now = Utc::now();
        Note {
            meta: NoteMeta {
                id: NoteId::generate(),
                title: title.into(),
                tags: tags.iter().map(|s| s.to_string()).collect(),
                created: now,
                updated: now,
                path: PathBuf::new(),
            },
            body: body.into(),
        }
    }

    #[test]
    fn text_matches_title_body_or_tags_case_insensitively() {
        let notes = vec![
            note("Grocery list", "milk and eggs", &["home"]),
            note("Ideas", "build NAAN", &["work"]),
        ];
        let s = NaiveSearcher;
        let hits = s.search(
            &notes,
            &SearchQuery {
                text: "naan".into(),
                tags: vec![],
            },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Ideas");
    }

    #[test]
    fn text_matches_title_only() {
        // "special" appears only in the title, not the body or tags.
        let notes = vec![
            note("Special Report", "quarterly numbers", &["finance"]),
            note("Other", "nothing here", &["misc"]),
        ];
        let hits = NaiveSearcher.search(
            &notes,
            &SearchQuery {
                text: "special".into(),
                tags: vec![],
            },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Special Report");
    }

    #[test]
    fn text_matches_tag_substring() {
        // "urg" is a substring of the tag "urgent" only; not in title/body.
        let notes = vec![
            note("Task", "do the thing", &["urgent"]),
            note("Other", "nothing here", &["later"]),
        ];
        let hits = NaiveSearcher.search(
            &notes,
            &SearchQuery {
                text: "urg".into(),
                tags: vec![],
            },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Task");
    }

    #[test]
    fn tag_filter_is_case_insensitive() {
        // Stored tag "Work", queried as "work" -> still matches.
        let notes = vec![note("A", "", &["Work"]), note("B", "", &["home"])];
        let hits = NaiveSearcher.search(
            &notes,
            &SearchQuery {
                text: String::new(),
                tags: vec!["work".into()],
            },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "A");
    }

    #[test]
    fn empty_text_returns_all() {
        let notes = vec![note("A", "", &[]), note("B", "", &[])];
        let hits = NaiveSearcher.search(&notes, &SearchQuery::default());
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn tag_filter_requires_all_tags() {
        let notes = vec![note("A", "", &["x", "y"]), note("B", "", &["x"])];
        let hits = NaiveSearcher.search(
            &notes,
            &SearchQuery {
                text: String::new(),
                tags: vec!["x".into(), "y".into()],
            },
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "A");
    }
}
