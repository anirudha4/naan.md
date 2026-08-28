use crate::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Frontmatter as written to disk (managed notes have every field).
#[derive(Debug, Serialize)]
pub struct Frontmatter {
    pub id: String,
    pub title: String,
    pub tags: Vec<String>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
}

/// Tolerant parse target: any field may be absent in a hand-written file.
#[derive(Debug, Default, Deserialize)]
pub struct RawFrontmatter {
    pub id: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: Option<DateTime<Utc>>,
    pub updated: Option<DateTime<Utc>>,
}

/// Split file content into (optional frontmatter, body). Frontmatter must be
/// a leading fenced block: `---\n ... \n---\n`.
pub fn parse(content: &str) -> Result<(Option<RawFrontmatter>, String)> {
    if let Some(rest) = content.strip_prefix("---\n") {
        let (yaml, body) = if let Some(idx) = rest.find("\n---\n") {
            // Body starts after the closing fence; drop the single blank
            // separator line that `serialize` writes between fence and body.
            let after = &rest[idx + 5..];
            let body = after.strip_prefix('\n').unwrap_or(after);
            (&rest[..idx], body.to_string())
        } else if let Some(stripped) = rest.strip_suffix("\n---") {
            (stripped, String::new())
        } else {
            // Opening fence with no closing fence: treat as plain body.
            return Ok((None, content.to_string()));
        };
        let raw: RawFrontmatter = serde_yaml_ng::from_str(yaml)?;
        return Ok((Some(raw), body));
    }
    Ok((None, content.to_string()))
}

/// Serialize frontmatter + body into file content.
pub fn serialize(fm: &Frontmatter, body: &str) -> Result<String> {
    let yaml = serde_yaml_ng::to_string(fm)?;
    Ok(format!("---\n{yaml}---\n\n{body}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let content = "---\nid: 01ABC\ntitle: Hello\ntags: [a, b]\ncreated: 2026-08-28T10:00:00Z\nupdated: 2026-08-28T10:00:00Z\n---\n\nBody text\n";
        let (raw, body) = parse(content).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01ABC"));
        assert_eq!(raw.title.as_deref(), Some("Hello"));
        assert_eq!(raw.tags, vec!["a", "b"]);
        assert_eq!(body, "Body text\n");
    }

    #[test]
    fn no_frontmatter_returns_none_and_full_body() {
        let content = "# Just a heading\n\nsome text";
        let (raw, body) = parse(content).unwrap();
        assert!(raw.is_none());
        assert_eq!(body, content);
    }

    #[test]
    fn serialize_then_parse_roundtrips() {
        use chrono::{TimeZone, Utc};
        let ts = Utc.with_ymd_and_hms(2026, 8, 28, 10, 0, 0).unwrap();
        let fm = Frontmatter {
            id: "01XYZ".into(),
            title: "Round Trip".into(),
            tags: vec!["x".into()],
            created: ts,
            updated: ts,
        };
        let text = serialize(&fm, "the body").unwrap();
        assert!(text.starts_with("---\n"));
        let (raw, body) = parse(&text).unwrap();
        let raw = raw.unwrap();
        assert_eq!(raw.id.as_deref(), Some("01XYZ"));
        assert_eq!(raw.title.as_deref(), Some("Round Trip"));
        assert_eq!(body, "the body");
    }
}
